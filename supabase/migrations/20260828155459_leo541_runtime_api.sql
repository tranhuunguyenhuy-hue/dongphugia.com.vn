-- LEO-541: authenticated order/quote backend for the isolated runtime.
--
-- This migration is source-only until the Owner authorizes the exact target,
-- schema/RLS expansion, and rollout gate. It deliberately creates no role,
-- login, credential, secret, auth setting, or Production connection.

set role dpg_migration;
set search_path = pg_catalog, dpg_app, extensions, public;

-- Existing reduced-runtime rows without an authenticated owner remain hidden
-- by the policies below. Nullable owner_id is intentional: it makes rollout
-- fail closed for historical rows without inventing ownership or rewriting
-- Production-derived data.
alter table dpg_app.orders add column if not exists owner_id uuid;
alter table dpg_app.quote_requests add column if not exists owner_id uuid;
alter table dpg_app.customers add column if not exists owner_id uuid;

-- The reduced runtime schema predates the immutable quote snapshot columns.
alter table dpg_app.quote_items add column if not exists product_sku_snapshot varchar(100);
alter table dpg_app.quote_items add column if not exists product_name_snapshot varchar(500);
alter table dpg_app.quote_items add column if not exists commerce_mode_snapshot varchar(30);
alter table dpg_app.quote_items add column if not exists availability_snapshot varchar(20);
alter table dpg_app.quote_items add column if not exists list_price_snapshot numeric(15,2);
alter table dpg_app.quote_items add column if not exists sale_price_snapshot numeric(15,2);
alter table dpg_app.quote_items add column if not exists snapshot_at timestamptz;

create index if not exists idx_orders_owner_created
  on dpg_app.orders (owner_id, created_at desc);
create index if not exists idx_quote_requests_owner_created
  on dpg_app.quote_requests (owner_id, created_at desc);
create index if not exists idx_customers_owner_phone
  on dpg_app.customers (owner_id, phone);

create table if not exists dpg_app.runtime_idempotency_records (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null,
  operation varchar(80) not null,
  key_hash char(64) not null,
  request_hash char(64) not null,
  status varchar(20) not null default 'completed'
    check (status in ('completed')),
  safe_response jsonb not null,
  resource_type varchar(40) not null,
  resource_id varchar(200) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (owner_id, operation, key_hash)
);

create table if not exists dpg_app.runtime_audit_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  actor_id uuid not null,
  operation varchar(80) not null,
  resource_type varchar(40) not null,
  resource_id varchar(200) not null,
  request_id uuid,
  idempotency_key_hash char(64),
  changed_fields text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_runtime_idempotency_expiry
  on dpg_app.runtime_idempotency_records (expires_at);
create index if not exists idx_runtime_audit_owner_created
  on dpg_app.runtime_audit_events (owner_id, created_at desc);

alter table dpg_app.runtime_idempotency_records owner to dpg_migration;
alter table dpg_app.runtime_audit_events owner to dpg_migration;
alter table dpg_app.runtime_idempotency_records enable row level security;
alter table dpg_app.runtime_idempotency_records force row level security;
alter table dpg_app.runtime_audit_events enable row level security;
alter table dpg_app.runtime_audit_events force row level security;

-- Public RPC functions run as the caller. Table access therefore needs both
-- explicit grants and owner-bound RLS; no service role or SECURITY DEFINER is
-- used.
revoke all on table dpg_app.orders, dpg_app.order_items,
  dpg_app.quote_requests, dpg_app.quote_items, dpg_app.customers,
  dpg_app.runtime_idempotency_records, dpg_app.runtime_audit_events
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant select, insert, update, delete on table dpg_app.orders,
  dpg_app.order_items, dpg_app.quote_requests, dpg_app.quote_items,
  dpg_app.customers, dpg_app.runtime_idempotency_records to authenticated;
grant insert on table dpg_app.runtime_audit_events to authenticated;
grant select on table dpg_app.products to authenticated;
grant usage, select on sequence dpg_app.orders_id_seq,
  dpg_app.order_items_id_seq, dpg_app.quote_requests_id_seq,
  dpg_app.quote_items_id_seq, dpg_app.runtime_audit_events_id_seq
  to authenticated;

-- The existing LEO-538 read-all policy is not suitable for owner-bound
-- commerce rows. Backup access, where separately authorized, remains governed
-- by its existing dpg_backup policy.
drop policy if exists leo538_runtime_select on dpg_app.orders;
drop policy if exists leo538_runtime_select on dpg_app.order_items;
drop policy if exists leo538_runtime_select on dpg_app.quote_requests;
drop policy if exists leo538_runtime_select on dpg_app.quote_items;
drop policy if exists leo538_runtime_select on dpg_app.customers;

