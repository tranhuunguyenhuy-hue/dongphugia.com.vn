-- Reproducible, secret-free LEO-539 validation. All probe writes roll back.

begin;

do $$
declare
  invalid_role_count integer;
  invalid_login_count integer;
  invalid_membership_count integer;
  target_row_count integer;
  user_count integer;
  object_count integer;
begin
  select count(*) into invalid_role_count
  from pg_roles
  where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly')
    and (
      rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolinherit
      or rolreplication or rolbypassrls
    );
  if invalid_role_count <> 0 then
    raise exception 'LEO-539 role-attribute assertion failed';
  end if;

  select count(*) into invalid_login_count
  from pg_roles
  where rolname in (
    'dpg_migration_login', 'dpg_runtime_login', 'dpg_readonly_login'
  )
    and (
      not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolinherit
      or rolreplication or rolbypassrls
    );
  if invalid_login_count <> 0 then
    raise exception 'LEO-539 login-identity assertion failed';
  end if;

  select 3 - count(*) into invalid_membership_count
  from pg_auth_members memberships
  join pg_roles granted_role on granted_role.oid = memberships.roleid
  join pg_roles member_role on member_role.oid = memberships.member
  where (granted_role.rolname, member_role.rolname) in (
    ('dpg_migration', 'dpg_migration_login'),
    ('dpg_runtime', 'dpg_runtime_login'),
    ('dpg_readonly', 'dpg_readonly_login')
  );
  if invalid_membership_count <> 0 then
    raise exception 'LEO-539 login membership assertion failed';
  end if;

  if has_schema_privilege('anon', 'dpg_app', 'USAGE') then
    raise exception 'LEO-539 anon schema assertion failed';
  end if;
  if has_table_privilege('dpg_readonly', 'dpg_app.leo539_rls_probe', 'INSERT') then
    raise exception 'LEO-539 readonly write assertion failed';
  end if;

  select count(*) into target_row_count
  from dpg_control.target_contract
  where project_name = 'dongphugia-runtime'
    and region = 'ap-southeast-1'
    and environment = 'preview'
    and data_class = 'synthetic-only'
    and not production_data_allowed
    and not production_credentials_allowed
    and not production_writes_allowed;
  if target_row_count <> 1 then
    raise exception 'LEO-539 target contract assertion failed';
  end if;

  select count(*) into user_count from auth.users;
  select count(*) into object_count from storage.objects;
  if user_count <> 0 or object_count <> 0 then
    raise exception 'LEO-539 empty target assertion failed';
  end if;
end
$$;

set local role anon;
do $$
begin
  begin
    insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111',
      'SYNTHETIC-ANON-DENIED'
    );
    raise exception 'LEO-539 anonymous write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

set local role dpg_readonly;
do $$
begin
  begin
    insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
    values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '11111111-1111-4111-8111-111111111111',
      'SYNTHETIC-READONLY-DENIED'
    );
    raise exception 'LEO-539 read-only write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

set local role dpg_migration;
do $$
begin
  begin
    insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '11111111-1111-4111-8111-111111111111',
      'SYNTHETIC-MIGRATION-DENIED'
    );
    raise exception 'LEO-539 migration-owner write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  perform dpg_control.assert_free_tier_headroom(0);
  begin
    perform dpg_control.assert_free_tier_headroom(367001600);
    raise exception 'LEO-539 database hard stop unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm not like 'LEO-539 free-tier hard stop:%' then
        raise;
      end if;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'SYNTHETIC-OWNER'
);

do $$
begin
  begin
    insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
    values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '11111111-1111-4111-8111-111111111111',
      'NOT-SYNTHETIC'
    );
    raise exception 'LEO-539 non-synthetic write unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from dpg_app.leo539_rls_probe
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if visible_count <> 1 then
    raise exception 'LEO-539 owner visibility assertion failed';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

do $$
declare
  visible_count integer;
  changed_count integer;
begin
  select count(*) into visible_count
  from dpg_app.leo539_rls_probe
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if visible_count <> 0 then
    raise exception 'LEO-539 cross-owner visibility assertion failed';
  end if;

  update dpg_app.leo539_rls_probe
  set payload = 'SYNTHETIC-CROSS-OWNER'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'LEO-539 cross-owner update assertion failed';
  end if;
end
$$;

reset role;
rollback;
