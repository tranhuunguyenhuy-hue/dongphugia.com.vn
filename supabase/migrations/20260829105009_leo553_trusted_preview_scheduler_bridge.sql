-- LEO-553: trusted Preview-only publishing scheduler bridge.
-- Source-only and disabled until the endpoint, GitHub dispatch credential,
-- and fixed Preview refresh gate receive separate Owner approval.

begin;

do $$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO553_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

create table dpg_control.leo553_scheduler_runs (
  run_id uuid primary key,
  slot_at timestamptz not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'blocked', 'failed')),
  result_code text,
  processed_count integer not null default 0 check (processed_count between 0 and 100),
  published_count integer not null default 0 check (published_count between 0 and 100),
  blocked_count integer not null default 0 check (blocked_count between 0 and 100),
  refresh_status text not null default 'not_required'
    check (refresh_status in ('not_required', 'pending', 'dispatching', 'dispatched', 'failed')),
  refresh_error_code text,
  safe_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leo553_scheduler_counts_bounded
    check (published_count + blocked_count <= processed_count)
);

alter table dpg_control.leo553_scheduler_runs owner to dpg_migration;
alter table dpg_control.leo553_scheduler_runs enable row level security;
alter table dpg_control.leo553_scheduler_runs force row level security;
create policy leo553_runs_migration on dpg_control.leo553_scheduler_runs
  for all to dpg_migration using (true) with check (true);
create policy leo553_runs_read on dpg_control.leo553_scheduler_runs
  for select to dpg_readonly using (true);
revoke all on table dpg_control.leo553_scheduler_runs
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant select on table dpg_control.leo553_scheduler_runs to dpg_readonly;

-- The SECURITY DEFINER scheduler runs as dpg_migration. Forced RLS remains in
-- effect, so grant only the reads and transition shapes used by this bridge.
create policy leo553_scheduler_control_read on dpg_app.publishing_global_controls
  for select to dpg_migration using (id = 1);
create policy leo553_scheduler_identity_read on dpg_app.publishing_machine_identities
  for select to dpg_migration using (true);
create policy leo553_scheduler_capability_read on dpg_app.publishing_identity_capabilities
  for select to dpg_migration using (capability = 'posts:publish');
create policy leo553_scheduler_category_read on dpg_app.blog_categories
  for select to dpg_migration using (true);
create policy leo553_scheduler_tag_read on dpg_app.blog_tags
  for select to dpg_migration using (true);
create policy leo553_scheduler_post_tag_read on dpg_app.blog_post_tags
  for select to dpg_migration using (true);
create policy leo553_scheduler_media_read on dpg_app.publishing_managed_media
  for select to dpg_migration using (true);
create policy leo553_scheduler_post_media_read on dpg_app.publishing_blog_post_media
  for select to dpg_migration using (true);
create policy leo553_scheduler_post_read on dpg_app.blog_posts
  for select to dpg_migration
  using (status = 'scheduled' and publishing_identity_id is not null);
create policy leo553_scheduler_post_transition on dpg_app.blog_posts
  for update to dpg_migration
  using (status = 'scheduled' and publishing_identity_id is not null)
  with check (status in ('published', 'schedule_blocked') and publishing_identity_id is not null);
create policy leo553_scheduler_state_read on dpg_app.publishing_scheduler_state
  for select to dpg_migration using (id = 1);
create policy leo553_scheduler_state_insert on dpg_app.publishing_scheduler_state
  for insert to dpg_migration with check (id = 1);
create policy leo553_scheduler_state_update on dpg_app.publishing_scheduler_state
  for update to dpg_migration using (id = 1) with check (id = 1);
create policy leo553_scheduler_audit_insert on dpg_app.publishing_audit_events
  for insert to dpg_migration
  with check (
    actor_kind = 'scheduler'
    and identity_id is not null
    and request_id is not null
    and action in ('post.scheduled_published', 'post.schedule_blocked')
  );

