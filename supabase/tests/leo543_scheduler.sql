-- LEO-543 sanitized acceptance test.
-- Run only against the isolated Preview target after the migration is applied.
-- This test does not enable the scheduler, send HTTP, or reveal Vault values.

\set ON_ERROR_STOP on
begin;

do $$
declare
  config_row record;
  state_row record;
  job_row record;
begin
  select * into config_row
  from dpg_control.leo543_scheduler_config
  where singleton;
  if config_row is null or config_row.enabled is not false
     or config_row.schedule <> '* * * * *'
     or config_row.max_attempts <> 3
     or config_row.max_ledger_rows <> 10000 then
    raise exception 'LEO-543 default scheduler safety contract failed';
  end if;

  select * into state_row
  from dpg_control.leo543_scheduler_state
  where singleton;
  if state_row is null then
    raise exception 'LEO-543 scheduler state missing';
  end if;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    if to_regclass('cron.job') is null then
      raise exception 'LEO-543 pg_cron schedule function exists without cron.job';
    end if;

    execute $sql$
      select *
      from cron.job
      where jobname = 'leo543-publishing-scheduler'
    $sql$ into job_row;
    if job_row is null or job_row.schedule <> '* * * * *' or job_row.active is not false then
      raise exception 'LEO-543 cron job must exist and remain inactive before Owner activation';
    end if;
  end if;
end
$$;

set local role dpg_migration;
select dpg_control.assert_free_tier_headroom(0);

do $$
declare
  stale_run_id constant uuid := '54300000-0000-4000-8000-000000000001';
  slot_value timestamptz := date_trunc('minute', now()) - interval '10 minutes';
begin
  insert into dpg_control.leo543_scheduler_runs (
    run_id, slot_at, attempt, status, dispatch_started_at, last_observed_at
  ) values (
    stale_run_id, slot_value, 1, 'dispatched', now() - interval '10 minutes', now() - interval '10 minutes'
  ) on conflict (run_id) do nothing;

  insert into dpg_control.leo543_scheduler_runs (run_id, slot_at)
  values ('54300000-0000-4000-8000-000000000002', slot_value)
  on conflict (slot_at) do nothing;

  if (select count(*) from dpg_control.leo543_scheduler_runs where slot_at = slot_value) <> 1 then
    raise exception 'LEO-543 one-slot idempotency assertion failed';
  end if;

  insert into dpg_control.leo543_scheduler_runs (
    run_id, slot_at, status, completed_at, response_status, result_code,
    processed_count, published_count, blocked_count, freshness_seconds
  ) values (
    '54300000-0000-4000-8000-000000000003', slot_value - interval '1 minute',
    'succeeded', now(), 200, 'PUBLISH_TO_LIVE', 3, 2, 1, 1.250
  ) on conflict (run_id) do nothing;
end
$$;

do $$
begin
  if dpg_control.leo543_scheduler_tick() <> 'SCHEDULER_DISABLED' then
    raise exception 'LEO-543 disabled scheduler did not fail closed';
  end if;
  if not exists (
    select 1 from dpg_control.leo543_scheduler_runs
    where run_id = '54300000-0000-4000-8000-000000000001'
      and status = 'retry_wait'
      and error_code = 'STALE_RUN_RECOVERY'
  ) then
    raise exception 'LEO-543 stale-run recovery assertion failed';
  end if;
end
$$;
reset role;

select dpg_control.leo543_scheduler_report();

set local role dpg_readonly;

do $$
declare
  freshness_rows integer;
  expected_columns constant text[] := array[
    'run_id', 'slot_at', 'completed_at', 'response_status', 'result_code',
    'freshness_seconds', 'processed_count', 'published_count', 'blocked_count'
  ];
  actual_columns text[];
  function_columns text[];
  function_name text;
begin
  select count(*) into freshness_rows
  from dpg_control.leo543_publishing_freshness;

  if freshness_rows < 0 or freshness_rows > 100 then
    raise exception 'LEO-543 sanitized freshness view bound failed';
  end if;

  select array_agg(attribute.attname order by attribute.attnum)
  into actual_columns
  from pg_attribute attribute
  where attribute.attrelid = 'dpg_control.leo543_publishing_freshness'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;
  if actual_columns <> expected_columns then
    raise exception 'LEO-543 sanitized freshness columns changed: %', actual_columns;
  end if;

  select proargnames[2:10]
  into function_columns
  from pg_proc
  where oid = 'dpg_control.leo543_publishing_freshness_rows(integer)'::regprocedure;
  if function_columns <> expected_columns then
    raise exception 'LEO-543 sanitized function columns changed: %', function_columns;
  end if;

  if has_table_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_runs', 'SELECT')
     or has_table_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_runs', 'INSERT')
     or has_table_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_runs', 'UPDATE')
     or has_table_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_runs', 'DELETE')
     or has_table_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_runs', 'TRUNCATE') then
    raise exception 'LEO-543 raw scheduler table privilege unexpectedly exists';
  end if;

  if has_function_privilege(
       'dpg_readonly',
       'dpg_control.leo543_publishing_freshness_rows(integer)',
       'EXECUTE'
     ) is not true then
    raise exception 'LEO-543 sanitized freshness function is not executable by dpg_readonly';
  end if;

  if has_function_privilege('dpg_readonly', 'dpg_control.leo543_scheduler_tick()', 'EXECUTE') then
    raise exception 'LEO-543 scheduler mutation function is executable by dpg_readonly';
  end if;

  for function_name in
    select unnest(array[
      'dpg_control.leo543_scheduler_tick()',
      'dpg_control.leo543_scheduler_report()',
      'dpg_control.leo543_publishing_freshness_rows(integer)'
    ])
  loop
    if has_function_privilege('anon', function_name, 'EXECUTE')
       or has_function_privilege('authenticated', function_name, 'EXECUTE')
       or has_function_privilege('service_role', function_name, 'EXECUTE') then
      raise exception 'LEO-543 function execution leaked to an external role: %', function_name;
    end if;
    if exists (
      select 1
      from aclexplode(
        coalesce(
          (select proacl from pg_proc where oid = function_name::regprocedure),
          acldefault('f', (select proowner from pg_proc where oid = function_name::regprocedure))
        )
      ) privilege
      where privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) then
      raise exception 'LEO-543 function execution leaked to PUBLIC: %', function_name;
    end if;
    if not exists (
      select 1
      from pg_proc
      where oid = function_name::regprocedure
        and prosecdef
        and pg_get_userbyid(proowner) = 'dpg_migration'
        and 'search_path=pg_catalog, dpg_control, extensions' = any(proconfig)
    ) then
      raise exception 'LEO-543 SECURITY DEFINER function hardening failed: %', function_name;
    end if;
  end loop;
end
$$;

do $$
begin
  begin
    perform 1 from dpg_control.leo543_scheduler_runs;
    raise exception 'LEO-543 raw scheduler table read unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

rollback;