create policy leo541_orders_select_own on dpg_app.orders
  for select to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_orders_insert_own on dpg_app.orders
  for insert to authenticated
  with check (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_orders_update_own on dpg_app.orders
  for update to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()))
  with check (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_orders_delete_own on dpg_app.orders
  for delete to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()));

create policy leo541_order_items_select_own on dpg_app.order_items
  for select to authenticated
  using (exists (
    select 1 from dpg_app.orders o
    where o.id = order_items.order_id
      and o.owner_id = (select auth.uid())
  ));
create policy leo541_order_items_insert_own on dpg_app.order_items
  for insert to authenticated
  with check (exists (
    select 1 from dpg_app.orders o
    where o.id = order_items.order_id
      and o.owner_id = (select auth.uid())
  ));
create policy leo541_order_items_update_own on dpg_app.order_items
  for update to authenticated
  using (exists (
    select 1 from dpg_app.orders o
    where o.id = order_items.order_id
      and o.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from dpg_app.orders o
    where o.id = order_items.order_id
      and o.owner_id = (select auth.uid())
  ));
create policy leo541_order_items_delete_own on dpg_app.order_items
  for delete to authenticated
  using (exists (
    select 1 from dpg_app.orders o
    where o.id = order_items.order_id
      and o.owner_id = (select auth.uid())
  ));

create policy leo541_quotes_select_own on dpg_app.quote_requests
  for select to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_quotes_insert_own on dpg_app.quote_requests
  for insert to authenticated
  with check (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_quotes_update_own on dpg_app.quote_requests
  for update to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()))
  with check (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_quotes_delete_own on dpg_app.quote_requests
  for delete to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()));

create policy leo541_quote_items_select_own on dpg_app.quote_items
  for select to authenticated
  using (exists (
    select 1 from dpg_app.quote_requests q
    where q.id = quote_items.quote_id
      and q.owner_id = (select auth.uid())
  ));
create policy leo541_quote_items_insert_own on dpg_app.quote_items
  for insert to authenticated
  with check (exists (
    select 1 from dpg_app.quote_requests q
    where q.id = quote_items.quote_id
      and q.owner_id = (select auth.uid())
  ));
create policy leo541_quote_items_update_own on dpg_app.quote_items
  for update to authenticated
  using (exists (
    select 1 from dpg_app.quote_requests q
    where q.id = quote_items.quote_id
      and q.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from dpg_app.quote_requests q
    where q.id = quote_items.quote_id
      and q.owner_id = (select auth.uid())
  ));
create policy leo541_quote_items_delete_own on dpg_app.quote_items
  for delete to authenticated
  using (exists (
    select 1 from dpg_app.quote_requests q
    where q.id = quote_items.quote_id
      and q.owner_id = (select auth.uid())
  ));

create policy leo541_customers_select_own on dpg_app.customers
  for select to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_customers_insert_own on dpg_app.customers
  for insert to authenticated
  with check (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_customers_update_own on dpg_app.customers
  for update to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()))
  with check (owner_id is not null and owner_id = (select auth.uid()));
create policy leo541_customers_delete_own on dpg_app.customers
  for delete to authenticated
  using (owner_id is not null and owner_id = (select auth.uid()));

create policy leo541_idempotency_select_own on dpg_app.runtime_idempotency_records
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy leo541_idempotency_insert_own on dpg_app.runtime_idempotency_records
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy leo541_idempotency_update_own on dpg_app.runtime_idempotency_records
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy leo541_idempotency_delete_own on dpg_app.runtime_idempotency_records
  for delete to authenticated
  using (owner_id = (select auth.uid()));
create policy leo541_audit_insert_own on dpg_app.runtime_audit_events
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and actor_id = (select auth.uid()));

-- Authenticated callers may validate a product, but only the public commerce
-- projection is visible. The RPCs return only immutable line snapshots.
create policy leo541_products_select_public on dpg_app.products
  for select to authenticated
  using (
    is_active
    and publication_status = 'public'
    and pdp_visibility = 'public'
    and sellable_status = 'sellable'
  );

create or replace function dpg_app.runtime_hash(value jsonb)
returns char(64)
language sql
immutable
strict
security invoker
set search_path = pg_catalog, extensions
as $$
  select encode(extensions.digest(convert_to(value::text, 'UTF8'), 'sha256'), 'hex')::char(64)
$$;

create or replace function dpg_app.runtime_key_hash(value text)
returns char(64)
language sql
immutable
strict
security invoker
set search_path = pg_catalog, extensions
as $$
  select encode(extensions.digest(convert_to(value, 'UTF8'), 'sha256'), 'hex')::char(64)
