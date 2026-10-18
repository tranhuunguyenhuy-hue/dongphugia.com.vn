\set ON_ERROR_STOP on
begin transaction isolation level serializable;

do $checkpoint_target$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and data_class = 'production-derived-reduced-runtime'
      and production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
      and hard_database_ceiling_bytes = 367001600
  ) then
    raise exception 'SUPABASE_CHECKPOINT_BEHAVIOR_TARGET_FAILED';
  end if;
end
$checkpoint_target$;

set local role anon;
do $$
begin
  begin
    insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '11111111-1111-4111-8111-111111111111', 'SYNTHETIC-ANON-DENIED');
    raise exception 'SUPABASE_CHECKPOINT_ANON_WRITE_SUCCEEDED';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

set local role dpg_readonly;
do $$
begin
  begin
    insert into dpg_app.leo539_rls_probe (id, owner_id, payload)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            '11111111-1111-4111-8111-111111111111', 'SYNTHETIC-READONLY-DENIED');
    raise exception 'SUPABASE_CHECKPOINT_READONLY_WRITE_SUCCEEDED';
  exception when insufficient_privilege then null;
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
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111', 'SYNTHETIC-OWNER');

do $$
begin
  if (select count(*) from dpg_app.leo539_rls_probe
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'SUPABASE_CHECKPOINT_OWNER_VISIBILITY_FAILED';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
do $$
begin
  if exists (
    select 1 from dpg_app.leo539_rls_probe
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'SUPABASE_CHECKPOINT_CROSS_OWNER_VISIBILITY_FAILED';
  end if;
end
$$;
reset role;

rollback;
