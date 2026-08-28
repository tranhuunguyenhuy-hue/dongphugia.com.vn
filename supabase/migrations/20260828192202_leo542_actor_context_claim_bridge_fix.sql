-- LEO-542 Phase A corrective migration: resolve the authenticated JWT claim
-- directly inside the security-definer actor helper. No tables, policies,
-- grants, roles, or authority mappings are changed.

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
    raise exception 'LEO542_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

create or replace function dpg_app.leo542_actor_context()
returns table (
  actor_kind text,
  auth_user_id uuid,
  auth_session_id uuid,
  admin_id integer,
  admin_role text,
  machine_identity_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_claims jsonb := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    nullif(current_setting('request.jwt.claim', true), '')::jsonb,
    '{}'::jsonb
  );
  v_uid uuid := nullif(v_claims ->> 'sub', '')::uuid;
  v_session uuid := nullif(v_claims ->> 'session_id', '')::uuid;
  v_admin record;
  v_machine record;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED'; end if;

  select a.id, a.role into v_admin
  from dpg_app.admin_users a
  where a.supabase_auth_user_id = v_uid and a.is_active;

  select m.id into v_machine
  from dpg_app.publishing_machine_identities m
  where m.supabase_auth_user_id = v_uid and m.is_active and m.disabled_at is null;

  if v_admin.id is not null and v_machine.id is not null then
    raise exception 'FORBIDDEN_AMBIGUOUS_PRINCIPAL';
  elsif v_admin.id is not null then
    return query select 'admin'::text, v_uid, v_session, v_admin.id::integer, v_admin.role::text, null::uuid;
  elsif v_machine.id is not null then
    return query select 'machine'::text, v_uid, v_session, null::integer, null::text, v_machine.id::uuid;
  end if;

  raise exception 'FORBIDDEN_UNMAPPED_PRINCIPAL';
end
$$;

commit;
