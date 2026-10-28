with role_state as (
  select
    r.rolname,
    r.rolsuper,
    r.rolinherit,
    r.rolcreaterole,
    r.rolcreatedb,
    r.rolcanlogin,
    r.rolreplication,
    r.rolconnlimit,
    r.rolbypassrls,
    r.rolvaliduntil,
    coalesce(r.rolconfig, array[]::text[]) as rolconfig
  from pg_roles r
  where r.rolname <> 'dpg_snapshot_restore'
), membership_state as (
  select
    granted.rolname as granted_role,
    member.rolname as member_role,
    grantor.rolname as grantor_role,
    m.admin_option,
    m.inherit_option,
    m.set_option
  from pg_auth_members m
  join pg_roles granted on granted.oid = m.roleid
  join pg_roles member on member.oid = m.member
  join pg_roles grantor on grantor.oid = m.grantor
  where granted.rolname <> 'dpg_snapshot_restore'
    and member.rolname <> 'dpg_snapshot_restore'
)
select jsonb_build_object(
  'format', 'dpg-runtime-role-state-v1',
  'roles', coalesce((
    select jsonb_agg(to_jsonb(r) order by r.rolname)
    from role_state r
  ), '[]'::jsonb),
  'memberships', coalesce((
    select jsonb_agg(to_jsonb(m) order by m.granted_role, m.member_role, m.grantor_role)
    from membership_state m
  ), '[]'::jsonb),
  'reservedBootstrapRoleAbsent', not exists (
    select 1 from pg_roles where rolname = 'dpg_snapshot_restore'
  )
)::text;
