\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local search_path = pg_catalog, public;

do $runtime_readonly_acceptance$
declare
  table_name text;
begin
  if to_regprocedure('dpg_v1_api.public_product_get(uuid)') is null
     or to_regprocedure('dpg_v1_api.catalogue_media_register(jsonb,text)') is null
     or to_regprocedure('dpg_v1_api.order_intake_create(jsonb,text)') is null
     or to_regprocedure('dpg_v1_api.quote_request_intake_create(jsonb,text)') is null then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1')
      and c.relkind in ('r', 'p')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'SUPABASE_RUNTIME_READONLY_RLS_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1_api' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  ) then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_RELATION_EXPOSED';
  end if;

  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1' and c.relkind in ('r', 'p')
  loop
    if has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'INSERT')
       or has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'UPDATE')
       or has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'DELETE')
       or has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'TRUNCATE')
       or has_any_column_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'INSERT')
       or has_any_column_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'UPDATE')
       or has_any_column_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'REFERENCES') then
      raise exception 'SUPABASE_RUNTIME_READONLY_BACKUP_WRITE_PRIVILEGE table=%', table_name;
    end if;
  end loop;

  if exists (select 1 from auth.users) or exists (select 1 from storage.objects) then
    raise exception 'SUPABASE_RUNTIME_READONLY_PROVIDER_DATA_NOT_EMPTY';
  end if;
end
$runtime_readonly_acceptance$;

rollback;
