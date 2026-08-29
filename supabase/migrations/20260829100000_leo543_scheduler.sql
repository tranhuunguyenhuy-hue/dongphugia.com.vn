-- LEO-543: database-owned one-minute scheduler dispatch and freshness ledger.
--
-- This migration is source for the isolated Preview target only. It deliberately
-- does not create an extension, Vault secret, credential, role, or active job.
-- The default is fail-closed until the exact Owner-approved target has the
-- existing pg_cron/pg_net path and Vault entries configured.

begin;

do $$
begin
  if not exists (
    select 1
    from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO543_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

create table dpg_control.leo543_scheduler_config (
  singleton boolean primary key default true check (singleton),
  scheduler_name text not null default 'leo543-publishing-scheduler'
    check (scheduler_name = 'leo543-publishing-scheduler'),
  schedule text not null default '* * * * *'
    check (schedule = '* * * * *'),
  endpoint_url text
    check (endpoint_url is null or endpoint_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^?#]*)?$'),
  enabled boolean not null default false,
  max_attempts smallint not null default 3
    check (max_attempts between 1 and 5),
  retry_backoff_seconds integer not null default 30
    check (retry_backoff_seconds between 15 and 300),
  stale_after_seconds integer not null default 120
    check (stale_after_seconds between 60 and 900),
  max_ledger_rows integer not null default 10000
    check (max_ledger_rows between 1000 and 20000),
  updated_at timestamptz not null default now()
);

create table dpg_control.leo543_scheduler_state (
  singleton boolean primary key default true check (singleton),
  last_tick_at timestamptz,
  last_dispatch_at timestamptz,
  last_success_at timestamptz,
  last_run_id uuid,
  last_result_code text,
  last_error_code text,
  last_freshness_seconds numeric(12, 3),
  last_published_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table dpg_control.leo543_scheduler_runs (
  run_id uuid primary key,
  slot_at timestamptz not null unique,
  attempt smallint not null default 0 check (attempt between 0 and 5),
  status text not null default 'pending'
    check (status in ('pending', 'dispatched', 'retry_wait', 'succeeded', 'blocked', 'failed', 'stale')),
  pg_net_request_id bigint,
  dispatch_started_at timestamptz,
  last_observed_at timestamptz,
  completed_at timestamptz,
  next_attempt_at timestamptz,
  response_status integer,
  result_code text,
  processed_count integer not null default 0,
  published_count integer not null default 0,
  blocked_count integer not null default 0,
  freshness_seconds numeric(12, 3),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into dpg_control.leo543_scheduler_config (singleton)
values (true)
on conflict (singleton) do nothing;

insert into dpg_control.leo543_scheduler_state (singleton)
values (true)
on conflict (singleton) do nothing;

create index leo543_scheduler_runs_dispatch_idx
  on dpg_control.leo543_scheduler_runs (status, next_attempt_at, slot_at);
create index leo543_scheduler_runs_completed_idx
  on dpg_control.leo543_scheduler_runs (completed_at desc);

alter table dpg_control.leo543_scheduler_config owner to dpg_migration;
alter table dpg_control.leo543_scheduler_state owner to dpg_migration;
alter table dpg_control.leo543_scheduler_runs owner to dpg_migration;

alter table dpg_control.leo543_scheduler_config enable row level security;
alter table dpg_control.leo543_scheduler_config force row level security;
alter table dpg_control.leo543_scheduler_state enable row level security;
alter table dpg_control.leo543_scheduler_state force row level security;
alter table dpg_control.leo543_scheduler_runs enable row level security;
alter table dpg_control.leo543_scheduler_runs force row level security;

create policy leo543_config_migration on dpg_control.leo543_scheduler_config
  for all to dpg_migration using (true) with check (true);
create policy leo543_state_migration on dpg_control.leo543_scheduler_state
  for all to dpg_migration using (true) with check (true);
create policy leo543_runs_migration on dpg_control.leo543_scheduler_runs
  for all to dpg_migration using (true) with check (true);
create policy leo543_config_read on dpg_control.leo543_scheduler_config
  for select to dpg_readonly using (true);
create policy leo543_state_read on dpg_control.leo543_scheduler_state
  for select to dpg_readonly using (true);
create policy leo543_runs_read on dpg_control.leo543_scheduler_runs
  for select to dpg_readonly using (true);

revoke all on table dpg_control.leo543_scheduler_config,
  dpg_control.leo543_scheduler_state,
  dpg_control.leo543_scheduler_runs
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;

create or replace function dpg_control.leo543_scheduler_tick()
returns text
language plpgsql
security definer
set search_path = pg_catalog, dpg_control, extensions
as $$
declare
  v_config dpg_control.leo543_scheduler_config%rowtype;
  v_run dpg_control.leo543_scheduler_runs%rowtype;
  v_contract record;
  v_url text;
  v_token text;
  v_request_id bigint;
  v_status_code integer;
  v_timed_out boolean;
  v_error_msg text;
  v_content text;
  v_payload jsonb;
  v_result_code text;
  v_now timestamptz := clock_timestamp();
  v_slot timestamptz := date_trunc('minute', v_now);
  v_retry boolean;
  v_application_success boolean;
  v_write_freeze boolean;
  v_freshness numeric(12, 3);
begin
  select * into v_contract
  from dpg_control.target_contract
  where singleton;
  if v_contract is null
     or v_contract.project_name <> 'dongphugia-runtime'
     or v_contract.region <> 'ap-southeast-1'
     or v_contract.environment <> 'preview'
     or v_contract.production_writes_allowed then
    raise exception 'LEO543_TARGET_CONTRACT_FAILED';
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('dongphugia:leo543:scheduler-tick', 0)
  ) then
    return 'OVERLAPPING_TICK_SKIPPED';
  end if;

  select * into v_config
  from dpg_control.leo543_scheduler_config
  where singleton
  for update;

  update dpg_control.leo543_scheduler_state
  set last_tick_at = v_now, updated_at = v_now
  where singleton;

  -- A missing response after the bounded stale window is never treated as a
  -- success. It becomes an explicit retry or stale terminal state.
  update dpg_control.leo543_scheduler_runs
  set status = case
        when attempt < v_config.max_attempts then 'retry_wait'
        else 'stale'
      end,
      next_attempt_at = case
        when attempt < v_config.max_attempts
          then v_now + (greatest(v_config.retry_backoff_seconds, 15)::text || ' seconds')::interval
        else null
      end,
      last_observed_at = v_now,
      error_code = 'STALE_RUN_RECOVERY',
      updated_at = v_now
  where status = 'dispatched'
    and coalesce(last_observed_at, dispatch_started_at, created_at)
      < v_now - (v_config.stale_after_seconds::text || ' seconds')::interval;

  if not v_config.enabled then
    update dpg_control.leo543_scheduler_state
    set last_result_code = 'SCHEDULER_DISABLED',
        last_error_code = null,
        updated_at = v_now
    where singleton;
    return 'SCHEDULER_DISABLED';
  end if;

  -- pg_net and Vault are optional at migration time. The endpoint is a
  -- non-secret, Owner-reviewed control value; only the existing approved
  -- scheduler token is read from Vault. Missing capability is observable and
  -- fail-closed, never an anonymous request or a guessed endpoint.
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
     or to_regclass('net._http_response') is null
     or to_regclass('vault.decrypted_secrets') is null
     or v_config.endpoint_url is null then
    update dpg_control.leo543_scheduler_state
    set last_result_code = 'CONFIGURATION_BLOCKED',
        last_error_code = 'PG_NET_OR_VAULT_UNAVAILABLE',
        updated_at = v_now
    where singleton;
    return 'CONFIGURATION_BLOCKED';
  end if;

  begin
    execute $sql$
      select
        max(decrypted_secret) filter (where name = 'leo543_scheduler_token')
      from vault.decrypted_secrets
      where name = 'leo543_scheduler_token'
    $sql$ into v_token;
  exception when others then
    v_token := null;
  end;

  v_url := v_config.endpoint_url;

  if v_url is null
     or v_token is null
     or length(v_token) < 32
     or length(v_token) > 256
     or v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^?#]*)?$' then
    update dpg_control.leo543_scheduler_state
    set last_result_code = 'CONFIGURATION_BLOCKED',
        last_error_code = 'SCHEDULER_ENDPOINT_NOT_CONFIGURED',
        updated_at = v_now
    where singleton;
    return 'CONFIGURATION_BLOCKED';
  end if;

  -- Reconcile completed pg_net responses without retaining response bodies.
  -- Only bounded status/count fields are copied to the sanitized ledger.
  for v_run in
    select *
    from dpg_control.leo543_scheduler_runs
    where status = 'dispatched' and pg_net_request_id is not null
    order by slot_at
    for update skip locked
  loop
    v_status_code := null;
    v_timed_out := false;
    v_error_msg := null;
    v_content := null;
    begin
      execute
        'select status_code, timed_out, error_msg, content from net._http_response where id = $1'
        into v_status_code, v_timed_out, v_error_msg, v_content
        using v_run.pg_net_request_id;
    exception when undefined_table or insufficient_privilege then
      v_status_code := null;
    end;

    if v_status_code is null and not v_timed_out and v_error_msg is null then
      continue;
    end if;

    v_payload := null;
    begin
      v_payload := nullif(v_content, '')::jsonb;
    exception when others then
      v_payload := null;
    end;
    v_retry := coalesce(v_status_code, 0) not between 200 and 299
      and v_run.attempt < v_config.max_attempts;
    v_freshness := round(
      extract(epoch from (v_now - v_run.slot_at))::numeric,
      3
    );
    v_result_code := case
      when v_payload ->> 'result_code' in ('SUCCESS', 'WRITE_FREEZE_ACTIVE')
        then v_payload ->> 'result_code'
      when v_status_code between 200 and 299 then 'UNEXPECTED_RESPONSE'
      else 'HTTP_FAILURE'
    end;
    v_application_success := v_status_code between 200 and 299
      and v_result_code = 'SUCCESS';
    v_write_freeze := v_status_code between 200 and 299
      and v_result_code = 'WRITE_FREEZE_ACTIVE';

    update dpg_control.leo543_scheduler_runs
    set status = case when v_retry then 'retry_wait'
                      when v_application_success then 'succeeded'
                      when v_write_freeze then 'blocked'
                      else 'failed' end,
        next_attempt_at = case when v_retry
          then v_now + (greatest(v_config.retry_backoff_seconds * v_run.attempt, 15)::text || ' seconds')::interval
          else null end,
        last_observed_at = v_now,
        completed_at = case when v_retry then null else v_now end,
        response_status = v_status_code,
        result_code = v_result_code,
        processed_count = case when coalesce(v_payload ->> 'processed_count', '') ~ '^[0-9]+$'
          then (v_payload ->> 'processed_count')::integer else 0 end,
        published_count = case when coalesce(v_payload ->> 'published_count', '') ~ '^[0-9]+$'
          then (v_payload ->> 'published_count')::integer else 0 end,
        blocked_count = case when coalesce(v_payload ->> 'blocked_count', '') ~ '^[0-9]+$'
          then (v_payload ->> 'blocked_count')::integer else 0 end,
        freshness_seconds = case when v_application_success then v_freshness else null end,
        error_code = case when v_retry then 'HTTP_RETRY_SCHEDULED'
                          when v_application_success then null
                          when v_write_freeze then 'WRITE_FREEZE_ACTIVE'
                          when v_status_code between 200 and 299 then 'UNEXPECTED_RESPONSE'
                          else 'HTTP_REQUEST_FAILED' end,
        updated_at = v_now
    where run_id = v_run.run_id;

    update dpg_control.leo543_scheduler_state
    set last_run_id = v_run.run_id,
        last_result_code = case when v_retry then 'RETRY_SCHEDULED' else v_result_code end,
        last_error_code = case when v_retry then 'HTTP_RETRY_SCHEDULED'
                               when v_application_success then null
                               when v_write_freeze then 'WRITE_FREEZE_ACTIVE'
                               when v_status_code between 200 and 299 then 'UNEXPECTED_RESPONSE'
                               else 'HTTP_REQUEST_FAILED' end,
        last_success_at = case when v_application_success then v_now else last_success_at end,
        last_freshness_seconds = case when v_application_success then v_freshness else last_freshness_seconds end,
        last_published_count = case when v_retry then last_published_count
                                    when coalesce(v_payload ->> 'published_count', '') ~ '^[0-9]+$'
                                      then (v_payload ->> 'published_count')::integer
                                    else 0 end,
        updated_at = v_now
    where singleton;
  end loop;

  if not exists (
    select 1
    from dpg_control.leo543_scheduler_runs
    where slot_at = v_slot
  ) and (select count(*) from dpg_control.leo543_scheduler_runs)
      >= v_config.max_ledger_rows then
    update dpg_control.leo543_scheduler_state
    set last_result_code = 'LEDGER_LIMIT_REACHED',
        last_error_code = 'LEDGER_RETENTION_OWNER_DECISION_REQUIRED',
        updated_at = v_now
    where singleton;
    return 'LEDGER_LIMIT_REACHED';
  end if;

  -- No automatic deletion is performed. This guard stops before ledger growth
  -- can cross the configured row budget; retention is an explicit Owner gate.
  perform dpg_control.assert_free_tier_headroom(4096);
  insert into dpg_control.leo543_scheduler_runs (run_id, slot_at, next_attempt_at)
  values (gen_random_uuid(), v_slot, v_now)
  on conflict (slot_at) do nothing;

  select * into v_run
  from dpg_control.leo543_scheduler_runs
  where status in ('pending', 'retry_wait')
    and coalesce(next_attempt_at, v_now) <= v_now
  order by slot_at, created_at
  limit 1
  for update skip locked;

  if not found then
    return 'NO_DISPATCH_DUE';
  end if;

  begin
    execute
      'select net.http_post($1, $2, ''{}''::jsonb, $3, 5000)'
      into v_request_id
      using v_url,
        jsonb_build_object('source', 'leo543', 'run_id', v_run.run_id, 'slot_at', v_run.slot_at),
        jsonb_build_object(
          'Content-Type', 'application/json',
          'x-publishing-scheduler-token', v_token
        );
    if v_request_id is null then
      raise exception 'PG_NET_REQUEST_ID_MISSING';
    end if;
  exception when others then
    update dpg_control.leo543_scheduler_runs
    set attempt = attempt + 1,
        status = case when attempt + 1 < v_config.max_attempts then 'retry_wait' else 'failed' end,
        next_attempt_at = case when attempt + 1 < v_config.max_attempts
          then v_now + (greatest(v_config.retry_backoff_seconds * greatest(attempt + 1, 1), 15)::text || ' seconds')::interval
          else null end,
        last_observed_at = v_now,
        error_code = case when attempt + 1 < v_config.max_attempts then 'DISPATCH_RETRY_SCHEDULED' else 'DISPATCH_FAILED' end,
        completed_at = case when attempt + 1 < v_config.max_attempts then null else v_now end,
        updated_at = v_now
    where run_id = v_run.run_id;
    update dpg_control.leo543_scheduler_state
    set last_run_id = v_run.run_id,
        last_result_code = 'DISPATCH_FAILED',
        last_error_code = 'DISPATCH_FAILED',
        updated_at = v_now
    where singleton;
    return 'DISPATCH_FAILED';
  end;

  update dpg_control.leo543_scheduler_runs
  set status = 'dispatched',
      attempt = attempt + 1,
      pg_net_request_id = v_request_id,
      dispatch_started_at = v_now,
      last_observed_at = v_now,
      next_attempt_at = null,
      error_code = null,
      updated_at = v_now
  where run_id = v_run.run_id;

  update dpg_control.leo543_scheduler_state
  set last_run_id = v_run.run_id,
      last_dispatch_at = v_now,
      last_result_code = 'DISPATCHED',
      last_error_code = null,
      updated_at = v_now
  where singleton;

  return 'DISPATCHED';
end
$$;

create or replace function dpg_control.leo543_scheduler_report()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, dpg_control, extensions
as $$
  select jsonb_build_object(
    'scheduler_enabled', config.enabled,
    'schedule', config.schedule,
    'last_tick_at', state.last_tick_at,
    'last_dispatch_at', state.last_dispatch_at,
    'last_success_at', state.last_success_at,
    'last_result_code', state.last_result_code,
    'last_error_code', state.last_error_code,
    'last_freshness_seconds', state.last_freshness_seconds,
    'last_published_count', state.last_published_count,
    'latest_run', (
      select jsonb_build_object(
        'run_id', run.run_id,
        'slot_at', run.slot_at,
        'status', run.status,
        'attempt', run.attempt,
        'response_status', run.response_status,
        'result_code', run.result_code,
        'freshness_seconds', run.freshness_seconds,
        'published_count', run.published_count,
        'blocked_count', run.blocked_count,
        'error_code', run.error_code
      )
      from dpg_control.leo543_scheduler_runs run
      order by run.slot_at desc
      limit 1
    )
  )
  from dpg_control.leo543_scheduler_config config
  cross join dpg_control.leo543_scheduler_state state
  where config.singleton and state.singleton
$$;

create or replace function dpg_control.leo543_publishing_freshness_rows(
  p_limit integer default 100
)
returns table (
  run_id uuid,
  slot_at timestamptz,
  completed_at timestamptz,
  response_status integer,
  result_code text,
  freshness_seconds numeric(12, 3),
  processed_count integer,
  published_count integer,
  blocked_count integer
)
language sql
stable
security definer
set search_path = pg_catalog, dpg_control, extensions
as $$
  select
    run.run_id,
    run.slot_at,
    run.completed_at,
    run.response_status,
    run.result_code,
    run.freshness_seconds,
    run.processed_count,
    run.published_count,
    run.blocked_count
  from dpg_control.leo543_scheduler_runs run
  where run.status = 'succeeded'
  order by run.completed_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 100)
$$;

create view dpg_control.leo543_publishing_freshness
with (security_invoker = true)
as
select *
from dpg_control.leo543_publishing_freshness_rows(100);

comment on view dpg_control.leo543_publishing_freshness is
  'Sanitized scheduler transport freshness. Public URL/browser freshness requires separate exact-candidate validation.';

alter function dpg_control.leo543_scheduler_tick() owner to dpg_migration;
alter function dpg_control.leo543_scheduler_report() owner to dpg_migration;
alter function dpg_control.leo543_publishing_freshness_rows(integer) owner to dpg_migration;
alter view dpg_control.leo543_publishing_freshness owner to dpg_migration;

revoke all on function dpg_control.leo543_scheduler_tick()
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
revoke all on function dpg_control.leo543_scheduler_report()
  from public, anon, authenticated, service_role, dpg_runtime;
revoke all on function dpg_control.leo543_publishing_freshness_rows(integer)
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
revoke all on dpg_control.leo543_publishing_freshness
  from public, anon, authenticated, service_role, dpg_runtime;
grant execute on function dpg_control.leo543_scheduler_tick() to dpg_migration;
grant execute on function dpg_control.leo543_scheduler_report() to dpg_readonly, dpg_migration;
grant execute on function dpg_control.leo543_publishing_freshness_rows(integer) to dpg_readonly, dpg_migration;
grant select on dpg_control.leo543_publishing_freshness to dpg_readonly;

-- If pg_cron is already installed, keep the repository-owned job present but
-- inactive. Activation remains an exact Owner gate after current target,
-- budget, URL, Vault, and endpoint acceptance have been revalidated.
do $$
declare
  v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute 'select cron.schedule($1, $2, $3)'
      into v_job_id
      using
        'leo543-publishing-scheduler',
        '* * * * *',
        'select dpg_control.leo543_scheduler_tick();';
    execute 'select cron.alter_job($1, active => false)' using v_job_id;
  end if;
end
$$;

commit;
