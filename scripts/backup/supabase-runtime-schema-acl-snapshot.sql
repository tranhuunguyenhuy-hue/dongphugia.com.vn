with relevant_schemas as (
  select
    n.oid,
    n.nspname,
    pg_get_userbyid(n.nspowner) as owner_name,
    coalesce(n.nspacl, acldefault('n', n.nspowner)) as schema_acl
  from pg_namespace n
  where n.nspname in ('auth', 'extensions')
), schema_grants as (
  select
    s.nspname,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'grantee', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          'privilege', a.privilege_type,
          'grantable', a.is_grantable
        )
        order by a.grantee, a.privilege_type, a.is_grantable
      ),
      '[]'::jsonb
    ) as grants
  from relevant_schemas s
  cross join lateral aclexplode(s.schema_acl) a
  group by s.nspname
)
select jsonb_build_object(
  'format', 'dpg-runtime-schema-acl-v1',
  'roles', (select coalesce(jsonb_agg(rolname order by rolname), '[]'::jsonb) from pg_roles),
  'schemas', coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', s.nspname,
        'owner', s.owner_name,
        'grants', coalesce(g.grants, '[]'::jsonb)
      ) order by s.nspname
    ),
    '[]'::jsonb
  )
)::text
from relevant_schemas s
left join schema_grants g using (nspname);
