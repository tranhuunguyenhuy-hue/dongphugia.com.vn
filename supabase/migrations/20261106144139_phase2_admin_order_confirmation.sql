-- Phase 2 Sales: persist a final commercial snapshot before staff confirms an
-- order request. The original guest receipt/order/item snapshots remain intact.

do $preflight$
begin
  if to_regclass('dpg_app.phase2_order_confirmations') is not null
     or to_regprocedure('public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)') is not null
     or to_regprocedure('public.phase2_admin_order_update_status(integer,text,text,uuid)') is null
     or to_regprocedure('public.phase2_admin_order_get(integer)') is null
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or not exists (
       select 1 from pg_catalog.pg_roles r where r.rolname = 'dpg_migration'
         and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit
     )
     or not exists (
       select 1 from pg_catalog.pg_roles r where r.rolname = 'dpg_migration_login'
         and not r.rolsuper and not r.rolbypassrls and r.rolcanlogin and not r.rolinherit
         and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
     )
     or exists (
       select 1 from pg_catalog.pg_auth_members m
       where m.member = 'dpg_migration'::regrole
          or (
            m.roleid = 'dpg_migration'::regrole
            and m.member not in ('postgres'::regrole, 'dpg_migration_login'::regrole)
          )
     )
     or not has_table_privilege('dpg_migration', 'dpg_app.orders', 'SELECT')
     or not has_table_privilege('dpg_migration', 'dpg_app.orders', 'UPDATE')
     or not has_table_privilege('dpg_migration', 'dpg_app.order_items', 'SELECT')
     or not has_table_privilege('dpg_migration', 'dpg_app.audit_logs', 'INSERT') then
    raise exception 'DPG_PHASE2_ORDER_CONFIRMATION_PREFLIGHT_FAILED';
  end if;
end
$preflight$;

set role dpg_migration;
set search_path = pg_catalog, dpg_app, public, auth;

create table dpg_app.phase2_order_confirmations (
  order_id integer primary key references dpg_app.orders(id),
  auth_user_id uuid not null,
  admin_id integer not null,
  request_id uuid not null unique,
  idempotency_key_hash char(64) not null,
  request_hash char(64) not null,
  base_total numeric(15,2) not null check (base_total >= 0),
  shipping_fee numeric(15,2) not null check (shipping_fee >= 0),
  installation_fees jsonb not null check (jsonb_typeof(installation_fees) = 'array'),
  confirmed_total numeric(15,2) not null check (confirmed_total >= 0),
  confirmed_at timestamptz not null default now(),
  unique (auth_user_id, idempotency_key_hash)
);

alter table dpg_app.phase2_order_confirmations owner to dpg_migration;
alter table dpg_app.phase2_order_confirmations enable row level security;
alter table dpg_app.phase2_order_confirmations force row level security;
revoke all on table dpg_app.phase2_order_confirmations
  from public, anon, authenticated, service_role;

-- The non-login migration role is the narrowly scoped owner of the trusted RPC.
-- FORCE RLS stays enabled; its policies permit only the RPC's transaction.
create policy phase2_order_confirmations_migration_all
  on dpg_app.phase2_order_confirmations
  for all to dpg_migration using (true) with check (true);
create policy phase2_order_confirmations_staff_select
  on dpg_app.phase2_order_confirmations
  for select to authenticated
  using (exists (
    select 1 from dpg_app.orders o where o.id = order_id
  ));
grant select (
  order_id, base_total, shipping_fee, installation_fees, confirmed_total, confirmed_at
) on table dpg_app.phase2_order_confirmations to authenticated;

-- The trusted RPC is SECURITY DEFINER only because authenticated staff must
-- not receive direct INSERT/UPDATE/DELETE on the immutable snapshot table.
-- The owner is NOLOGIN/NOBYPASSRLS; FORCE RLS and an explicit policy remain.
create policy phase2_order_confirmation_rpc_order_select
  on dpg_app.orders for select to dpg_migration using (order_origin = 'public_web');
create policy phase2_order_confirmation_rpc_order_update
  on dpg_app.orders for update to dpg_migration
  using (order_origin = 'public_web') with check (order_origin = 'public_web');
