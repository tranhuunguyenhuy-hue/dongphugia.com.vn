-- Phase 2 Admin CMS: expose only active Blog categories to authorized staff.
-- Source only. Do not apply this migration to hosted targets without a new Owner gate.

do $preflight$
begin
  if to_regclass('dpg_app.blog_categories') is null
     or to_regprocedure('dpg_app.leo542_admin_can(text)') is null
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or not has_schema_privilege('dpg_migration', 'public', 'USAGE')
     or not has_schema_privilege('dpg_migration', 'dpg_app', 'USAGE')
     or not has_schema_privilege(current_user, 'public', 'CREATE')
     or to_regprocedure('public.phase2_admin_blog_categories()') is not null then
    raise exception 'DPG_PHASE2_ADMIN_CMS_PREFLIGHT_FAILED';
  end if;
end
$preflight$;

grant create on schema public to dpg_migration;
set role dpg_migration;
set search_path = pg_catalog, dpg_app, public;

create function public.phase2_admin_blog_categories()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_app
as $$
begin
  if not dpg_app.leo542_admin_can('blog:read') then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.name, x.id)
    from (
      select id, name, slug
      from dpg_app.blog_categories
      where is_active
      order by name, id
      limit 200
    ) x
  ), '[]'::jsonb);
end
$$;

reset role;
revoke create on schema public from dpg_migration;
revoke all on function public.phase2_admin_blog_categories() from public, anon, service_role;
grant execute on function public.phase2_admin_blog_categories() to authenticated;

do $postflight$
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid = 'public.phase2_admin_blog_categories()'::regprocedure
      and not p.prosecdef and pg_get_userbyid(p.proowner) = 'dpg_migration'
  ) or has_schema_privilege('dpg_migration', 'public', 'CREATE')
    or has_function_privilege('anon', 'public.phase2_admin_blog_categories()', 'EXECUTE')
    or has_function_privilege('service_role', 'public.phase2_admin_blog_categories()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.phase2_admin_blog_categories()', 'EXECUTE') then
    raise exception 'DPG_PHASE2_ADMIN_CMS_POSTFLIGHT_FAILED';
  end if;
end
$postflight$;