create or replace function dpg_control.leo553_scheduler_token_matches(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, dpg_control, extensions, vault
as $$
declare
  v_matches boolean := false;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 256 then
    return false;
  end if;
  begin
    execute $sql$
      select coalesce(bool_or(
        digest(convert_to(decrypted_secret, 'UTF8'), 'sha256')
          = digest(convert_to($1, 'UTF8'), 'sha256')
      ), false)
      from vault.decrypted_secrets
      where name = 'leo543_scheduler_token'
    $sql$ into v_matches using p_token;
  exception when others then
    return false;
  end;
  return v_matches;
end
$$;

create or replace function dpg_control.leo553_scheduler_bridge_internal(
  p_run_id uuid,
  p_slot_at timestamptz,
  p_scheduler_token text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, dpg_app, dpg_control, extensions
as $$
declare
  v_existing dpg_control.leo553_scheduler_runs%rowtype;
  v_due record;
  v_post dpg_app.blog_posts%rowtype;
  v_identity dpg_app.publishing_machine_identities%rowtype;
  v_processed integer := 0;
  v_published integer := 0;
  v_blocked integer := 0;
  v_block_code text;
  v_response jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if not dpg_control.leo553_scheduler_token_matches(p_scheduler_token) then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_run_id is null or p_slot_at is null then
    raise exception 'INVALID_REQUEST';
  end if;
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO553_TARGET_CONTRACT_FAILED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('dongphugia:leo553:run:' || p_run_id::text, 0));
  select * into v_existing
  from dpg_control.leo553_scheduler_runs
  where run_id = p_run_id
  for update;
  if found then
    return v_existing.safe_response || jsonb_build_object(
      'refresh_required', v_existing.refresh_status = 'pending'
    );
  end if;

  if (select count(*) from dpg_control.leo553_scheduler_runs) >= 20000 then
    raise exception 'LEO553_LEDGER_LIMIT_REACHED';
  end if;
  perform dpg_control.assert_free_tier_headroom(4096);
  insert into dpg_control.leo553_scheduler_runs (run_id, slot_at)
  values (p_run_id, date_trunc('minute', p_slot_at));

  perform pg_advisory_xact_lock(hashtextextended('leo542:publishing-global-gate', 0));
  if not exists (
    select 1 from dpg_app.publishing_global_controls
    where id = 1 and publishing_enabled
  ) then
    v_response := jsonb_build_object(
      'result_code', 'WRITE_FREEZE_ACTIVE',
      'processed_count', 0,
      'published_count', 0,
      'blocked_count', 0
    );
    update dpg_control.leo553_scheduler_runs
    set status = 'blocked', result_code = 'WRITE_FREEZE_ACTIVE',
        safe_response = v_response, updated_at = v_now
    where run_id = p_run_id;
    return v_response || jsonb_build_object('refresh_required', false);
  end if;

  insert into dpg_app.publishing_scheduler_state (
    id, last_started_at, last_run_id, last_result_code, updated_at
  ) values (1, v_now, p_run_id, 'RUNNING', v_now)
  on conflict (id) do update set
    last_started_at = excluded.last_started_at,
    last_run_id = excluded.last_run_id,
    last_result_code = excluded.last_result_code,
    updated_at = excluded.updated_at;

  for v_due in
    select p.id, p.publishing_identity_id
    from dpg_app.blog_posts p
    where p.status = 'scheduled'
      and p.publishing_identity_id is not null
      and p.scheduled_for <= v_now
    order by p.scheduled_for, p.id
    limit 100
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('leo542:publishing-identity:' || v_due.publishing_identity_id::text, 0)
    );
    select * into v_post
    from dpg_app.blog_posts
    where id = v_due.id
      and status = 'scheduled'
      and publishing_identity_id = v_due.publishing_identity_id
      and scheduled_for <= v_now
    for update;
    if not found then
      continue;
    end if;
    v_processed := v_processed + 1;
    v_block_code := null;
    select * into v_identity
    from dpg_app.publishing_machine_identities
    where id = v_post.publishing_identity_id;

    if v_identity.id is null or not v_identity.is_active or v_identity.disabled_at is not null then
      v_block_code := 'IDENTITY_DISABLED';
    elsif not exists (
      select 1 from dpg_app.publishing_identity_capabilities c
      where c.identity_id = v_post.publishing_identity_id
        and c.capability = 'posts:publish'
        and c.revoked_at is null
    ) then
      v_block_code := 'PUBLISH_CAPABILITY_REVOKED';
    elsif v_post.scheduled_version is distinct from v_post.version then
      v_block_code := 'SCHEDULE_VERSION_STALE';
    elsif length(v_post.title) not between 10 and 120
      or length(coalesce(v_post.excerpt, '')) not between 50 and 300
      or length(trim(regexp_replace(v_post.content, '<[^>]*>', ' ', 'g'))) < 300
      or not exists (
        select 1 from dpg_app.blog_categories c
        where c.id = v_post.category_id and c.is_active
      )
      or exists (
        select 1
        from dpg_app.blog_post_tags pt
        join dpg_app.blog_tags t on t.id = pt.tag_id
        where pt.post_id = v_post.id and not t.is_active
      )
      or not exists (
        select 1
        from dpg_app.publishing_blog_post_media pm
        join dpg_app.publishing_managed_media m on m.id = pm.media_id
        where pm.post_id = v_post.id and pm.usage = 'thumbnail'
          and m.identity_id = v_post.publishing_identity_id
          and m.status = 'ready' and m.primary_url = v_post.thumbnail_url
      )
      or not exists (
        select 1
        from dpg_app.publishing_blog_post_media pm
        join dpg_app.publishing_managed_media m on m.id = pm.media_id
        where pm.post_id = v_post.id and pm.usage = 'cover'
          and m.identity_id = v_post.publishing_identity_id
          and m.status = 'ready' and m.primary_url = v_post.cover_image_url
      )
      or exists (
        select 1
        from dpg_app.publishing_blog_post_media pm
        join dpg_app.publishing_managed_media m on m.id = pm.media_id
        where pm.post_id = v_post.id
          and (m.identity_id <> v_post.publishing_identity_id or m.status <> 'ready')
      )
    then
      v_block_code := 'PUBLICATION_NOT_READY';
    end if;

    if v_block_code is null then
      update dpg_app.blog_posts
      set status = 'published',
          published_at = v_now,
          first_published_at = coalesce(first_published_at, v_now),
          scheduled_for = null,
          scheduled_timezone = null,
          scheduled_version = null,
          schedule_blocked_code = null,
          schedule_blocked_at = null,
          schedule_last_attempt_at = v_now,
          version = version + 1,
          updated_at = v_now
      where id = v_post.id and status = 'scheduled' and version = v_post.version;
      if found then
        v_published := v_published + 1;
        insert into dpg_app.publishing_audit_events (
          actor_kind, identity_id, sponsor_user_id, action, post_id, external_id,
          request_id, from_version, to_version, from_state, to_state,
          changed_fields, content_hash, metadata
        ) values (
          'scheduler', v_post.publishing_identity_id, v_identity.sponsor_user_id,
          'post.scheduled_published', v_post.id, v_post.external_id, p_run_id,
          v_post.version, v_post.version + 1, 'scheduled', 'published',
          array['status', 'published_at'],
          encode(digest(convert_to(v_post.content, 'UTF8'), 'sha256'), 'hex'),
          jsonb_build_object('schedule_run_id', p_run_id)
        );
      end if;
    else
      update dpg_app.blog_posts
      set status = 'schedule_blocked',
          scheduled_version = null,
          schedule_blocked_code = v_block_code,
          schedule_blocked_at = v_now,
          schedule_last_attempt_at = v_now,
          version = version + 1,
          updated_at = v_now
      where id = v_post.id and status = 'scheduled' and version = v_post.version;
      if found then
        v_blocked := v_blocked + 1;
        insert into dpg_app.publishing_audit_events (
          actor_kind, identity_id, sponsor_user_id, action, post_id, external_id,
          request_id, from_version, to_version, from_state, to_state,
          changed_fields, content_hash, metadata
        ) values (
          'scheduler', v_post.publishing_identity_id, v_identity.sponsor_user_id,
          'post.schedule_blocked', v_post.id, v_post.external_id, p_run_id,
          v_post.version, v_post.version + 1, 'scheduled', 'schedule_blocked',
          array['status', 'schedule_blocked_code'],
          encode(digest(convert_to(v_post.content, 'UTF8'), 'sha256'), 'hex'),
          jsonb_build_object('schedule_run_id', p_run_id, 'block_code', v_block_code)
        );
      end if;
    end if;
  end loop;

  v_response := jsonb_build_object(
    'result_code', 'SUCCESS',
    'processed_count', v_processed,
    'published_count', v_published,
    'blocked_count', v_blocked
  );
  update dpg_app.publishing_scheduler_state
  set last_completed_at = v_now,
      last_success_at = v_now,
      last_result_code = 'SUCCESS',
      last_processed_count = v_processed,
      last_published_count = v_published,
      last_blocked_count = v_blocked,
      updated_at = v_now
  where id = 1;
  update dpg_control.leo553_scheduler_runs
  set status = 'completed', result_code = 'SUCCESS',
      processed_count = v_processed, published_count = v_published,
      blocked_count = v_blocked,
      refresh_status = case when v_published > 0 then 'pending' else 'not_required' end,
      safe_response = v_response, updated_at = v_now
  where run_id = p_run_id;
  return v_response || jsonb_build_object('refresh_required', v_published > 0);