$$;

revoke all on function dpg_app.runtime_hash(jsonb), dpg_app.runtime_key_hash(text)
  from public, anon, service_role;
grant execute on function dpg_app.runtime_hash(jsonb), dpg_app.runtime_key_hash(text)
  to authenticated;

create or replace function public.runtime_order_create(
  p_input jsonb,
  p_idempotency_key text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, dpg_app, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_request_hash char(64);
  v_key_hash char(64);
  v_existing dpg_app.runtime_idempotency_records%rowtype;
  v_name text;
  v_phone text;
  v_email text;
  v_address text;
  v_note text;
  v_item jsonb;
  v_product record;
  v_install_option text;
  v_list_price numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  v_product_ids integer[] := array[]::integer[];
  v_order_id integer;
  v_order_number varchar(20);
  v_response jsonb;
begin
  if v_owner is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if jsonb_typeof(p_input) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  if jsonb_typeof(p_input->'items') <> 'array'
     or jsonb_array_length(p_input->'items') not between 1 and 20 then
    raise exception 'INVALID_ITEMS';
  end if;

  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  v_request_hash := dpg_app.runtime_hash(p_input);
  perform pg_advisory_xact_lock(hashtextextended(
    'leo541:idempotency:' || v_owner::text || ':order_create:' || v_key_hash, 0
  ));
  delete from dpg_app.runtime_idempotency_records
   where owner_id = v_owner and operation = 'order.create'
     and key_hash = v_key_hash and expires_at < now();
  insert into dpg_app.runtime_idempotency_records (
    owner_id, operation, key_hash, request_hash, safe_response,
    resource_type, resource_id, expires_at
  ) values (
    v_owner, 'order.create', v_key_hash, v_request_hash, '{}'::jsonb,
    'order', 'pending', now() + interval '24 hours'
  ) on conflict (owner_id, operation, key_hash) do nothing;
  if not found then
    select * into v_existing from dpg_app.runtime_idempotency_records
     where owner_id = v_owner and operation = 'order.create' and key_hash = v_key_hash;
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_existing.safe_response = '{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return v_existing.safe_response;
  end if;

  v_name := btrim(coalesce(p_input->>'customer_name', ''));
  v_phone := btrim(coalesce(p_input->>'customer_phone', ''));
  v_email := btrim(coalesce(p_input->>'customer_email', ''));
  v_address := nullif(btrim(coalesce(p_input->>'customer_address', '')), '');
  v_note := nullif(btrim(coalesce(p_input->>'note', '')), '');
  if length(v_name) not between 1 and 200 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
  if length(v_phone) not between 9 and 20 or v_phone !~ '^[0-9\s+().-]+$' then raise exception 'INVALID_CUSTOMER_PHONE'; end if;
  if v_email <> '' and (length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'INVALID_CUSTOMER_EMAIL'; end if;
  if v_address is not null and length(v_address) > 1000 then raise exception 'INVALID_CUSTOMER_ADDRESS'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'INVALID_NOTE'; end if;

  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    if jsonb_typeof(v_item) <> 'object'
       or (v_item->>'productId') is null
       or (v_item->>'quantity') is null
       or (v_item->>'productId') !~ '^[0-9]+$'
       or (v_item->>'quantity') !~ '^[0-9]+$' then
      raise exception 'INVALID_ITEM';
    end if;
    if (v_item->>'quantity')::integer not between 1 and 99 then raise exception 'INVALID_QUANTITY'; end if;
    if (v_item->>'productId')::integer = any(v_product_ids) then raise exception 'DUPLICATE_PRODUCT'; end if;
    v_product_ids := array_append(v_product_ids, (v_item->>'productId')::integer);
    if v_item ? 'installOption' and v_item->>'installOption' is null then raise exception 'INVALID_INSTALL_OPTION'; end if;
    v_install_option := coalesce(v_item->>'installOption', 'none');
    if v_install_option not in ('none', 'install', 'replace') then raise exception 'INVALID_INSTALL_OPTION'; end if;
    select id, sku, name, price, original_price, list_price, sale_price, stock_status
      into v_product from dpg_app.products
     where id = (v_item->>'productId')::integer
       and is_active
       and stock_status <> 'discontinued'
       and sellable_status = 'sellable'
       and publication_status = 'public'
       and pdp_visibility = 'public';
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    v_list_price := case
      when v_product.list_price is not null and v_product.list_price > 0 then v_product.list_price
      when v_product.original_price is not null and v_product.original_price > 0 then v_product.original_price
      when v_product.price is not null and v_product.price > 0 then v_product.price
      else null end;
    if v_product.stock_status <> 'in_stock' or v_list_price is null
       or v_product.list_price is null or v_product.list_price <= 0
       or (v_product.sale_price is not null and (v_product.sale_price <= 0 or v_product.sale_price >= v_list_price)) then
      raise exception 'PRODUCT_REQUIRES_QUOTE';
    end if;
    v_unit_price := round((coalesce(v_product.sale_price, v_product.list_price)
      + case v_install_option when 'install' then 200000 when 'replace' then 350000 else 0 end)::numeric, 2);
    v_line_total := v_unit_price * (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + v_line_total;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', case v_install_option when 'install' then v_product.name || ' (Cần Lắp Đặt)' when 'replace' then v_product.name || ' (Tháo dỡ & Lắp Đặt)' else v_product.name end,
      'product_sku', v_product.sku,
      'quantity', (v_item->>'quantity')::integer,
      'unit_price', v_unit_price,
      'total_price', v_line_total
    ));
  end loop;

  v_order_id := nextval('dpg_app.orders_id_seq');
  v_order_number := ('DPG-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || lpad(v_order_id::text, 6, '0'))::varchar(20);
  insert into dpg_app.orders (
    id, owner_id, order_number, customer_name, customer_phone, customer_email,
    customer_address, note, subtotal, total, status, payment_status
  ) values (
    v_order_id, v_owner, v_order_number, v_name, v_phone, nullif(v_email, ''),
    v_address, v_note, v_subtotal, v_subtotal, 'pending', 'unpaid'
  );
  for v_item in select value from jsonb_array_elements(v_lines) loop
    insert into dpg_app.order_items (
      order_id, product_id, product_name, product_sku, quantity, unit_price, total_price
    ) values (
      v_order_id, (v_item->>'product_id')::integer, left(v_item->>'product_name', 500),
      left(v_item->>'product_sku', 100), (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric, (v_item->>'total_price')::numeric
    );
  end loop;
  v_response := jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total', v_subtotal);
  insert into dpg_app.runtime_audit_events (
    owner_id, actor_id, operation, resource_type, resource_id, request_id,
    idempotency_key_hash, changed_fields, metadata
  ) values (
    v_owner, v_owner, 'order.create', 'order', v_order_id::text, p_request_id,
    v_key_hash, array['created'], jsonb_build_object('item_count', jsonb_array_length(v_lines))
  );
  update dpg_app.runtime_idempotency_records
     set safe_response = v_response, resource_id = v_order_id::text
   where owner_id = v_owner and operation = 'order.create' and key_hash = v_key_hash;
  return v_response;
end;
$$;

create or replace function public.runtime_order_get(p_order_id integer)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, dpg_app
as $$
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'customer_name', o.customer_name,
    'customer_phone', o.customer_phone, 'customer_email', o.customer_email,
    'customer_address', o.customer_address, 'note', o.note, 'subtotal', o.subtotal,
    'shipping_fee', o.shipping_fee, 'discount', o.discount, 'vat_rate', o.vat_rate,
    'total', o.total, 'status', o.status, 'payment_method', o.payment_method,
    'payment_status', o.payment_status, 'created_at', o.created_at, 'updated_at', o.updated_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'product_id', i.product_id, 'product_name', i.product_name,
      'product_sku', i.product_sku, 'quantity', i.quantity,
      'unit_price', i.unit_price, 'total_price', i.total_price
    ) order by i.id) from dpg_app.order_items i where i.order_id = o.id), '[]'::jsonb)
  ) from dpg_app.orders o where o.id = p_order_id;
