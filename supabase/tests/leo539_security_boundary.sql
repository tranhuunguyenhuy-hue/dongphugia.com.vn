-- Reproducible, secret-free LEO-539 validation. All probe writes roll back.

begin;

do $$
declare
  invalid_role_count integer;
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