create policy phase2_order_confirmation_rpc_items_select
  on dpg_app.order_items for select to dpg_migration using (true);
create policy phase2_order_confirmation_rpc_audit_insert
  on dpg_app.audit_logs for insert to dpg_migration
  with check (action in ('phase2.order.status.updated', 'phase2.order.commercial.confirmed'));

reset role;
grant create on schema public to dpg_migration;
set role dpg_migration;
set search_path = pg_catalog, dpg_app, public, auth;

create or replace function dpg_app.phase2_guard_order_status_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_actor record;
  v_request_id text := nullif(current_setting('dpg.phase2.order_status_request_id', true), '');
  v_key_hash text := nullif(current_setting('dpg.phase2.order_status_key_hash', true), '');
begin
  if old.order_origin is distinct from 'public_web' and new.order_origin is distinct from 'public_web' then
    return new;
  end if;
  if old.order_origin is distinct from 'public_web' or new.order_origin is distinct from 'public_web' then
    raise exception 'INVALID_ORDER_ORIGIN_TRANSITION';
  end if;
  if new.payment_status is distinct from old.payment_status then
    raise exception 'PHASE2_PAYMENT_CONFIRMATION_OUT_OF_SCOPE';
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status in ('received', 'cancelled'))
    or (old.status = 'received' and new.status in ('confirmed', 'cancelled'))
    or (old.status = 'confirmed' and new.status in ('inventory_check', 'cancelled'))
    or (old.status = 'inventory_check' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'INVALID_ORDER_TRANSITION';
  end if;
  if new.status = 'confirmed' and not exists (
    select 1 from dpg_app.phase2_order_confirmations c where c.order_id = old.id
  ) then
    raise exception 'ORDER_COMMERCIAL_CONFIRMATION_REQUIRED';
  end if;
  if v_request_id is null
     or v_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_key_hash is null
     or v_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PHASE2_STATUS_RPC_REQUIRED';
  end if;

  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' or not dpg_app.leo542_admin_can('orders:update_status') then
    raise exception 'FORBIDDEN';
  end if;

  insert into dpg_app.audit_logs (
    user_id, action, entity_type, entity_id, auth_user_id, auth_session_id,
    request_id, idempotency_key_hash, changed_fields
  ) values (
    v_actor.admin_id, 'phase2.order.status.updated', 'order', new.id,
    v_actor.auth_user_id, v_actor.auth_session_id, v_request_id::uuid, v_key_hash, array['status']
  );
  return new;
end
$$;

create or replace function public.phase2_admin_order_get(p_order_id integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_app
as $$
declare
  v_order jsonb;
  v_items jsonb;
  v_confirmation jsonb;
begin
  select to_jsonb(x) into v_order
  from (
    select o.id, o.order_number, o.customer_name, o.customer_phone,
      o.customer_email, o.customer_address, o.note, o.status,
      o.payment_status, o.subtotal, o.discount, o.shipping_fee, o.shipping_fee_status, o.total,
      o.assigned_to, o.internal_note, o.created_at, o.updated_at
    from dpg_app.orders o
    where o.id = p_order_id and o.order_origin = 'public_web'
  ) x;
  if v_order is null then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb)
    into v_items
  from (
    select i.id, i.product_id, i.product_name, i.product_sku,
      i.quantity, i.unit_price, i.total_price, i.commercial_snapshot
    from dpg_app.order_items i
    where i.order_id = p_order_id
  ) x;

  select to_jsonb(x) into v_confirmation
  from (
    select c.base_total, c.shipping_fee, c.installation_fees,
      c.confirmed_total, c.confirmed_at
    from dpg_app.phase2_order_confirmations c
    where c.order_id = p_order_id
  ) x;

  return jsonb_build_object('order', v_order, 'items', v_items, 'confirmation', v_confirmation);
end
$$;

create or replace function public.phase2_admin_order_update_status(
  p_order_id integer,
  p_status text,
  p_idempotency_key text,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_actor record;
  v_key_hash char(64);
  v_request_hash char(64);
  v_existing dpg_app.phase2_admin_order_status_idempotency%rowtype;
  v_order dpg_app.orders%rowtype;
  v_response jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if p_order_id is null or p_order_id < 1 or p_request_id is null
     or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_status is null or p_status not in ('received', 'inventory_check', 'completed', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' or not dpg_app.leo542_admin_can('orders:update_status') then
    raise exception 'FORBIDDEN';
  end if;

  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  v_request_hash := dpg_app.runtime_hash(jsonb_build_object('order_id', p_order_id, 'status', p_status));
  perform pg_advisory_xact_lock(hashtextextended('phase2:admin-order-status:' || auth.uid()::text || ':' || v_key_hash, 0));

  with expired_keys as (
    select auth_user_id, key_hash from dpg_app.phase2_admin_order_status_idempotency
    where expires_at <= now() order by expires_at limit 100 for update skip locked
  )
  delete from dpg_app.phase2_admin_order_status_idempotency r
  using expired_keys e where r.auth_user_id = e.auth_user_id and r.key_hash = e.key_hash;

  select * into v_existing from dpg_app.phase2_admin_order_status_idempotency
  where auth_user_id = auth.uid() and key_hash = v_key_hash for update;
  if found then
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_existing.safe_response;
  end if;

  select * into v_order from dpg_app.orders
  where id = p_order_id and order_origin = 'public_web' for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not (
    (v_order.status = 'pending' and p_status in ('received', 'cancelled'))
    or (v_order.status = 'received' and p_status = 'cancelled')
    or (v_order.status = 'confirmed' and p_status in ('inventory_check', 'cancelled'))
    or (v_order.status = 'inventory_check' and p_status in ('completed', 'cancelled'))
  ) then raise exception 'INVALID_ORDER_TRANSITION'; end if;

  perform set_config('dpg.phase2.order_status_request_id', p_request_id::text, true);
  perform set_config('dpg.phase2.order_status_key_hash', v_key_hash, true);
  update dpg_app.orders set status = p_status, updated_at = now()
  where id = p_order_id returning * into v_order;

  v_response := jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'payment_status', v_order.payment_status,
    'updated_at', v_order.updated_at
  );
  insert into dpg_app.phase2_admin_order_status_idempotency (
    auth_user_id, key_hash, request_hash, safe_response, expires_at
  ) values (auth.uid(), v_key_hash, v_request_hash, v_response, now() + interval '24 hours');
  return v_response;
end
$$;

create function public.phase2_admin_order_confirm(
  p_order_id integer,
  p_shipping_fee bigint,
  p_installation_fees jsonb,
  p_idempotency_key text,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_auth_user_id uuid;
  v_key_hash text;
  v_request_hash text;
  v_order record;
  v_item record;
  v_input_line jsonb;
  v_normalized_request jsonb;
  v_install_fee bigint;
  v_installation_total numeric(15,2) := 0;
  v_installation_snapshot jsonb := '[]'::jsonb;
  v_confirmed_total numeric(15,2);
  v_existing dpg_app.phase2_order_confirmations%rowtype;
  v_response jsonb;
begin
  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin'
     or not dpg_app.leo542_admin_can('orders:update_status') then
    raise exception 'FORBIDDEN';
  end if;
  v_auth_user_id := v_actor.auth_user_id;

  if p_order_id is null or p_order_id < 1 or p_request_id is null
     or p_shipping_fee is null or p_shipping_fee < 0 or p_shipping_fee > 1000000000000
     or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 200
     or p_installation_fees is null then
    raise exception 'INVALID_INPUT';
  end if;
  if pg_catalog.jsonb_typeof(p_installation_fees) <> 'array' then
    raise exception 'INVALID_INSTALLATION_FEES';
  end if;
  if pg_catalog.jsonb_array_length(p_installation_fees) not between 1 and 50 then
    raise exception 'INVALID_INSTALLATION_FEES';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_installation_fees) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'object'
       or not (item.value ?& array['order_item_id', 'fee_per_unit'])
       or case when pg_catalog.jsonb_typeof(item.value) = 'object'
         then (select count(*) from pg_catalog.jsonb_object_keys(item.value)) <> 2
         else false end
       or coalesce(item.value ->> 'order_item_id', '') !~ '^[1-9][0-9]{0,9}$'
       or coalesce(item.value ->> 'fee_per_unit', '') !~ '^(0|[1-9][0-9]{0,12})$'
  ) or exists (
    select item.value ->> 'order_item_id'
    from pg_catalog.jsonb_array_elements(p_installation_fees) as item(value)
    group by item.value ->> 'order_item_id' having count(*) > 1
  ) then
    raise exception 'INVALID_INSTALLATION_FEES';
  end if;

  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  select coalesce(pg_catalog.jsonb_agg(item.value order by (item.value ->> 'order_item_id')::bigint), '[]'::jsonb)
    into v_normalized_request
  from pg_catalog.jsonb_array_elements(p_installation_fees) as item(value);
  v_request_hash := dpg_app.runtime_hash(pg_catalog.jsonb_build_object(
    'order_id', p_order_id, 'shipping_fee', p_shipping_fee,
    'installation_fees', v_normalized_request
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'phase2:admin-order-confirm:' || v_auth_user_id::text || ':' || v_key_hash, 0
  ));

  select * into v_order from dpg_app.orders
  where id = p_order_id and order_origin = 'public_web' for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not dpg_app.leo542_admin_can('orders:read')
     and not (dpg_app.leo542_admin_can('orders:read_assigned') and v_order.assigned_to = v_actor.admin_id) then
    raise exception 'RESOURCE_NOT_FOUND';
  end if;

  select * into v_existing from dpg_app.phase2_order_confirmations
  where auth_user_id = v_auth_user_id and idempotency_key_hash = v_key_hash for update;
  if found then
    if v_existing.order_id <> p_order_id or v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'order_id', v_existing.order_id, 'status', 'confirmed',
      'shipping_fee', v_existing.shipping_fee, 'installation_fees', v_existing.installation_fees,
      'base_total', v_existing.base_total, 'confirmed_total', v_existing.confirmed_total,
      'confirmed_at', v_existing.confirmed_at
    );
  end if;
  if exists (select 1 from dpg_app.phase2_order_confirmations c where c.order_id = p_order_id) then
    raise exception 'ORDER_ALREADY_CONFIRMED';
  end if;
  if v_order.status <> 'received' then raise exception 'INVALID_ORDER_TRANSITION'; end if;
  if v_order.total <> v_order.subtotal - v_order.discount then raise exception 'ORDER_TOTAL_SNAPSHOT_MISMATCH'; end if;
  if v_order.shipping_fee_status <> 'pending_confirmation' then raise exception 'SHIPPING_FEE_ALREADY_RESOLVED'; end if;

  if (select count(*) from dpg_app.order_items i where i.order_id = p_order_id) = 0
     or pg_catalog.jsonb_array_length(p_installation_fees) <> (
       select count(*) from dpg_app.order_items i where i.order_id = p_order_id
     ) then raise exception 'INSTALLATION_FEE_LINES_MISMATCH'; end if;

  for v_item in
    select i.id, i.quantity, i.product_sku, i.commercial_snapshot
    from dpg_app.order_items i where i.order_id = p_order_id order by i.id
  loop
    select item.value into v_input_line
    from pg_catalog.jsonb_array_elements(p_installation_fees) as item(value)
    where item.value ->> 'order_item_id' = v_item.id::text;
    if v_input_line is null then raise exception 'INSTALLATION_FEE_LINES_MISMATCH'; end if;
    v_install_fee := (v_input_line ->> 'fee_per_unit')::bigint;
    if v_install_fee > 1000000000000 then raise exception 'INVALID_INSTALLATION_FEES'; end if;
    if v_item.commercial_snapshot ->> 'install_option' not in ('none', 'install', 'replace')
       or (v_item.commercial_snapshot ->> 'install_option' = 'none' and v_install_fee <> 0) then
      raise exception 'INSTALLATION_FEE_CONFLICTS_WITH_ORDER_SNAPSHOT';
    end if;
    v_installation_total := v_installation_total + (v_item.quantity * v_install_fee);
    v_installation_snapshot := v_installation_snapshot || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'order_item_id', v_item.id,
        'product_sku', v_item.product_sku,
        'install_option', v_item.commercial_snapshot ->> 'install_option',
        'fee_per_unit', v_install_fee,
        'line_total', v_install_fee * v_item.quantity
      )
    );
  end loop;

  v_confirmed_total := v_order.total + p_shipping_fee + v_installation_total;
  if v_confirmed_total > 999999999999999 then raise exception 'CONFIRMED_TOTAL_OUT_OF_RANGE'; end if;
  insert into dpg_app.phase2_order_confirmations (
    order_id, auth_user_id, admin_id, request_id, idempotency_key_hash,
    request_hash, base_total, shipping_fee, installation_fees, confirmed_total
  ) values (
    p_order_id, v_auth_user_id, v_actor.admin_id, p_request_id, v_key_hash,
    v_request_hash, v_order.total, p_shipping_fee, v_installation_snapshot, v_confirmed_total
  ) returning * into v_existing;

  perform pg_catalog.set_config('dpg.phase2.order_status_request_id', p_request_id::text, true);
  perform pg_catalog.set_config('dpg.phase2.order_status_key_hash', v_key_hash, true);
  update dpg_app.orders set status = 'confirmed', updated_at = pg_catalog.now()
  where id = p_order_id;

  insert into dpg_app.audit_logs (
    user_id, action, entity_type, entity_id, auth_user_id, auth_session_id,
    request_id, idempotency_key_hash, changed_fields
  ) values (
    v_actor.admin_id, 'phase2.order.commercial.confirmed', 'order', p_order_id,
    v_auth_user_id, v_actor.auth_session_id, p_request_id, v_key_hash,
    array['confirmed_total', 'shipping_fee', 'installation_fees']
  );

  return pg_catalog.jsonb_build_object(
    'order_id', p_order_id, 'status', 'confirmed',
    'shipping_fee', p_shipping_fee, 'installation_fees', v_installation_snapshot,
    'base_total', v_order.total, 'confirmed_total', v_confirmed_total,
    'confirmed_at', v_existing.confirmed_at
  );