$$;

create or replace function public.runtime_order_list(p_limit integer default 25, p_offset integer default 0)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, dpg_app
as $$
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'customer_name', o.customer_name,
      'status', o.status, 'payment_status', o.payment_status, 'total', o.total,
      'created_at', o.created_at, 'item_count', (select count(*) from dpg_app.order_items i where i.order_id=o.id)
    ) as row_data, o.created_at
    from dpg_app.orders o
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ) rows;
$$;

create or replace function public.runtime_order_update(
  p_order_id integer,
  p_patch jsonb,
  p_idempotency_key text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, dpg_app
as $$
declare
  v_owner uuid := auth.uid();
  v_order dpg_app.orders%rowtype;
  v_key_hash char(64);
  v_request_hash char(64);
  v_existing dpg_app.runtime_idempotency_records%rowtype;
  v_response jsonb;
  v_key text;
  v_status text;
  v_payment text;
  v_note text;
  v_shipping numeric;
  v_discount numeric;
  v_vat integer;
  v_total numeric;
begin
  if v_owner is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('status','payment_status','note','shipping_fee','discount','vat_rate') then raise exception 'INVALID_PATCH'; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('leo541:order:' || p_order_id::text, 0));
  select * into v_order from dpg_app.orders where id = p_order_id;
  if not found then return null; end if;
  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  v_request_hash := dpg_app.runtime_hash(p_patch);
  perform pg_advisory_xact_lock(hashtextextended(
    'leo541:idempotency:' || v_owner::text || ':order_update:' || v_key_hash, 0
  ));
  delete from dpg_app.runtime_idempotency_records
   where owner_id=v_owner and operation='order.update' and key_hash=v_key_hash and expires_at<now();
  insert into dpg_app.runtime_idempotency_records (owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at)
    values (v_owner,'order.update',v_key_hash,v_request_hash,'{}'::jsonb,'order',p_order_id::text,now()+interval '24 hours')
    on conflict (owner_id,operation,key_hash) do nothing;
  if not found then
    select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='order.update' and key_hash=v_key_hash;
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_existing.safe_response = '{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return v_existing.safe_response;
  end if;
  v_status := p_patch->>'status';
  v_payment := p_patch->>'payment_status';
  v_note := case when p_patch ? 'note' then nullif(btrim(p_patch->>'note'),'') else v_order.note end;
  v_shipping := case when p_patch ? 'shipping_fee' then (p_patch->>'shipping_fee')::numeric else v_order.shipping_fee end;
  v_discount := case when p_patch ? 'discount' then (p_patch->>'discount')::numeric else v_order.discount end;
  v_vat := case when p_patch ? 'vat_rate' then (p_patch->>'vat_rate')::integer else v_order.vat_rate end;
  if v_status is not null and v_status not in ('pending','received','confirmed','inventory_check','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if v_payment is not null and v_payment not in ('unpaid','paid','refunded') then raise exception 'INVALID_PAYMENT_STATUS'; end if;
  if v_note is not null and length(v_note)>2000 then raise exception 'INVALID_NOTE'; end if;
  if v_shipping < 0 or v_discount < 0 or v_vat not between 0 and 100 then raise exception 'INVALID_TOTALS'; end if;
  v_total := v_order.subtotal + (v_order.subtotal * v_vat / 100) + v_shipping - v_discount;
  if v_total < 0 then raise exception 'INVALID_TOTALS'; end if;
  update dpg_app.orders set
    status=coalesce(v_status,status), payment_status=coalesce(v_payment,payment_status), note=v_note,
    shipping_fee=v_shipping, discount=v_discount, vat_rate=v_vat, total=v_total, updated_at=now()
    where id=p_order_id;
  v_response := jsonb_build_object('order_id',p_order_id,'status',coalesce(v_status,v_order.status),'payment_status',coalesce(v_payment,v_order.payment_status),'total',v_total);
  insert into dpg_app.runtime_audit_events(owner_id,actor_id,operation,resource_type,resource_id,request_id,idempotency_key_hash,changed_fields,metadata)
    values(v_owner,v_owner,'order.update','order',p_order_id::text,p_request_id,v_key_hash,array(select jsonb_object_keys(p_patch)),'{}'::jsonb);
  update dpg_app.runtime_idempotency_records set safe_response=v_response where owner_id=v_owner and operation='order.update' and key_hash=v_key_hash;
  return v_response;
end;
$$;

create or replace function public.runtime_order_delete(
  p_order_id integer,
  p_idempotency_key text,
  p_request_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,dpg_app as $$
declare v_owner uuid:=auth.uid(); v_key_hash char(64); v_request_hash char(64); v_existing dpg_app.runtime_idempotency_records%rowtype; v_response jsonb; v_order dpg_app.orders%rowtype;
begin
  if v_owner is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended('leo541:order:'||p_order_id::text,0));
  select * into v_order from dpg_app.orders where id=p_order_id;
  if not found then return null; end if;
  v_key_hash:=dpg_app.runtime_key_hash(btrim(p_idempotency_key)); v_request_hash:=dpg_app.runtime_hash(jsonb_build_object('order_id',p_order_id));
  perform pg_advisory_xact_lock(hashtextextended('leo541:idempotency:'||v_owner::text||':order_delete:'||v_key_hash,0));
  delete from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='order.delete' and key_hash=v_key_hash and expires_at<now();
  insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at) values(v_owner,'order.delete',v_key_hash,v_request_hash,'{}'::jsonb,'order',p_order_id::text,now()+interval '24 hours') on conflict(owner_id,operation,key_hash) do nothing;
  if not found then select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='order.delete' and key_hash=v_key_hash; if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.safe_response='{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
  insert into dpg_app.runtime_audit_events(owner_id,actor_id,operation,resource_type,resource_id,request_id,idempotency_key_hash,changed_fields,metadata) values(v_owner,v_owner,'order.delete','order',p_order_id::text,p_request_id,v_key_hash,array['deleted'],'{}'::jsonb);
  delete from dpg_app.orders where id=p_order_id;
  v_response:=jsonb_build_object('order_id',p_order_id,'deleted',true);
  update dpg_app.runtime_idempotency_records set safe_response=v_response where owner_id=v_owner and operation='order.delete' and key_hash=v_key_hash;
  return v_response;
