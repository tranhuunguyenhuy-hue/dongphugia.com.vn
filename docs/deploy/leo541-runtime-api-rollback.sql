-- LEO-541 rollback for the exact isolated dongphugia-runtime target only.
-- This is safe only before activation and only when the preflight confirms
-- that no committed owner/runtime rows depend on the LEO-541 objects.

begin;
set search_path = pg_catalog, dpg_app, public;

do $preflight$
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
  ) then
    raise exception 'LEO-541 rollback target contract mismatch';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'dpg_app' and table_name = 'orders' and column_name = 'owner_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'dpg_app' and table_name = 'quote_requests' and column_name = 'owner_id'
  ) or to_regclass('dpg_app.runtime_idempotency_records') is null
     or to_regclass('dpg_app.runtime_audit_events') is null then
    raise exception 'LEO-541 rollback requires the exact applied schema';
  end if;

  if exists (select 1 from dpg_app.orders where owner_id is not null)
     or exists (select 1 from dpg_app.quote_requests where owner_id is not null)
     or exists (select 1 from dpg_app.runtime_idempotency_records)
     or exists (select 1 from dpg_app.runtime_audit_events)
     or exists (
       select 1 from dpg_app.quote_items
       where product_sku_snapshot is not null
          or product_name_snapshot is not null
          or commerce_mode_snapshot is not null
          or availability_snapshot is not null
          or list_price_snapshot is not null
          or sale_price_snapshot is not null
          or snapshot_at is not null
     ) then
    raise exception 'LEO-541 rollback blocked by committed runtime data';
  end if;
end
$preflight$;

drop function public.runtime_order_create(jsonb,text,uuid);
drop function public.runtime_order_get(integer);
drop function public.runtime_order_list(integer,integer);
drop function public.runtime_order_update(integer,jsonb,text,uuid);
drop function public.runtime_order_delete(integer,text,uuid);
drop function public.runtime_quote_create(jsonb,text,uuid);
drop function public.runtime_quote_get(integer);
drop function public.runtime_quote_list(integer,integer);
drop function public.runtime_quote_update(integer,jsonb,text,uuid);
drop function public.runtime_quote_delete(integer,text,uuid);

set role dpg_migration;

drop function dpg_app.runtime_hash(jsonb);
drop function dpg_app.runtime_key_hash(text);

drop policy leo541_orders_select_own on dpg_app.orders;
drop policy leo541_orders_insert_own on dpg_app.orders;
drop policy leo541_orders_update_own on dpg_app.orders;
drop policy leo541_orders_delete_own on dpg_app.orders;
drop policy leo541_order_items_select_own on dpg_app.order_items;
drop policy leo541_order_items_insert_own on dpg_app.order_items;
drop policy leo541_order_items_update_own on dpg_app.order_items;
drop policy leo541_order_items_delete_own on dpg_app.order_items;
drop policy leo541_quotes_select_own on dpg_app.quote_requests;
drop policy leo541_quotes_insert_own on dpg_app.quote_requests;
drop policy leo541_quotes_update_own on dpg_app.quote_requests;
drop policy leo541_quotes_delete_own on dpg_app.quote_requests;
drop policy leo541_quote_items_select_own on dpg_app.quote_items;
drop policy leo541_quote_items_insert_own on dpg_app.quote_items;
drop policy leo541_quote_items_update_own on dpg_app.quote_items;
drop policy leo541_quote_items_delete_own on dpg_app.quote_items;
drop policy leo541_products_select_public on dpg_app.products;

revoke select, insert, update, delete on table dpg_app.orders,
  dpg_app.order_items, dpg_app.quote_requests, dpg_app.quote_items
  from authenticated;
revoke select on table dpg_app.products from authenticated;
revoke usage, select on sequence dpg_app.orders_id_seq,
  dpg_app.order_items_id_seq, dpg_app.quote_requests_id_seq,
  dpg_app.quote_items_id_seq, dpg_app.runtime_audit_events_id_seq
  from authenticated;

drop table dpg_app.runtime_idempotency_records;
drop table dpg_app.runtime_audit_events;
drop index dpg_app.idx_orders_owner_created;
drop index dpg_app.idx_quote_requests_owner_created;
alter table dpg_app.orders drop column owner_id;
alter table dpg_app.quote_requests drop column owner_id;
alter table dpg_app.quote_items
  drop column product_sku_snapshot,
  drop column product_name_snapshot,
  drop column commerce_mode_snapshot,
  drop column availability_snapshot,
  drop column list_price_snapshot,
  drop column sale_price_snapshot,
  drop column snapshot_at;

reset role;
commit;
