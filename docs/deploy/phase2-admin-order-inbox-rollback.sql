-- Source-only rollback for Phase 2 Admin order inbox.
-- Run only after fresh target attestation, backup, and restore rehearsal.
-- Run before the guest-intake rollback. This refuses to erase status/audit
-- evidence and restores the exact pre-migration table privilege.

do $rollback_preflight$
begin
  if to_regclass('dpg_control.target_contract') is null
     or not exists (
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
         and pg_database_size(current_database()) <= hard_database_ceiling_bytes
     ) then
    raise exception 'DPG_PHASE2_ADMIN_ROLLBACK_TARGET_CONTRACT_FAILED';
  end if;

  if to_regprocedure('public.phase2_admin_staff_context()') is null
     or to_regprocedure('public.phase2_admin_order_list(text,integer,integer)') is null
     or to_regprocedure('public.phase2_admin_order_get(integer)') is null
     or to_regprocedure('public.phase2_admin_order_update_status(integer,text,text,uuid)') is null
     or to_regprocedure('dpg_app.phase2_guard_order_status_update()') is null
     or not exists (
       select 1 from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app' and c.relname = 'orders'
         and t.tgname = 'phase2_order_status_guard'
         and not t.tgisinternal and t.tgenabled = 'O'
     )
     or to_regclass('dpg_app.phase2_admin_order_status_idempotency') is null then
    raise exception 'DPG_PHASE2_ADMIN_ROLLBACK_SCHEMA_MISMATCH';
  end if;

  if exists (select 1 from dpg_app.phase2_admin_order_status_idempotency)
     or exists (
       select 1 from dpg_app.audit_logs
       where action = 'phase2.order.status.updated'
     )
     or exists (
       select 1 from dpg_app.orders
       where order_origin = 'public_web' and status <> 'pending'
     ) then
    raise exception 'DPG_PHASE2_ADMIN_ROLLBACK_EVIDENCE_PRESENT';
  end if;
end
$rollback_preflight$;

set role dpg_migration;
drop trigger phase2_order_status_guard on dpg_app.orders;
drop function dpg_app.phase2_guard_order_status_update();
drop function public.phase2_admin_order_update_status(integer,text,text,uuid);
drop function public.phase2_admin_order_get(integer);
drop function public.phase2_admin_order_list(text,integer,integer);
drop function public.phase2_admin_staff_context();

drop policy phase2_admin_order_status_idempotency_all
  on dpg_app.phase2_admin_order_status_idempotency;
drop table dpg_app.phase2_admin_order_status_idempotency;

revoke update (status, updated_at, payment_status, assigned_to, internal_note) on table dpg_app.orders from authenticated;
grant update on table dpg_app.orders to authenticated;
reset role;

do $rollback_postflight$
begin
  if to_regprocedure('public.phase2_admin_order_update_status(integer,text,text,uuid)') is not null
     or to_regprocedure('dpg_app.phase2_guard_order_status_update()') is not null
     or to_regclass('dpg_app.phase2_admin_order_status_idempotency') is not null
     or not has_table_privilege('authenticated', 'dpg_app.orders', 'UPDATE') then
    raise exception 'DPG_PHASE2_ADMIN_ROLLBACK_POSTFLIGHT_FAILED';
  end if;
end
$rollback_postflight$;