end;
$$;

create or replace function public.runtime_quote_create(
  p_input jsonb,
  p_idempotency_key text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, dpg_app
as $$
declare
  v_owner uuid := auth.uid();
  v_key_hash char(64); v_request_hash char(64); v_existing dpg_app.runtime_idempotency_records%rowtype;
  v_name text; v_phone text; v_email text; v_message text; v_item jsonb; v_product record;
  v_quote_id integer; v_quote_number varchar(30); v_snapshot_at timestamptz := now(); v_response jsonb;
  v_list_price numeric; v_sale_price numeric; v_mode text; v_availability text; v_count integer := 0;
begin
  if v_owner is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if jsonb_typeof(p_input) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  if jsonb_typeof(coalesce(p_input->'products', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_input->'products', '[]'::jsonb)) > 20 then
    raise exception 'INVALID_ITEMS';
  end if;
  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key)); v_request_hash := dpg_app.runtime_hash(p_input);
  perform pg_advisory_xact_lock(hashtextextended('leo541:idempotency:' || v_owner::text || ':quote_create:' || v_key_hash, 0));
  delete from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='quote.create' and key_hash=v_key_hash and expires_at<now();
  insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at)
    values(v_owner,'quote.create',v_key_hash,v_request_hash,'{}'::jsonb,'quote','pending',now()+interval '24 hours')
    on conflict(owner_id,operation,key_hash) do nothing;
  if not found then
    select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='quote.create' and key_hash=v_key_hash;
    if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_existing.safe_response='{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return v_existing.safe_response;
  end if;
  v_name:=btrim(coalesce(p_input->>'name','')); v_phone:=btrim(coalesce(p_input->>'phone','')); v_email:=btrim(coalesce(p_input->>'email','')); v_message:=nullif(btrim(coalesce(p_input->>'message','')),'');
  if length(v_name) < 1 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
  if length(v_phone) not between 9 and 15 or v_phone !~ '^[0-9\s+().-]+$' then raise exception 'INVALID_CUSTOMER_PHONE'; end if;
  if v_email<>'' and (length(v_email)>255 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'INVALID_CUSTOMER_EMAIL'; end if;
  if v_message is not null and length(v_message)>2000 then raise exception 'INVALID_MESSAGE'; end if;
  v_quote_id:=nextval('dpg_app.quote_requests_id_seq'); v_quote_number:=('DPG-Q-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(v_quote_id::text,6,'0'))::varchar(30);
  insert into dpg_app.quote_requests(id,owner_id,name,phone,email,message,quote_number,status) values(v_quote_id,v_owner,v_name,v_phone,nullif(v_email,''),v_message,v_quote_number,'pending');
  for v_item in select value from jsonb_array_elements(coalesce(p_input->'products', '[]'::jsonb)) loop
    if jsonb_typeof(v_item)<>'object'
       or (v_item->>'product_id') is null
       or (v_item ? 'quantity' and v_item->>'quantity' is null)
       or (v_item->>'product_id') !~ '^[0-9]+$'
       or coalesce(v_item->>'quantity','1') !~ '^[0-9]+$'
       or coalesce((v_item->>'quantity')::integer,1) not between 1 and 99 then
      raise exception 'INVALID_ITEM';
    end if;
    select id,sku,name,price,original_price,list_price,sale_price,stock_status into v_product from dpg_app.products
     where id=(v_item->>'product_id')::integer
       and is_active
       and stock_status <> 'discontinued'
       and sellable_status = 'sellable'
       and publication_status = 'public'
       and pdp_visibility = 'public';
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    v_availability:=case v_product.stock_status when 'in_stock' then 'InStock' when 'pre_order' then 'PreOrder' when 'preorder' then 'PreOrder' when 'contact' then 'QuoteOnly' else null end;
    if v_availability is null then raise exception 'QUOTE_PRODUCT_NOT_QUOTEABLE'; end if;
    v_list_price:=case when v_product.list_price is not null and v_product.list_price>0 then v_product.list_price when v_product.original_price is not null and v_product.original_price>0 then v_product.original_price when v_product.price is not null and v_product.price>0 then v_product.price else null end;
    v_mode:='CONTACT_FOR_QUOTE'; v_sale_price:=null;
    if v_product.list_price is not null and v_product.list_price>0 and v_product.sale_price is not null and v_product.sale_price>0 and v_product.sale_price<v_product.list_price then v_mode:='PUBLIC_PRICE'; v_sale_price:=v_product.sale_price; end if;
    insert into dpg_app.quote_items(quote_id,product_id,quantity,note,product_sku_snapshot,product_name_snapshot,commerce_mode_snapshot,availability_snapshot,list_price_snapshot,sale_price_snapshot,snapshot_at)
      values(v_quote_id,v_product.id,coalesce((v_item->>'quantity')::integer,1),left(nullif(v_item->>'note',''),500),left(v_product.sku,100),left(v_product.name,500),v_mode,v_availability,v_list_price,v_sale_price,v_snapshot_at);
    v_count:=v_count+1;
  end loop;
  v_response:=jsonb_build_object('quote_id',v_quote_id,'quote_number',v_quote_number,'item_count',v_count);
  insert into dpg_app.runtime_audit_events(owner_id,actor_id,operation,resource_type,resource_id,request_id,idempotency_key_hash,changed_fields,metadata)
    values(v_owner,v_owner,'quote.create','quote',v_quote_id::text,p_request_id,v_key_hash,array['created'],jsonb_build_object('item_count',v_count));
  update dpg_app.runtime_idempotency_records set safe_response=v_response,resource_id=v_quote_id::text where owner_id=v_owner and operation='quote.create' and key_hash=v_key_hash;
  return v_response;
end;
$$;

create or replace function public.runtime_quote_get(p_quote_id integer)
returns jsonb language sql security invoker set search_path=pg_catalog,dpg_app as $$
  select jsonb_build_object('id',q.id,'quote_number',q.quote_number,'name',q.name,'phone',q.phone,'email',q.email,'message',q.message,'status',q.status,'created_at',q.created_at,'updated_at',q.updated_at,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'quantity',i.quantity,'note',i.note,'product_sku_snapshot',i.product_sku_snapshot,'product_name_snapshot',i.product_name_snapshot,'commerce_mode_snapshot',i.commerce_mode_snapshot,'availability_snapshot',i.availability_snapshot,'list_price_snapshot',i.list_price_snapshot,'sale_price_snapshot',i.sale_price_snapshot,'snapshot_at',i.snapshot_at) order by i.id) from dpg_app.quote_items i where i.quote_id=q.id),'[]'::jsonb)) from dpg_app.quote_requests q where q.id=p_quote_id;
