-- Source-only rollback for the Phase 2 guest order-request migration.
-- Run only against the exact Preview target after a fresh backup and restore
-- rehearsal. This refuses to remove any persisted Phase 2 data.

do $phase2_rollback_preflight$
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
    raise exception 'DPG_PHASE2_ROLLBACK_TARGET_CONTRACT_FAILED';
  end if;

  if to_regprocedure('public.guest_order_request_create(jsonb,text,uuid)') is null
     or to_regclass('dpg_app.guest_order_idempotency_records') is null
     or to_regclass('dpg_app.guest_order_rate_limit_windows') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'orders' and column_name = 'order_origin'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'order_items' and column_name = 'commercial_snapshot'
     ) then
    raise exception 'DPG_PHASE2_ROLLBACK_SCHEMA_MISMATCH';
  end if;

  if exists (select 1 from dpg_app.orders where order_origin is not null)
     or exists (
       select 1 from dpg_app.order_items
       where commercial_snapshot <> '{}'::jsonb
     )
     or exists (select 1 from dpg_app.guest_order_idempotency_records)
     or exists (select 1 from dpg_app.guest_order_rate_limit_windows) then
    raise exception 'DPG_PHASE2_ROLLBACK_DATA_PRESENT';
  end if;
end
$phase2_rollback_preflight$;

set role dpg_migration;

drop function public.guest_order_request_create(jsonb, text, uuid);

drop policy phase2_guest_products_select_public on dpg_app.products;
drop policy phase2_guest_orders_insert_pending on dpg_app.orders;
drop policy phase2_guest_order_items_insert on dpg_app.order_items;
drop policy phase2_guest_idempotency_all on dpg_app.guest_order_idempotency_records;
drop policy phase2_guest_rate_limit_all on dpg_app.guest_order_rate_limit_windows;

drop table dpg_app.guest_order_idempotency_records;
drop table dpg_app.guest_order_rate_limit_windows;

alter table dpg_app.orders drop constraint phase2_order_origin_check;
alter table dpg_app.orders drop column order_origin;
alter table dpg_app.order_items drop column commercial_snapshot;

reset role;
