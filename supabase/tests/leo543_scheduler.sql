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

  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise exception 'LEO-543 pg_cron extension is not installed';
  end if;

  select * into job_row
  from cron.job
  where jobname = 'leo543-publishing-scheduler';
  if job_row is null or job_row.schedule <> '* * * * *' or job_row.active is not false then
    raise exception 'LEO-543 cron job must exist and remain inactive before Owner activation';
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

rollback;