$$;

create or replace function public.runtime_quote_list(p_limit integer default 25, p_offset integer default 0)
returns jsonb language sql security invoker set search_path=pg_catalog,dpg_app as $$
  select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from (select jsonb_build_object('id',q.id,'quote_number',q.quote_number,'name',q.name,'status',q.status,'created_at',q.created_at,'item_count',(select count(*) from dpg_app.quote_items i where i.quote_id=q.id)) row_data,q.created_at from dpg_app.quote_requests q limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)) rows;
$$;

create or replace function public.runtime_quote_update(p_quote_id integer,p_patch jsonb,p_idempotency_key text,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,dpg_app as $$
declare v_owner uuid:=auth.uid(); v_quote dpg_app.quote_requests%rowtype; v_key_hash char(64); v_request_hash char(64); v_existing dpg_app.runtime_idempotency_records%rowtype; v_key text; v_status text; v_message text; v_response jsonb;
begin
  if v_owner is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if jsonb_typeof(p_patch)<>'object' then raise exception 'INVALID_INPUT'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop if v_key not in ('status','message') then raise exception 'INVALID_PATCH'; end if; end loop;
  perform pg_advisory_xact_lock(hashtextextended('leo541:quote:'||p_quote_id::text,0));
  select * into v_quote from dpg_app.quote_requests where id=p_quote_id;
  if not found then return null; end if;
  v_key_hash:=dpg_app.runtime_key_hash(btrim(p_idempotency_key)); v_request_hash:=dpg_app.runtime_hash(p_patch);
  perform pg_advisory_xact_lock(hashtextextended('leo541:idempotency:'||v_owner::text||':quote_update:'||v_key_hash,0));
  delete from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='quote.update' and key_hash=v_key_hash and expires_at<now();
  insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at) values(v_owner,'quote.update',v_key_hash,v_request_hash,'{}'::jsonb,'quote',p_quote_id::text,now()+interval '24 hours') on conflict(owner_id,operation,key_hash) do nothing;
  if not found then select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='quote.update' and key_hash=v_key_hash; if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.safe_response='{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
  v_status:=p_patch->>'status'; v_message:=case when p_patch ? 'message' then nullif(btrim(p_patch->>'message'),'') else v_quote.message end;
  if v_status is not null and v_status not in ('pending','contacted','quoted','resolved','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if v_message is not null and length(v_message)>2000 then raise exception 'INVALID_MESSAGE'; end if;
  update dpg_app.quote_requests set status=coalesce(v_status,status),message=v_message,updated_at=now() where id=p_quote_id;
  v_response:=jsonb_build_object('quote_id',p_quote_id,'status',coalesce(v_status,v_quote.status));
  insert into dpg_app.runtime_audit_events(owner_id,actor_id,operation,resource_type,resource_id,request_id,idempotency_key_hash,changed_fields,metadata) values(v_owner,v_owner,'quote.update','quote',p_quote_id::text,p_request_id,v_key_hash,array(select jsonb_object_keys(p_patch)),'{}'::jsonb);
  update dpg_app.runtime_idempotency_records set safe_response=v_response where owner_id=v_owner and operation='quote.update' and key_hash=v_key_hash;
  return v_response;
end;
$$;

create or replace function public.runtime_quote_delete(p_quote_id integer,p_idempotency_key text,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,dpg_app as $$
declare v_owner uuid:=auth.uid(); v_key_hash char(64); v_request_hash char(64); v_existing dpg_app.runtime_idempotency_records%rowtype; v_response jsonb; v_quote dpg_app.quote_requests%rowtype;
begin
  if v_owner is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended('leo541:quote:'||p_quote_id::text,0));
  select * into v_quote from dpg_app.quote_requests where id=p_quote_id;
  if not found then return null; end if;
  v_key_hash:=dpg_app.runtime_key_hash(btrim(p_idempotency_key)); v_request_hash:=dpg_app.runtime_hash(jsonb_build_object('quote_id',p_quote_id));
  perform pg_advisory_xact_lock(hashtextextended('leo541:idempotency:'||v_owner::text||':quote_delete:'||v_key_hash,0));
  delete from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='quote.delete' and key_hash=v_key_hash and expires_at<now();
  insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at) values(v_owner,'quote.delete',v_key_hash,v_request_hash,'{}'::jsonb,'quote',p_quote_id::text,now()+interval '24 hours') on conflict(owner_id,operation,key_hash) do nothing;
  if not found then select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=v_owner and operation='quote.delete' and key_hash=v_key_hash; if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.safe_response='{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
  insert into dpg_app.runtime_audit_events(owner_id,actor_id,operation,resource_type,resource_id,request_id,idempotency_key_hash,changed_fields,metadata) values(v_owner,v_owner,'quote.delete','quote',p_quote_id::text,p_request_id,v_key_hash,array['deleted'],'{}'::jsonb);
  delete from dpg_app.quote_requests where id=p_quote_id;
  v_response:=jsonb_build_object('quote_id',p_quote_id,'deleted',true);
  update dpg_app.runtime_idempotency_records set safe_response=v_response where owner_id=v_owner and operation='quote.delete' and key_hash=v_key_hash;
  return v_response;
