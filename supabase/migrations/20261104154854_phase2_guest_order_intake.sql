-- Phase 2: backend-mediated public guest order-request intake on dpg_app.
-- Source only. Applying this migration requires the task-specific backup,
-- restore rehearsal, target attestation, and Owner authorization described in
-- Issue #270 and the runtime recovery runbook. The dedicated intake roles must
-- be provisioned before this migration; they are never created by dpg_migration.
-- The function owner is separate from both the no-login RPC capability role and
-- the login role, so a database caller cannot SET ROLE to its data privileges.

do $target_preflight$
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
    raise exception 'DPG_PHASE2_TARGET_CONTRACT_FAILED';
  end if;

  if to_regclass('dpg_app.orders') is null
     or to_regclass('dpg_app.order_items') is null
     or to_regclass('dpg_app.products') is null
     or to_regprocedure('dpg_app.runtime_hash(jsonb)') is null
     or to_regprocedure('dpg_app.runtime_key_hash(text)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'orders' and column_name = 'owner_id'
     ) then
    raise exception 'DPG_PHASE2_DPG_APP_SCHEMA_MISMATCH';
  end if;

  if (
       select count(distinct column_name)
       from information_schema.columns
       where table_schema = 'dpg_app'
         and table_name = 'products'
         and column_name in (
           'price', 'original_price', 'list_price', 'sale_price',
           'online_discount_amount', 'stock_status', 'price_source',
           'source_system', 'price_state', 'price_confidence', 'price_updated_at'
         )
     ) <> 11 then
    raise exception 'DPG_PHASE2_PRODUCT_PRICING_SCHEMA_MISMATCH';
  end if;

  if not has_schema_privilege('dpg_migration', 'dpg_app', 'USAGE')
     or not has_schema_privilege('dpg_migration', 'public', 'USAGE')
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or not has_schema_privilege(current_user, 'public', 'CREATE')
     or not exists (
       select 1 from pg_roles
       where rolname = 'dpg_migration'
         and not rolsuper and not rolbypassrls and not rolcanlogin
         and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit
     )
     or not has_function_privilege('dpg_migration', 'dpg_app.runtime_hash(jsonb)', 'EXECUTE')
     or not has_function_privilege('dpg_migration', 'dpg_app.runtime_key_hash(text)', 'EXECUTE')
     or not has_sequence_privilege('dpg_migration', 'dpg_app.orders_id_seq', 'USAGE')
     or not has_sequence_privilege('dpg_migration', 'dpg_app.order_items_id_seq', 'USAGE')
     or not exists (
       select 1 from pg_roles
       where rolname = 'dpg_order_intake_function_owner'
         and not rolsuper and not rolbypassrls and not rolcanlogin
         and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit
         and rolconnlimit = 0
     )
     or not exists (
       select 1 from pg_roles
       where rolname = 'dpg_order_intake'
         and not rolsuper and not rolbypassrls and not rolcanlogin
         and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit
         and rolconnlimit = 0
     )
     or not exists (
       select 1 from pg_roles
       where rolname = 'dpg_order_intake_login'
         and not rolsuper and not rolbypassrls and rolcanlogin
         and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit
         and rolconnlimit = 5
     )
     or not exists (
       select 1
       from pg_auth_members membership
       join pg_roles capability on capability.oid = membership.roleid
       join pg_roles login on login.oid = membership.member
       where capability.rolname = 'dpg_order_intake'
         and login.rolname = 'dpg_order_intake_login'
     )
     or (select count(*) from pg_auth_members membership
         where membership.member = (select oid from pg_roles where rolname = 'dpg_order_intake_login')) <> 1
     or (select count(*) from pg_auth_members membership
         where membership.roleid = (select oid from pg_roles where rolname = 'dpg_order_intake')
           and membership.member = (select oid from pg_roles where rolname = 'dpg_order_intake_login')) <> 1
     or exists (
       select 1 from pg_auth_members membership
       where membership.roleid = (select oid from pg_roles where rolname = 'dpg_order_intake')
         and membership.member <> (select oid from pg_roles where rolname = 'dpg_order_intake_login')
         and not (
           membership.member is not distinct from (select oid from pg_roles where rolname = 'postgres')
           and membership.grantor is not distinct from (select oid from pg_roles where rolname = 'supabase_admin')
           and membership.admin_option
           and not membership.inherit_option
           and not membership.set_option
         )
     )
     or exists (
       select 1 from pg_auth_members membership
       where membership.member = (select oid from pg_roles where rolname = 'dpg_order_intake')
     )
     or exists (
       select 1 from pg_auth_members membership
       where (
         membership.roleid = (select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')
         or membership.member = (select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')
       )
         and not (
           membership.roleid = (select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')
           and membership.member is not distinct from (select oid from pg_roles where rolname = 'postgres')
           and membership.grantor is not distinct from (select oid from pg_roles where rolname = 'supabase_admin')
           and membership.admin_option
           and not membership.inherit_option
           and not membership.set_option
         )
     )
     or has_schema_privilege('dpg_order_intake_function_owner', 'dpg_app', 'USAGE')
     or has_schema_privilege('dpg_order_intake_function_owner', 'public', 'CREATE')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.products', 'SELECT')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.orders', 'INSERT')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.order_items', 'INSERT')
     or has_function_privilege('dpg_order_intake_function_owner', 'dpg_app.runtime_hash(jsonb)', 'EXECUTE')
     or has_function_privilege('dpg_order_intake_function_owner', 'dpg_app.runtime_key_hash(text)', 'EXECUTE')
     or has_sequence_privilege('dpg_order_intake_function_owner', 'dpg_app.orders_id_seq', 'USAGE')
     or has_sequence_privilege('dpg_order_intake_function_owner', 'dpg_app.order_items_id_seq', 'USAGE')
     or exists (
       select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app'
         and c.relname in ('orders', 'order_items', 'products')
         and pg_get_userbyid(c.relowner) <> 'dpg_migration'
     ) then
    raise exception 'DPG_PHASE2_MIGRATION_ROLE_CONTRACT_FAILED';
  end if;

  if exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'orders' and column_name = 'order_origin'
     )
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'order_items' and column_name = 'commercial_snapshot'
     )
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'orders' and column_name = 'shipping_fee_status'
     )
     or to_regclass('dpg_app.guest_order_idempotency_records') is not null
     or to_regclass('dpg_app.guest_order_rate_limit_windows') is not null
     or to_regprocedure('public.guest_order_request_create(jsonb,text,uuid)') is not null
     or to_regprocedure('public.guest_order_request_receipt(text)') is not null then
    raise exception 'DPG_PHASE2_MIGRATION_ALREADY_PRESENT';
  end if;

  if exists (
       select 1
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app'
         and p.polname in (
           'phase2_guest_products_select_public',
           'phase2_guest_orders_insert_pending',
           'phase2_guest_order_items_insert',
           'phase2_guest_idempotency_select',
           'phase2_guest_idempotency_insert',
           'phase2_guest_rate_limit_all'
         )
     ) then
    raise exception 'DPG_PHASE2_POLICY_NAME_COLLISION';
  end if;

  if has_schema_privilege('anon', 'dpg_app', 'USAGE')
     or has_table_privilege('anon', 'dpg_app.orders', 'INSERT')
     or has_table_privilege('anon', 'dpg_app.order_items', 'INSERT')
     or has_any_column_privilege('anon', 'dpg_app.orders', 'INSERT')
     or has_any_column_privilege('anon', 'dpg_app.order_items', 'INSERT')
     or has_any_column_privilege('anon', 'dpg_app.products', 'SELECT')
     or has_function_privilege('anon', 'dpg_app.runtime_hash(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'dpg_app.runtime_key_hash(text)', 'EXECUTE')
     or has_sequence_privilege('anon', 'dpg_app.orders_id_seq', 'USAGE')
     or has_sequence_privilege('anon', 'dpg_app.order_items_id_seq', 'USAGE') then
    raise exception 'DPG_PHASE2_ANON_PRIVILEGE_PREEXISTS';
  end if;
end
$target_preflight$;

set role dpg_migration;
set search_path = pg_catalog, dpg_app, public;

alter table dpg_app.order_items
  add column commercial_snapshot jsonb not null default '{}'::jsonb;
alter table dpg_app.orders
  add column order_origin varchar(30);
alter table dpg_app.orders
  add constraint phase2_order_origin_check
  check (order_origin is null or order_origin = 'public_web');
alter table dpg_app.orders
  add column shipping_fee_status varchar(30);
alter table dpg_app.orders
  add constraint phase2_shipping_fee_status_check
  check (shipping_fee_status is null or shipping_fee_status in ('pending_confirmation', 'confirmed', 'not_applicable'));

-- Keep only hashed submission values and the minimal receipt, not raw customer
-- fields, for the idempotency lifetime. A customer may retry after an extended
-- offline period; expiring a key could create a second request after a lost response.
create table dpg_app.guest_order_idempotency_records (
  key_hash char(64) primary key,
  request_hash char(64) not null,
  safe_response jsonb not null,
  created_at timestamptz not null default now()
);

create table dpg_app.guest_order_rate_limit_windows (
  phone_hash char(64) not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (phone_hash, window_start)
);

create index if not exists idx_guest_order_rate_expiry
  on dpg_app.guest_order_rate_limit_windows (window_start);

alter table dpg_app.guest_order_idempotency_records owner to dpg_migration;
alter table dpg_app.guest_order_rate_limit_windows owner to dpg_migration;
alter table dpg_app.guest_order_idempotency_records enable row level security;
alter table dpg_app.guest_order_idempotency_records force row level security;
alter table dpg_app.guest_order_rate_limit_windows enable row level security;
alter table dpg_app.guest_order_rate_limit_windows force row level security;

revoke all on table dpg_app.guest_order_idempotency_records,
  dpg_app.guest_order_rate_limit_windows from public, anon, authenticated, service_role;
revoke all on table dpg_app.orders, dpg_app.order_items from public, anon;
revoke all on table dpg_app.products from public, anon;
revoke all on function dpg_app.runtime_hash(jsonb), dpg_app.runtime_key_hash(text)
  from public, anon, service_role, dpg_order_intake, dpg_order_intake_login;
grant execute on function dpg_app.runtime_hash(jsonb), dpg_app.runtime_key_hash(text)
  to dpg_order_intake_function_owner;

grant usage on schema dpg_app to dpg_order_intake_function_owner;
grant select (
  id, sku, name, price, original_price, list_price, sale_price,
  online_discount_amount, stock_status, price_source, source_system,
  price_state, price_confidence, price_updated_at, is_active,
  publication_status, pdp_visibility, sellable_status
) on table dpg_app.products to dpg_order_intake_function_owner;
grant insert (
  id, owner_id, order_number, customer_name, customer_phone, customer_email,
  customer_address, note, subtotal, discount, total, status, payment_status,
  order_origin, shipping_fee_status
) on table dpg_app.orders to dpg_order_intake_function_owner;
grant insert (
  order_id, product_id, product_name, product_sku, quantity, unit_price,
  total_price, commercial_snapshot
) on table dpg_app.order_items to dpg_order_intake_function_owner;
grant select, insert on table dpg_app.guest_order_idempotency_records
  to dpg_order_intake_function_owner;
grant select, insert, update, delete on table dpg_app.guest_order_rate_limit_windows
  to dpg_order_intake_function_owner;
grant usage on sequence dpg_app.orders_id_seq, dpg_app.order_items_id_seq
  to dpg_order_intake_function_owner;

create policy phase2_guest_products_select_public on dpg_app.products
  for select to dpg_order_intake_function_owner
  using (
    is_active
    and publication_status = 'public'
    and pdp_visibility = 'public'
    and sellable_status = 'sellable'
  );

create policy phase2_guest_orders_insert_pending on dpg_app.orders
  for insert to dpg_order_intake_function_owner
  with check (
    owner_id is null
    and status = 'pending'
    and payment_status = 'unpaid'
    and payment_method is null
    and order_origin = 'public_web'
    and shipping_fee_status = 'pending_confirmation'
  );

create policy phase2_guest_order_items_insert on dpg_app.order_items
  for insert to dpg_order_intake_function_owner
  with check (
    quantity between 1 and 99
    and unit_price > 0
    and total_price = unit_price * quantity
    and jsonb_typeof(commercial_snapshot) = 'object'
    and commercial_snapshot ->> 'install_option' in ('none', 'install', 'replace')
    and case commercial_snapshot ->> 'install_option'
      when 'none' then coalesce((commercial_snapshot ->> 'installation_fee')::numeric = 0, false)
      when 'install' then commercial_snapshot ->> 'installation_fee' is null
        and commercial_snapshot ->> 'installation_fee_status' = 'pending_confirmation'
      when 'replace' then commercial_snapshot ->> 'installation_fee' is null
        and commercial_snapshot ->> 'installation_fee_status' = 'pending_confirmation'
      else false
    end
  );

create policy phase2_guest_idempotency_select on dpg_app.guest_order_idempotency_records
  for select to dpg_order_intake_function_owner using (true);

create policy phase2_guest_idempotency_insert on dpg_app.guest_order_idempotency_records
  for insert to dpg_order_intake_function_owner with check (true);

create policy phase2_guest_rate_limit_all on dpg_app.guest_order_rate_limit_windows
  for all to dpg_order_intake_function_owner using (true) with check (true);

grant usage on schema public to dpg_order_intake;

reset role;
grant create on schema public to dpg_migration;
set role dpg_migration;

create function public.guest_order_request_create(
  p_input jsonb,
  p_idempotency_key text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, dpg_app
set row_security = on
as $$
declare
  v_key_hash char(64);
  v_request_hash char(64);
  v_phone_hash char(64);
  v_existing dpg_app.guest_order_idempotency_records%rowtype;
  v_name text;
  v_phone text;
  v_email text;
  v_address text;
  v_note text;
  v_item jsonb;
  v_product record;
  v_selection_keys text[] := array[]::text[];
  v_public_selling_price numeric;
  v_list_price numeric;
  v_sale_price numeric;
  v_base_price numeric;
  v_online_discount numeric;
  v_effective_discount numeric;
  v_install_option text;
  v_installation_fee numeric;
  v_unit_price numeric;
  v_final_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_order_total numeric := 0;
  v_order_id integer;
  v_order_number varchar(20);
  v_request_count integer;
  v_window_start timestamptz := date_trunc('minute', clock_timestamp());
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_safe_response jsonb;
  v_error_code text;
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if jsonb_typeof(p_input) <> 'object'
     or jsonb_typeof(p_input -> 'items') <> 'array'
     or jsonb_array_length(p_input -> 'items') not between 1 and 20 then
    raise exception 'INVALID_INPUT';
  end if;

  v_name := btrim(coalesce(p_input ->> 'customer_name', ''));
  v_phone := regexp_replace(btrim(coalesce(p_input ->> 'customer_phone', '')), '[[:space:]().-]', '', 'g');
  v_email := btrim(coalesce(p_input ->> 'customer_email', ''));
  v_address := nullif(btrim(coalesce(p_input ->> 'customer_address', '')), '');
  v_note := nullif(btrim(coalesce(p_input ->> 'note', '')), '');
  if length(v_name) not between 1 and 200 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
  if length(v_phone) not between 9 and 13 or v_phone !~ '^(\+84|0)(3|5|7|8|9)[0-9]{8}$' then
    raise exception 'INVALID_CUSTOMER_PHONE';
  end if;
  if v_email <> '' and (length(v_email) > 200 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'INVALID_CUSTOMER_EMAIL';
  end if;
  if v_address is not null and length(v_address) > 1000 then raise exception 'INVALID_CUSTOMER_ADDRESS'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'INVALID_NOTE'; end if;

  for v_item in select value from jsonb_array_elements(p_input -> 'items') loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'productId', '') !~ '^[0-9]{1,10}$'
       or jsonb_typeof(v_item -> 'sku') is distinct from 'string'
       or length(btrim(v_item ->> 'sku')) not between 1 and 100
       or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,2}$' then
      raise exception 'INVALID_ITEM';
    end if;
    if (v_item ->> 'productId')::numeric > 2147483647 then raise exception 'INVALID_ITEM'; end if;
    if (v_item ->> 'quantity')::integer not between 1 and 99 then raise exception 'INVALID_QUANTITY'; end if;
    if v_item ? 'installOption' and v_item ->> 'installOption' is null then raise exception 'INVALID_INSTALL_OPTION'; end if;
    if coalesce(v_item ->> 'installOption', 'none') not in ('none', 'install', 'replace') then
      raise exception 'INVALID_INSTALL_OPTION';
    end if;
    if jsonb_build_array(
      (v_item ->> 'productId')::integer,
      btrim(v_item ->> 'sku'),
      coalesce(v_item ->> 'installOption', 'none')
    )::text = any(v_selection_keys) then raise exception 'DUPLICATE_PRODUCT'; end if;
    v_selection_keys := array_append(v_selection_keys, jsonb_build_array(
      (v_item ->> 'productId')::integer,
      btrim(v_item ->> 'sku'),
      coalesce(v_item ->> 'installOption', 'none')
    )::text);
  end loop;

  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  v_request_hash := dpg_app.runtime_hash(p_input);
  perform pg_advisory_xact_lock(hashtextextended('dpg:guest-order:idempotency:' || v_key_hash, 0));
  select request_hash, safe_response into v_existing.request_hash, v_existing.safe_response
    from dpg_app.guest_order_idempotency_records
   where key_hash = v_key_hash;
  if found then
    if v_existing.request_hash <> v_request_hash then
      return jsonb_build_object('error', 'IDEMPOTENCY_KEY_REUSED');
    end if;
    return v_existing.safe_response;
  end if;

  v_phone_hash := dpg_app.runtime_key_hash(v_phone);
  perform pg_advisory_xact_lock(hashtextextended('dpg:guest-order:rate:' || v_phone_hash, 0));
  with expired_windows as (
    select phone_hash, window_start
    from dpg_app.guest_order_rate_limit_windows
    where window_start < now() - interval '1 hour'
    order by window_start
    limit 500
  )
  delete from dpg_app.guest_order_rate_limit_windows r
  using expired_windows e
  where r.phone_hash = e.phone_hash and r.window_start = e.window_start;
  insert into dpg_app.guest_order_rate_limit_windows (phone_hash, window_start, request_count)
  values (v_phone_hash, v_window_start, 1)
  on conflict (phone_hash, window_start) do update
    set request_count = dpg_app.guest_order_rate_limit_windows.request_count + 1
  returning request_count into v_request_count;
  if v_request_count > 3 then
    return jsonb_build_object('error', 'ORDER_RATE_LIMITED');
  end if;

  -- Keep the rate-limit increment outside this subtransaction. Known request
  -- failures roll back all order writes while retaining the abuse counter.
  begin
    for v_item in select value from jsonb_array_elements(p_input -> 'items') loop
      select id, sku, name, price, original_price, list_price, sale_price,
        online_discount_amount, stock_status, price_source, source_system,
        price_state, price_confidence, price_updated_at
        into v_product
      from dpg_app.products
      where id = (v_item ->> 'productId')::integer
        and sku = btrim(v_item ->> 'sku')
        and is_active
        and publication_status = 'public'
        and pdp_visibility = 'public'
        and sellable_status = 'sellable'
        -- Availability is reconfirmed by staff; these states may create only
        -- a pending request, never an accepted or fulfilled order.
        and stock_status in ('in_stock', 'pre_order', 'preorder', 'contact');
      if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;

      -- Match the frozen Public price allowlist: exact source identity,
      -- priced/high-confidence facts from 2026-07-02, and positive integer VND.
      -- Hita prices remain authoritative when optional comparison fields differ;
      -- manual prices additionally require matching list/original and sale facts.
      v_public_selling_price := case
        when v_product.price_source in ('hita', 'manual')
          and v_product.source_system = v_product.price_source
          and v_product.price_state = 'priced'
          and v_product.price_confidence = 'high'
          and v_product.price_updated_at is not null
          and (v_product.price_updated_at at time zone 'UTC')::date = date '2026-07-02'
          and v_product.price is not null
          and v_product.price > 0
          and v_product.price <= 1000000000
          and v_product.price = trunc(v_product.price)
          and (
            v_product.price_source = 'hita'
            or (
              v_product.sale_price = v_product.price
              and v_product.list_price is not null
              and v_product.list_price > 0
              and v_product.list_price <= 1000000000
              and v_product.list_price = trunc(v_product.list_price)
              and v_product.list_price >= v_product.price
              and v_product.original_price = v_product.list_price
            )
          )
          then v_product.price
        else null end;
      if v_public_selling_price is null then
        raise exception 'PRODUCT_REQUIRES_QUOTE';
      end if;

      v_list_price := case
        when v_product.list_price is not null
          and v_product.original_price = v_product.list_price
          and v_product.list_price >= v_public_selling_price
          and v_product.list_price <= 1000000000
          and v_product.list_price = trunc(v_product.list_price)
          then v_product.list_price
        else v_public_selling_price end;
      v_sale_price := case
        when v_public_selling_price < v_list_price then v_public_selling_price
        else null end;
      v_base_price := v_public_selling_price;
      v_online_discount := case
        when v_product.online_discount_amount > 0
          and v_product.online_discount_amount <= 1000000000
          and v_product.online_discount_amount = trunc(v_product.online_discount_amount)
          and v_product.online_discount_amount < v_base_price then v_product.online_discount_amount
        else null end;
      v_effective_discount := coalesce(v_online_discount, 0);
      v_install_option := coalesce(v_item ->> 'installOption', 'none');
      v_installation_fee := case v_install_option
        when 'none' then 0
        else null end;
      v_unit_price := v_base_price;
      v_final_unit_price := case when v_online_discount is null then null
        else v_base_price - v_online_discount end;
      v_line_total := v_unit_price * (v_item ->> 'quantity')::integer;
      v_subtotal := v_subtotal + v_line_total;
      v_discount := v_discount + v_effective_discount * (v_item ->> 'quantity')::integer;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'product_id', v_product.id,
        'product_name', case v_install_option
          when 'install' then v_product.name || ' (Cần Lắp Đặt)'
          when 'replace' then v_product.name || ' (Tháo dỡ & Lắp Đặt)'
          else v_product.name end,
        'product_sku', v_product.sku,
        'quantity', (v_item ->> 'quantity')::integer,
        'unit_price', v_unit_price,
        'total_price', v_line_total,
        'commercial_snapshot', jsonb_build_object(
          'list_price', v_list_price,
          'sale_price', v_sale_price,
          'online_discount_amount', v_online_discount,
          'installation_fee', v_installation_fee,
          'installation_fee_status', case when v_install_option = 'none' then 'not_applicable' else 'pending_confirmation' end,
          'install_option', v_install_option,
          'final_unit_price', v_final_unit_price,
          'snapshot_at', clock_timestamp()
        )
      ));
    end loop;

    v_order_total := v_subtotal - v_discount;
    v_order_id := nextval('dpg_app.orders_id_seq');
    v_order_number := ('DPG-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(lpad(to_hex(v_order_id), 8, '0')))::varchar(20);
    insert into dpg_app.orders (
      id, owner_id, order_number, customer_name, customer_phone, customer_email,
      customer_address, note, subtotal, discount, total, status, payment_status,
      order_origin, shipping_fee_status
    ) values (
      v_order_id, null, v_order_number, v_name, v_phone, nullif(v_email, ''),
      v_address, v_note, v_subtotal, v_discount, v_order_total, 'pending', 'unpaid',
      'public_web', 'pending_confirmation'
    );

    for v_line in select value from jsonb_array_elements(v_lines) loop
      insert into dpg_app.order_items (
        order_id, product_id, product_name, product_sku, quantity,
        unit_price, total_price, commercial_snapshot
      ) values (
        v_order_id, (v_line ->> 'product_id')::integer,
        left(v_line ->> 'product_name', 500), left(v_line ->> 'product_sku', 100),
        (v_line ->> 'quantity')::integer, (v_line ->> 'unit_price')::numeric,
        (v_line ->> 'total_price')::numeric, v_line -> 'commercial_snapshot'
      );
    end loop;

    v_safe_response := jsonb_build_object(
      'order_number', v_order_number,
      'status', 'pending',
      'payment_status', 'unpaid'
    );
    insert into dpg_app.guest_order_idempotency_records (
      key_hash, request_hash, safe_response
    ) values (
      v_key_hash, v_request_hash, v_safe_response
    );
    return v_safe_response;
  exception when others then
    v_error_code := SQLERRM;
    if v_error_code in (
      'INVALID_INPUT', 'INVALID_CUSTOMER_NAME', 'INVALID_CUSTOMER_PHONE',
      'INVALID_CUSTOMER_EMAIL', 'INVALID_CUSTOMER_ADDRESS', 'INVALID_NOTE',
      'INVALID_ITEM', 'INVALID_QUANTITY', 'DUPLICATE_PRODUCT',
      'INVALID_INSTALL_OPTION', 'PRODUCT_UNAVAILABLE', 'PRODUCT_REQUIRES_QUOTE',
      'IDEMPOTENCY_KEY_REUSED'
    ) then
      return jsonb_build_object('error', v_error_code);
    end if;
    raise exception 'ORDER_REQUEST_FAILED';
  end;
end;
$$;

create function public.guest_order_request_receipt(p_idempotency_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, dpg_app
set row_security = on
as $$
declare
  v_safe_response jsonb;
  v_order_number text;
begin
  if p_idempotency_key is null
     or btrim(p_idempotency_key) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  select safe_response into v_safe_response
  from dpg_app.guest_order_idempotency_records
  where key_hash = dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  if not found then return null; end if;

  v_order_number := v_safe_response ->> 'order_number';
  if jsonb_typeof(v_safe_response) <> 'object'
     or v_order_number !~ '^DPG-[0-9]{6}-[0-9A-F]{8}$'
     or v_safe_response ->> 'status' <> 'pending'
     or v_safe_response ->> 'payment_status' <> 'unpaid' then
    raise exception 'ORDER_REQUEST_FAILED';
  end if;

  return jsonb_build_object(
    'order_number', v_order_number,
    'status', 'pending',
    'payment_status', 'unpaid'
  );
end;
$$;

reset role;
grant create on schema public to dpg_order_intake_function_owner;
grant dpg_order_intake_function_owner to dpg_migration
  with set true, inherit false, admin false;
set role dpg_migration;
alter function public.guest_order_request_create(jsonb, text, uuid)
  owner to dpg_order_intake_function_owner;
alter function public.guest_order_request_receipt(text)
  owner to dpg_order_intake_function_owner;
set role dpg_order_intake_function_owner;

revoke all on function public.guest_order_request_create(jsonb, text, uuid),
  public.guest_order_request_receipt(text)
  from public, anon, authenticated, service_role, dpg_order_intake_login;
grant execute on function public.guest_order_request_create(jsonb, text, uuid) to dpg_order_intake;
grant execute on function public.guest_order_request_receipt(text) to dpg_order_intake;

comment on function public.guest_order_request_create(jsonb, text, uuid) is
  'Backend-only guest order request: SECURITY DEFINER owned by a no-login role with limited table/column grants and RLS policies; EXECUTE is granted only to dpg_order_intake.';

comment on function public.guest_order_request_receipt(text) is
  'Backend-only read of the minimal pending, unpaid receipt for a high-entropy idempotency key; the no-login function owner has limited table/column grants and RLS policies; EXECUTE is granted only to dpg_order_intake.';

reset role;
revoke dpg_order_intake_function_owner from dpg_migration;
revoke create on schema public from dpg_migration, dpg_order_intake_function_owner;

do $phase2_postflight$
declare
  function_count integer;
begin
  select count(*) into function_count
  from pg_proc p
  where p.oid in (
    'public.guest_order_request_create(jsonb,text,uuid)'::regprocedure,
    'public.guest_order_request_receipt(text)'::regprocedure
  )
    and p.prosecdef
    and pg_get_userbyid(p.proowner) = 'dpg_order_intake_function_owner'
    and p.proconfig @> array['search_path=pg_catalog, dpg_app', 'row_security=on'];

  if function_count <> 2
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or not has_schema_privilege('dpg_order_intake', 'public', 'USAGE')
     or has_schema_privilege('anon', 'dpg_app', 'USAGE')
     or has_function_privilege('anon', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.guest_order_request_receipt(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guest_order_request_receipt(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guest_order_request_receipt(text)', 'EXECUTE')
     or has_function_privilege('dpg_order_intake_login', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('dpg_order_intake_login', 'public.guest_order_request_receipt(text)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake_function_owner', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake_function_owner', 'public.guest_order_request_receipt(text)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake', 'public.guest_order_request_receipt(text)', 'EXECUTE')
     or has_schema_privilege('dpg_order_intake', 'dpg_app', 'USAGE')
     or has_table_privilege('dpg_order_intake', 'dpg_app.orders', 'SELECT')
     or has_table_privilege('dpg_order_intake', 'dpg_app.orders', 'INSERT')
     or has_table_privilege('dpg_order_intake', 'dpg_app.order_items', 'SELECT')
     or has_table_privilege('dpg_order_intake', 'dpg_app.products', 'SELECT')
     or has_table_privilege('dpg_order_intake', 'dpg_app.guest_order_idempotency_records', 'SELECT')
     or has_table_privilege('dpg_order_intake', 'dpg_app.guest_order_idempotency_records', 'DELETE')
     or has_table_privilege('dpg_order_intake', 'dpg_app.guest_order_rate_limit_windows', 'UPDATE')
     or has_schema_privilege('dpg_order_intake_login', 'dpg_app', 'USAGE')
     or not has_schema_privilege('dpg_order_intake_function_owner', 'dpg_app', 'USAGE')
     or not has_column_privilege('dpg_order_intake_function_owner', 'dpg_app.products', 'price', 'SELECT')
     or not has_column_privilege('dpg_order_intake_function_owner', 'dpg_app.orders', 'total', 'INSERT')
     or not has_column_privilege('dpg_order_intake_function_owner', 'dpg_app.order_items', 'commercial_snapshot', 'INSERT')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.orders', 'SELECT')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.orders', 'UPDATE')
     or has_table_privilege('dpg_order_intake_function_owner', 'dpg_app.orders', 'DELETE')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.order_items', 'SELECT')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.order_items', 'UPDATE')
     or has_table_privilege('dpg_order_intake_function_owner', 'dpg_app.order_items', 'DELETE')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.products', 'INSERT')
     or has_any_column_privilege('dpg_order_intake_function_owner', 'dpg_app.products', 'UPDATE')
     or has_table_privilege('dpg_order_intake_function_owner', 'dpg_app.products', 'DELETE')
     or has_function_privilege('dpg_order_intake', 'dpg_app.runtime_hash(jsonb)', 'EXECUTE')
     or has_function_privilege('dpg_order_intake', 'dpg_app.runtime_key_hash(text)', 'EXECUTE')
     or has_sequence_privilege('dpg_order_intake', 'dpg_app.orders_id_seq', 'USAGE')
     or has_sequence_privilege('dpg_order_intake', 'dpg_app.order_items_id_seq', 'USAGE')
     or exists (
       select 1 from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app'
         and c.relname in ('products', 'orders', 'order_items', 'guest_order_idempotency_records', 'guest_order_rate_limit_windows')
         and p.polname like 'phase2_guest_%'
         and p.polroles <> array[(select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')]
     )
     or not exists (
       select 1 from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app' and c.relname = 'guest_order_idempotency_records'
         and p.polname = 'phase2_guest_idempotency_select' and p.polcmd = 'r'
          and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')]
     )
     or not exists (
       select 1 from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app' and c.relname = 'guest_order_idempotency_records'
         and p.polname = 'phase2_guest_idempotency_insert' and p.polcmd = 'a'
          and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')]
     ) then
    raise exception 'DPG_PHASE2_POSTFLIGHT_FAILED';
  end if;
end
$phase2_postflight$;
