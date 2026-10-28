do $supabase_runtime_snapshot_identity$
declare
  relation record;
  sequence_object record;
  relation_requires_select boolean;
  sequence_requires_select boolean;
begin
  if current_database() <> 'postgres'
     or session_user <> 'dpg_snapshot_login'
     or current_user <> 'dpg_snapshot_readonly'
     or current_setting('default_transaction_read_only') <> 'on' then
    raise exception 'SUPABASE_RUNTIME_SNAPSHOT_IDENTITY_MISMATCH';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'dpg_snapshot_login'
      and rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and not rolbypassrls
  ) or not exists (
    select 1 from pg_roles
    where rolname = 'dpg_snapshot_readonly'
      and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and rolbypassrls
  ) then
    raise exception 'SUPABASE_RUNTIME_SNAPSHOT_ROLE_ATTRIBUTES_INVALID';
  end if;

  if (select count(*) from pg_auth_members
      where member = (select oid from pg_roles where rolname = 'dpg_snapshot_login')) <> 1
     or not exists (
       select 1 from pg_auth_members m
       join pg_roles capability on capability.oid = m.roleid
       join pg_roles login on login.oid = m.member
       where capability.rolname = 'dpg_snapshot_readonly'
         and login.rolname = 'dpg_snapshot_login'
         and not m.admin_option and not m.inherit_option and m.set_option
     )
     or exists (
       select 1 from pg_auth_members m
       join pg_roles granted on granted.oid = m.roleid
       join pg_roles member_role on member_role.oid = m.member
       where (granted.rolname in ('dpg_snapshot_readonly', 'dpg_snapshot_login')
          or member_role.rolname in ('dpg_snapshot_readonly', 'dpg_snapshot_login'))
         and not (granted.rolname = 'dpg_snapshot_readonly'
          and member_role.rolname = 'dpg_snapshot_login'
          and not m.admin_option and not m.inherit_option and m.set_option)
     ) then
    raise exception 'SUPABASE_RUNTIME_SNAPSHOT_MEMBERSHIP_INVALID';
  end if;

  if not has_schema_privilege(current_user, 'dpg_app', 'USAGE')
     or not has_schema_privilege(current_user, 'dpg_control', 'USAGE')
     or not has_schema_privilege(current_user, 'dpg_v1', 'USAGE')
     or not has_schema_privilege(current_user, 'dpg_v1_api', 'USAGE')
     or not has_schema_privilege(current_user, 'public', 'USAGE')
     or not has_schema_privilege(current_user, 'auth', 'USAGE')
     or not has_schema_privilege(current_user, 'storage', 'USAGE')
     or exists (
       select 1 from pg_namespace n
       where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
         and has_schema_privilege(current_user, n.oid, 'CREATE')
     )
     or has_database_privilege(current_user, current_database(), 'CREATE')
     or not has_database_privilege(current_user, current_database(), 'TEMP') then
    raise exception 'SUPABASE_RUNTIME_SNAPSHOT_SCHEMA_PRIVILEGE_INVALID';
  end if;

  if to_regclass('auth.users') is null or to_regclass('storage.objects') is null then
    raise exception 'SUPABASE_RUNTIME_SNAPSHOT_EMPTY_SURFACE_MISSING';
  end if;

  for relation in
    select c.oid, c.relname, n.nspname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    relation_requires_select := (
      relation.nspname in ('dpg_app', 'dpg_control', 'dpg_v1')
      and relation.relkind in ('r', 'p', 'm')
    ) or (relation.nspname = 'auth' and relation.relname = 'users' and relation.relkind = 'r')
      or (relation.nspname = 'storage' and relation.relname = 'objects' and relation.relkind = 'r');

    if relation_requires_select and not has_table_privilege(current_user, relation.oid, 'SELECT') then
      raise exception 'SUPABASE_RUNTIME_SNAPSHOT_REQUIRED_SELECT_MISSING';
    end if;
    if not relation_requires_select and has_table_privilege(current_user, relation.oid, 'SELECT') then
      raise exception 'SUPABASE_RUNTIME_SNAPSHOT_UNRELATED_SELECT_PRESENT';
    end if;
    if has_table_privilege(current_user, relation.oid, 'INSERT')
       or has_table_privilege(current_user, relation.oid, 'UPDATE')
       or has_table_privilege(current_user, relation.oid, 'DELETE')
       or has_table_privilege(current_user, relation.oid, 'TRUNCATE')
       or has_table_privilege(current_user, relation.oid, 'REFERENCES')
       or has_table_privilege(current_user, relation.oid, 'TRIGGER') then
      raise exception 'SUPABASE_RUNTIME_SNAPSHOT_WRITE_PRIVILEGE_PRESENT';
    end if;
  end loop;

  for sequence_object in
    select c.oid, n.nspname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
      and c.relkind = 'S'
  loop
    sequence_requires_select := sequence_object.nspname in ('dpg_app', 'dpg_control', 'dpg_v1');
    if sequence_requires_select
       and not has_sequence_privilege(current_user, sequence_object.oid, 'SELECT') then
      raise exception 'SUPABASE_RUNTIME_SNAPSHOT_REQUIRED_SEQUENCE_SELECT_MISSING';
    end if;
    if not sequence_requires_select
       and (has_sequence_privilege(current_user, sequence_object.oid, 'SELECT')
         or has_sequence_privilege(current_user, sequence_object.oid, 'USAGE')
         or has_sequence_privilege(current_user, sequence_object.oid, 'UPDATE')) then
      raise exception 'SUPABASE_RUNTIME_SNAPSHOT_UNRELATED_SEQUENCE_PRIVILEGE_PRESENT';
    end if;
    if has_sequence_privilege(current_user, sequence_object.oid, 'USAGE')
       or has_sequence_privilege(current_user, sequence_object.oid, 'UPDATE') then
      raise exception 'SUPABASE_RUNTIME_SNAPSHOT_SEQUENCE_WRITE_PRIVILEGE_PRESENT';
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc function_object
    join pg_namespace n on n.oid = function_object.pronamespace
    where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
      and function_object.prosecdef
      and has_function_privilege(current_user, function_object.oid, 'EXECUTE')
  ) then
    raise exception 'SUPABASE_RUNTIME_SNAPSHOT_SECURITY_DEFINER_EXECUTE_PRESENT';
  end if;
end
$supabase_runtime_snapshot_identity$;