end;
$$;

-- Public RPC surface is intentionally allowlisted to authenticated callers.
revoke all on function public.runtime_order_create(jsonb,text,uuid),
  public.runtime_order_get(integer), public.runtime_order_list(integer,integer),
  public.runtime_order_update(integer,jsonb,text,uuid),
  public.runtime_order_delete(integer,text,uuid),
  public.runtime_quote_create(jsonb,text,uuid), public.runtime_quote_get(integer),
  public.runtime_quote_list(integer,integer), public.runtime_quote_update(integer,jsonb,text,uuid),
  public.runtime_quote_delete(integer,text,uuid)
  from public, anon, service_role;
grant execute on function public.runtime_order_create(jsonb,text,uuid),
  public.runtime_order_get(integer), public.runtime_order_list(integer,integer),
  public.runtime_order_update(integer,jsonb,text,uuid),
  public.runtime_order_delete(integer,text,uuid),
  public.runtime_quote_create(jsonb,text,uuid), public.runtime_quote_get(integer),
  public.runtime_quote_list(integer,integer), public.runtime_quote_update(integer,jsonb,text,uuid),
  public.runtime_quote_delete(integer,text,uuid)
  to authenticated;

create trigger leo541_idempotency_free_tier_headroom
after insert or update on dpg_app.runtime_idempotency_records
for each statement execute function dpg_control.enforce_free_tier_headroom_statement();
create trigger leo541_audit_free_tier_headroom
after insert on dpg_app.runtime_audit_events
for each statement execute function dpg_control.enforce_free_tier_headroom_statement();

reset role;