end
$$;

create or replace function public.leo553_scheduler_bridge(
  p_run_id uuid,
  p_slot_at timestamptz,
  p_scheduler_token text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, dpg_control
as $$
  select dpg_control.leo553_scheduler_bridge_internal($1, $2, $3)
$$;

create or replace function public.leo553_claim_preview_refresh(
  p_run_id uuid,
  p_scheduler_token text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, dpg_control
as $$
begin
  if not dpg_control.leo553_scheduler_token_matches(p_scheduler_token) then
    raise exception 'UNAUTHORIZED';
  end if;
  update dpg_control.leo553_scheduler_runs
  set refresh_status = 'dispatching', updated_at = clock_timestamp()
  where run_id = p_run_id and refresh_status = 'pending' and published_count > 0;
  return found;
end
$$;

create or replace function public.leo553_complete_preview_refresh(
  p_run_id uuid,
  p_scheduler_token text,
  p_succeeded boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, dpg_control
as $$
begin
  if not dpg_control.leo553_scheduler_token_matches(p_scheduler_token) then
    raise exception 'UNAUTHORIZED';
  end if;
  update dpg_control.leo553_scheduler_runs
  set refresh_status = case when p_succeeded then 'dispatched' else 'failed' end,
      refresh_error_code = case when p_succeeded then null else 'GITHUB_DISPATCH_FAILED' end,
      updated_at = clock_timestamp()
  where run_id = p_run_id and refresh_status = 'dispatching';
  return found;
end
$$;

alter function dpg_control.leo553_scheduler_token_matches(text) owner to dpg_migration;
alter function dpg_control.leo553_scheduler_bridge_internal(uuid,timestamptz,text) owner to dpg_migration;
alter function public.leo553_scheduler_bridge(uuid,timestamptz,text) owner to dpg_migration;
alter function public.leo553_claim_preview_refresh(uuid,text) owner to dpg_migration;
alter function public.leo553_complete_preview_refresh(uuid,text,boolean) owner to dpg_migration;

revoke all on function dpg_control.leo553_scheduler_token_matches(text),
  dpg_control.leo553_scheduler_bridge_internal(uuid,timestamptz,text),
  public.leo553_scheduler_bridge(uuid,timestamptz,text),
  public.leo553_claim_preview_refresh(uuid,text),
  public.leo553_complete_preview_refresh(uuid,text,boolean)
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant execute on function public.leo553_scheduler_bridge(uuid,timestamptz,text),
  public.leo553_claim_preview_refresh(uuid,text),
  public.leo553_complete_preview_refresh(uuid,text,boolean)
  to anon;

commit;