end
$$;

alter function public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid) owner to dpg_migration;
comment on function public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid) is
  'Authenticated staff RPC records one immutable final price/shipping/installation snapshot and transitions a received guest request to confirmed atomically.';
reset role;
revoke create on schema public from dpg_migration;

revoke all on function public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)
  from public, anon, service_role;
grant execute on function public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)
  to authenticated;

do $postflight$
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid = 'public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)'::regprocedure
      and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'dpg_migration'
      and p.proconfig @> array['search_path=""']::text[]
  ) or has_schema_privilege('dpg_migration', 'public', 'CREATE')
    or not exists (
      select 1 from pg_catalog.pg_roles r where r.rolname = 'dpg_migration'
        and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit
    )
    or exists (
      select 1 from pg_catalog.pg_auth_members m
      where m.member = 'dpg_migration'::regrole
         or (
           m.roleid = 'dpg_migration'::regrole
           and m.member not in ('postgres'::regrole, 'dpg_migration_login'::regrole)
         )
    )
    or has_table_privilege('anon', 'dpg_app.phase2_order_confirmations', 'SELECT')
    or has_table_privilege('service_role', 'dpg_app.phase2_order_confirmations', 'SELECT')
    or has_table_privilege('authenticated', 'dpg_app.phase2_order_confirmations', 'INSERT')
    or has_table_privilege('authenticated', 'dpg_app.phase2_order_confirmations', 'UPDATE')
    or has_table_privilege('authenticated', 'dpg_app.phase2_order_confirmations', 'DELETE')
    or not has_column_privilege('authenticated', 'dpg_app.phase2_order_confirmations', 'base_total', 'SELECT')
    or not has_column_privilege('authenticated', 'dpg_app.phase2_order_confirmations', 'confirmed_total', 'SELECT')
    or has_column_privilege('authenticated', 'dpg_app.phase2_order_confirmations', 'idempotency_key_hash', 'SELECT')
    or not has_function_privilege('authenticated', 'public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.phase2_admin_order_confirm(integer,bigint,jsonb,text,uuid)', 'EXECUTE')
    or not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app' and c.relname = 'phase2_order_confirmations'
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
    raise exception 'DPG_PHASE2_ORDER_CONFIRMATION_POSTFLIGHT_FAILED';
  end if;
end
$postflight$;
