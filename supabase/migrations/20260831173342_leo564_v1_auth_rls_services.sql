-- LEO-564 Round 1: canonical V1 Auth, RLS, and service boundaries.
--
-- Source/local only. This migration does not create Auth users, change Auth
-- configuration, deploy an Edge Function, or select a remote project.
-- dpg_v1 is the only V1 authority; dpg_app and public legacy tables remain
-- evidence only.

create schema if not exists dpg_v1_api;
revoke all on schema dpg_v1_api from public;
grant usage on schema dpg_v1_api to anon, authenticated;

-- The fixed configuration is migration-owned. There is no custom role,
-- primary-role, wildcard, or user-editable capability path.
insert into dpg_v1.role_capabilities (role, capability) values
  ('Product', 'catalogue.read'),
  ('Product', 'catalogue.create'),
  ('Product', 'catalogue.update'),
  ('Product', 'catalogue.publish'),
  ('Product', 'catalogue.archive'),
  ('Product', 'marketing.collection.read'),
  ('Sales', 'catalogue.read'),
  ('Sales', 'marketing.collection.read'),
  ('Sales', 'sales.order.read'),
  ('Sales', 'sales.order.lifecycle.update'),
  ('Sales', 'sales.order.payment.update'),
  ('Sales', 'sales.order.archive'),
  ('Sales', 'sales.quote_request.read'),
  ('Sales', 'sales.quote.read'),
  ('Sales', 'sales.quote.create'),
  ('Sales', 'sales.quote.update'),
  ('Sales', 'sales.quote.publish'),
  ('Sales', 'sales.quote.archive'),
  ('Marketing', 'catalogue.read'),
  ('Marketing', 'marketing.content.read'),
  ('Marketing', 'marketing.content.create'),
  ('Marketing', 'marketing.content.update'),
  ('Marketing', 'marketing.content.publish'),
  ('Marketing', 'marketing.content.archive'),
  ('Marketing', 'marketing.collection.read'),
  ('Marketing', 'marketing.collection.create'),
  ('Marketing', 'marketing.collection.update'),
  ('Marketing', 'marketing.collection.publish'),
  ('Marketing', 'marketing.collection.archive'),
  ('Admin', 'catalogue.read'),
  ('Admin', 'catalogue.create'),
  ('Admin', 'catalogue.update'),
  ('Admin', 'catalogue.publish'),
  ('Admin', 'catalogue.archive'),
  ('Admin', 'sales.order.read'),
  ('Admin', 'sales.order.lifecycle.update'),
  ('Admin', 'sales.order.payment.update'),
  ('Admin', 'sales.order.archive'),
  ('Admin', 'sales.quote_request.read'),
  ('Admin', 'sales.quote.read'),
  ('Admin', 'sales.quote.create'),
  ('Admin', 'sales.quote.update'),
  ('Admin', 'sales.quote.publish'),
  ('Admin', 'sales.quote.archive'),
  ('Admin', 'marketing.content.read'),
  ('Admin', 'marketing.content.create'),
  ('Admin', 'marketing.content.update'),
  ('Admin', 'marketing.content.publish'),
  ('Admin', 'marketing.content.archive'),
  ('Admin', 'marketing.collection.read'),
  ('Admin', 'marketing.collection.create'),
  ('Admin', 'marketing.collection.update'),
  ('Admin', 'marketing.collection.publish'),
  ('Admin', 'marketing.collection.archive'),
  ('Admin', 'admin.staff.read'),
  ('Admin', 'admin.staff.create'),
  ('Admin', 'admin.staff.update'),
  ('Admin', 'admin.staff.disable'),
  ('Admin', 'admin.staff.assign_roles'),
  ('Admin', 'admin.config.read'),
  ('Admin', 'admin.config.create'),
  ('Admin', 'admin.config.update');

create table dpg_v1.service_idempotency_records (
  scope_key text not null,
  operation text not null,
  key_hash char(64) not null,
  request_hash char(64) not null,
  resource_type text not null,
  resource_id uuid,
  safe_response jsonb,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key (scope_key, operation, key_hash),
  constraint service_idempotency_scope_check check (btrim(scope_key) <> '' and length(scope_key) <= 100),
  constraint service_idempotency_operation_check check (operation in (
    'order_intake.create', 'quote_request_intake.create',
    'catalogue.product.create', 'catalogue.product.update',
    'catalogue.product.publish', 'catalogue.product.archive',
    'marketing.content.create', 'marketing.content.update',
    'marketing.content.publish', 'marketing.content.archive',
    'marketing.collection.create', 'marketing.collection.update',
    'marketing.collection.publish', 'marketing.collection.archive',
    'sales.order.lifecycle.update', 'sales.order.payment.update',
    'sales.order.archive', 'sales.quote.create', 'sales.quote.update',
    'sales.quote.publish', 'sales.quote.archive', 'sales.quote.revoke_share',
    'staff.user.provision', 'staff.user.assign_roles', 'staff.user.disable'
  )),
  constraint service_idempotency_resource_check check (resource_type in (
    'order', 'quote_request', 'product', 'content_entry', 'collection',
    'quote', 'staff_user'
  )),
  constraint service_idempotency_hash_check check (
    key_hash ~ '^[0-9a-f]{64}$' and request_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint service_idempotency_expiry_check check (expires_at > created_at)
);

create index service_idempotency_expiry_idx
  on dpg_v1.service_idempotency_records (expires_at);

create function dpg_v1.sha256_text(p_value text)
returns char(64)
language sql
immutable
strict
security invoker
set search_path = pg_catalog
as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex')::char(64)
$$;

create function dpg_v1.sha256_json(p_value jsonb)
returns char(64)
language sql
immutable
strict
security invoker
set search_path = pg_catalog, dpg_v1
as $$
  select dpg_v1.sha256_text(p_value::text)
$$;

create function dpg_v1.current_staff_context()
returns table (
  auth_user_id uuid,
  email text,
  display_name text,
  status dpg_v1.staff_status,
  roles dpg_v1.staff_role[],
  capabilities dpg_v1.staff_capability[]
)
language sql
stable
security definer
set search_path = pg_catalog, dpg_v1
as $$
  select
    su.auth_user_id,
    su.email,
    su.display_name,
    su.status,
    coalesce(
      (
        select array_agg(distinct sur.role order by sur.role)
        from dpg_v1.staff_user_roles sur
        where sur.auth_user_id = su.auth_user_id
      ),
      '{}'::dpg_v1.staff_role[]
    ),
    coalesce(
      (
        select array_agg(distinct rc.capability order by rc.capability)
        from dpg_v1.staff_user_roles sur
        join dpg_v1.role_capabilities rc on rc.role = sur.role
        where sur.auth_user_id = su.auth_user_id
      ),
      '{}'::dpg_v1.staff_capability[]
    )
  from dpg_v1.staff_users su
  where su.auth_user_id = auth.uid()
    and su.status = 'active'
$$;

create function dpg_v1.current_staff_user_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, dpg_v1
as $$
  select auth_user_id from dpg_v1.current_staff_context() limit 1
$$;

create function dpg_v1.staff_has_capability(p_capability dpg_v1.staff_capability)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, dpg_v1
as $$
begin
  if auth.uid() is null or p_capability is null then
    return false;
  end if;

  return exists (
    select 1
    from dpg_v1.current_staff_context() context
    where p_capability = any(context.capabilities)
  );
end
$$;

create function dpg_v1.require_capability(p_capability dpg_v1.staff_capability)
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  actor_id uuid;
begin
  actor_id := dpg_v1.current_staff_user_id();
  if actor_id is null or not dpg_v1.staff_has_capability(p_capability) then
    raise exception 'FORBIDDEN';
  end if;
  return actor_id;
end
$$;

create function dpg_v1.enforce_staff_attribution()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
begin
  if auth.uid() is not null then
    new.updated_at := clock_timestamp();
    new.updated_by := auth.uid();
  end if;
  return new;
end
$$;

create trigger staff_users_attribution
before insert or update on dpg_v1.staff_users
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger staff_user_roles_attribution
before insert or update on dpg_v1.staff_user_roles
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger media_assets_attribution
before insert or update on dpg_v1.media_assets
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger brands_attribution
before insert or update on dpg_v1.brands
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger categories_attribution
before insert or update on dpg_v1.categories
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_families_attribution
before insert or update on dpg_v1.product_families
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_family_groups_attribution
before insert or update on dpg_v1.product_family_configuration_groups
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger products_attribution
before insert or update on dpg_v1.products
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_family_memberships_attribution
before insert or update on dpg_v1.product_family_memberships
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_provenance_attribution
before insert or update on dpg_v1.product_source_provenance
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger collections_attribution
before insert or update on dpg_v1.collections
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger collection_products_attribution
before insert or update on dpg_v1.collection_products
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger attribute_definitions_attribution
before insert or update on dpg_v1.attribute_definitions
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger attribute_options_attribution
before insert or update on dpg_v1.attribute_options
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger category_attribute_policies_attribution
before insert or update on dpg_v1.category_attribute_policies
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_attribute_values_attribution
before insert or update on dpg_v1.product_attribute_values
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_media_attribution
before insert or update on dpg_v1.product_media
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger product_documents_attribution
before insert or update on dpg_v1.product_documents
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger content_entries_attribution
before insert or update on dpg_v1.content_entries
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger content_blocks_attribution
before insert or update on dpg_v1.content_blocks
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger quotes_attribution
before insert or update on dpg_v1.quotes
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger quote_lines_attribution
before insert or update on dpg_v1.quote_lines
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger quote_shares_attribution
before insert or update on dpg_v1.quote_shares
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger orders_attribution
before insert or update on dpg_v1.orders
for each row execute function dpg_v1.enforce_staff_attribution();

create function dpg_v1.content_publication_failures(p_content_entry_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1
as $$
  select array_remove(array[
    case when btrim(ce.title) = '' then 'TITLE' end,
    case when not exists (
      select 1 from dpg_v1.content_blocks cb where cb.content_entry_id = ce.id
    ) then 'BLOCKS' end,
    case when ce.hero_media_id is not null and not exists (
      select 1 from dpg_v1.media_assets ma
      where ma.id = ce.hero_media_id and ma.kind = 'IMAGE' and ma.state = 'READY'
    ) then 'HERO_MEDIA' end,
    case when exists (
      select 1
      from dpg_v1.content_blocks cb
      left join dpg_v1.media_assets ma on ma.id = cb.media_asset_id
      where cb.content_entry_id = ce.id
        and cb.block_type = 'MEDIA'
        and (ma.id is null or ma.kind <> 'IMAGE' or ma.state <> 'READY')
    ) then 'BLOCK_MEDIA' end,
    case when ce.type = 'LANDING_PAGE' and ce.route_path is null then 'ROUTE' end
  ], null)
  from dpg_v1.content_entries ce
  where ce.id = p_content_entry_id
$$;

create function dpg_v1.collection_publication_failures(p_collection_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1
as $$
  select array_remove(array[
    case when not exists (
      select 1 from dpg_v1.collection_products cp
      where cp.collection_id = c.id
    ) then 'PRODUCTS' end,
    case when exists (
      select 1
      from dpg_v1.collection_products cp
      join dpg_v1.products p on p.id = cp.product_id
      where cp.collection_id = c.id
        and (p.status <> 'PUBLISHED' or cardinality(dpg_v1.product_publication_failures(p.id)) <> 0)
    ) then 'PUBLIC_PRODUCTS' end,
    case when c.hero_media_id is not null and not exists (
      select 1 from dpg_v1.media_assets ma
      where ma.id = c.hero_media_id and ma.kind = 'IMAGE' and ma.state = 'READY'
    ) then 'HERO_MEDIA' end
  ], null)
  from dpg_v1.collections c
  where c.id = p_collection_id
$$;

create function dpg_v1.enforce_content_publication()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare failures text[];
begin
  if new.status = 'PUBLISHED' then
    if tg_op = 'INSERT' then
      raise exception 'CONTENT_MUST_BE_DRAFT_BEFORE_PUBLICATION';
    end if;
    failures := dpg_v1.content_publication_failures(new.id);
    if cardinality(failures) <> 0 then
      raise exception 'CONTENT_NOT_PUBLISHABLE:%', array_to_string(failures, ',');
    end if;
  end if;
  return new;
end
$$;

create trigger content_entries_enforce_publication
before insert or update on dpg_v1.content_entries
for each row execute function dpg_v1.enforce_content_publication();

create function dpg_v1.enforce_collection_publication()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare failures text[];
begin
  if new.status = 'PUBLISHED' then
    if tg_op = 'INSERT' then
      raise exception 'COLLECTION_MUST_BE_DRAFT_BEFORE_PUBLICATION';
    end if;
    failures := dpg_v1.collection_publication_failures(new.id);
    if cardinality(failures) <> 0 then
      raise exception 'COLLECTION_NOT_PUBLISHABLE:%', array_to_string(failures, ',');
    end if;
  end if;
  return new;
end
$$;

create trigger collections_enforce_publication
before insert or update on dpg_v1.collections
for each row execute function dpg_v1.enforce_collection_publication();

create function dpg_v1.reserve_idempotency(
  p_scope_key text,
  p_operation text,
  p_request_hash char(64),
  p_idempotency_key text,
  p_resource_type text,
  p_resource_id uuid default null
)
returns table (key_hash char(64), safe_response jsonb, replay boolean)
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  computed_key_hash char(64);
  existing dpg_v1.service_idempotency_records%rowtype;
begin
  if p_scope_key is null or btrim(p_scope_key) = '' or length(p_scope_key) > 100 then
    raise exception 'INVALID_IDEMPOTENCY_SCOPE';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_REQUEST_HASH';
  end if;

  computed_key_hash := dpg_v1.sha256_text(btrim(p_idempotency_key));
  perform pg_advisory_xact_lock(hashtextextended(
    'dpg_v1:idempotency:' || p_scope_key || ':' || p_operation || ':' || computed_key_hash, 0
  ));
  delete from dpg_v1.service_idempotency_records records
  where records.scope_key = p_scope_key and records.operation = p_operation
    and records.key_hash = computed_key_hash and records.expires_at <= clock_timestamp();

  insert into dpg_v1.service_idempotency_records (
    scope_key, operation, key_hash, request_hash, resource_type, resource_id,
    safe_response, expires_at
  ) values (
    p_scope_key, p_operation, computed_key_hash, p_request_hash, p_resource_type,
    p_resource_id, null, clock_timestamp() + interval '24 hours'
  ) on conflict on constraint service_idempotency_records_pkey do nothing;

  if found then
    return query select computed_key_hash, null::jsonb, false;
    return;
  end if;

  select * into existing
  from dpg_v1.service_idempotency_records records
  where records.scope_key = p_scope_key and records.operation = p_operation
    and records.key_hash = computed_key_hash
  for update;
  if existing.request_hash <> p_request_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if existing.safe_response is null then
    raise exception 'IDEMPOTENCY_IN_PROGRESS';
  end if;
  return query select computed_key_hash, existing.safe_response, true;
end
$$;

-- These canonical constraint-trigger checks must see the rows being assembled
-- by a guest create-only transaction. They are private, read-only checks with
-- a fixed search path; application callers still cannot invoke them directly.
create or replace function dpg_v1.validate_order_payment_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, dpg_v1
as $$
declare
  expected_paid numeric(15,2);
  expected_refunded numeric(15,2);
  expected_status dpg_v1.payment_status;
begin
  select coalesce(sum(amount) filter (where transaction_type = 'PAYMENT'), 0),
         coalesce(sum(amount) filter (where transaction_type = 'REFUND'), 0)
    into expected_paid, expected_refunded
  from dpg_v1.payment_transactions where order_id = new.id;
  expected_status := case
    when expected_refunded > 0 then 'REFUNDED'::dpg_v1.payment_status
    when expected_paid = 0 then 'UNPAID'::dpg_v1.payment_status
    when expected_paid < new.total then 'PARTIALLY_PAID'::dpg_v1.payment_status
    else 'PAID'::dpg_v1.payment_status
  end;
  if new.paid_amount <> expected_paid or new.refunded_amount <> expected_refunded
     or new.payment_status <> expected_status then
    raise exception 'PAYMENT_PROJECTION_IS_TRANSACTION_DERIVED';
  end if;
  return new;
end
$$;

create or replace function dpg_v1.validate_order_line_totals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, dpg_v1
as $$
declare target_order uuid; expected_subtotal numeric(15,2); actual_subtotal numeric(15,2);
begin
  target_order := coalesce(new.order_id, old.order_id);
  select subtotal into expected_subtotal from dpg_v1.orders where id = target_order;
  if not found then return null; end if;
  select coalesce(sum(line_total), 0) into actual_subtotal from dpg_v1.order_lines where order_id = target_order;
  if expected_subtotal <> actual_subtotal then raise exception 'ORDER_LINE_TOTAL_MISMATCH'; end if;
  return null;
end
$$;

create or replace function dpg_v1.validate_order_header_line_totals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, dpg_v1
as $$
declare expected_subtotal numeric(15,2); actual_subtotal numeric(15,2);
begin
  expected_subtotal := new.subtotal;
  select coalesce(sum(line_total), 0) into actual_subtotal from dpg_v1.order_lines where order_id = new.id;
  if expected_subtotal <> actual_subtotal then raise exception 'ORDER_LINE_TOTAL_MISMATCH'; end if;
  return null;
end
$$;

-- Every dpg_v1 object is forced through an explicit policy. The private
-- schema is never a browser-facing table namespace.
alter table dpg_v1.staff_users enable row level security;
alter table dpg_v1.staff_users force row level security;
alter table dpg_v1.staff_user_roles enable row level security;
alter table dpg_v1.staff_user_roles force row level security;
alter table dpg_v1.role_capabilities enable row level security;
alter table dpg_v1.role_capabilities force row level security;
alter table dpg_v1.service_idempotency_records enable row level security;
alter table dpg_v1.service_idempotency_records force row level security;
alter table dpg_v1.media_assets enable row level security;
alter table dpg_v1.media_assets force row level security;
alter table dpg_v1.brands enable row level security;
alter table dpg_v1.brands force row level security;
alter table dpg_v1.categories enable row level security;
alter table dpg_v1.categories force row level security;
alter table dpg_v1.product_families enable row level security;
alter table dpg_v1.product_families force row level security;
alter table dpg_v1.product_family_configuration_groups enable row level security;
alter table dpg_v1.product_family_configuration_groups force row level security;
alter table dpg_v1.products enable row level security;
alter table dpg_v1.products force row level security;
alter table dpg_v1.product_family_memberships enable row level security;
alter table dpg_v1.product_family_memberships force row level security;
alter table dpg_v1.product_source_provenance enable row level security;
alter table dpg_v1.product_source_provenance force row level security;
alter table dpg_v1.collections enable row level security;
alter table dpg_v1.collections force row level security;
alter table dpg_v1.collection_products enable row level security;
alter table dpg_v1.collection_products force row level security;
alter table dpg_v1.attribute_definitions enable row level security;
alter table dpg_v1.attribute_definitions force row level security;
alter table dpg_v1.attribute_options enable row level security;
alter table dpg_v1.attribute_options force row level security;
alter table dpg_v1.category_attribute_policies enable row level security;
alter table dpg_v1.category_attribute_policies force row level security;
alter table dpg_v1.product_attribute_values enable row level security;
alter table dpg_v1.product_attribute_values force row level security;
alter table dpg_v1.product_attribute_multi_options enable row level security;
alter table dpg_v1.product_attribute_multi_options force row level security;
alter table dpg_v1.product_media enable row level security;
alter table dpg_v1.product_media force row level security;
alter table dpg_v1.product_documents enable row level security;
alter table dpg_v1.product_documents force row level security;
alter table dpg_v1.content_entries enable row level security;
alter table dpg_v1.content_entries force row level security;
alter table dpg_v1.content_blocks enable row level security;
alter table dpg_v1.content_blocks force row level security;
alter table dpg_v1.content_product_references enable row level security;
alter table dpg_v1.content_product_references force row level security;
alter table dpg_v1.content_category_references enable row level security;
alter table dpg_v1.content_category_references force row level security;
alter table dpg_v1.content_brand_references enable row level security;
alter table dpg_v1.content_brand_references force row level security;
alter table dpg_v1.quote_requests enable row level security;
alter table dpg_v1.quote_requests force row level security;
alter table dpg_v1.quote_request_lines enable row level security;
alter table dpg_v1.quote_request_lines force row level security;
alter table dpg_v1.quotes enable row level security;
alter table dpg_v1.quotes force row level security;
alter table dpg_v1.quote_lines enable row level security;
alter table dpg_v1.quote_lines force row level security;
alter table dpg_v1.quote_shares enable row level security;
alter table dpg_v1.quote_shares force row level security;
alter table dpg_v1.orders enable row level security;
alter table dpg_v1.orders force row level security;
alter table dpg_v1.order_lines enable row level security;
alter table dpg_v1.order_lines force row level security;
alter table dpg_v1.payment_transactions enable row level security;
alter table dpg_v1.payment_transactions force row level security;
alter table dpg_v1.commerce_idempotency_records enable row level security;
alter table dpg_v1.commerce_idempotency_records force row level security;

revoke all on all tables in schema dpg_v1 from public, anon, authenticated, service_role;
revoke all on all sequences in schema dpg_v1 from public, anon, authenticated, service_role;

-- Public reads are granted only to the invoker RPC/views. The underlying
-- private tables are not in the Data API schema.
grant select on table
  dpg_v1.media_assets, dpg_v1.brands, dpg_v1.categories,
  dpg_v1.product_families, dpg_v1.product_family_configuration_groups,
  dpg_v1.product_family_memberships, dpg_v1.products,
  dpg_v1.product_source_provenance, dpg_v1.product_media,
  dpg_v1.product_documents, dpg_v1.collections, dpg_v1.collection_products,
  dpg_v1.attribute_definitions, dpg_v1.attribute_options,
  dpg_v1.category_attribute_policies, dpg_v1.product_attribute_values,
  dpg_v1.product_attribute_multi_options, dpg_v1.content_entries,
  dpg_v1.content_blocks, dpg_v1.content_product_references,
  dpg_v1.content_category_references, dpg_v1.content_brand_references
to anon;

-- These grants support the narrow SECURITY INVOKER guest RPCs below. The
-- canonical schema remains private and is intentionally absent from the
-- PostgREST exposed-schema list; there is no browser table-write surface.
grant insert on table dpg_v1.quote_requests, dpg_v1.quote_request_lines,
  dpg_v1.orders, dpg_v1.order_lines, dpg_v1.service_idempotency_records to anon;
grant select, insert, update, delete on table dpg_v1.service_idempotency_records to anon;
grant select on table dpg_v1.quotes, dpg_v1.quote_lines, dpg_v1.quote_shares to anon;

-- Authenticated invoker RPCs use these exact table privileges; no canonical
-- table is exposed in dpg_v1_api as a writable relation.
grant select on table
  dpg_v1.staff_users, dpg_v1.staff_user_roles,
  dpg_v1.media_assets, dpg_v1.brands, dpg_v1.categories,
  dpg_v1.product_families, dpg_v1.product_family_configuration_groups,
  dpg_v1.product_family_memberships, dpg_v1.products,
  dpg_v1.product_source_provenance, dpg_v1.collections,
  dpg_v1.collection_products, dpg_v1.attribute_definitions,
  dpg_v1.attribute_options, dpg_v1.category_attribute_policies,
  dpg_v1.product_attribute_values, dpg_v1.product_attribute_multi_options,
  dpg_v1.product_media, dpg_v1.product_documents, dpg_v1.content_entries,
  dpg_v1.content_blocks, dpg_v1.content_product_references,
  dpg_v1.content_category_references, dpg_v1.content_brand_references,
  dpg_v1.quote_requests, dpg_v1.quote_request_lines, dpg_v1.quotes,
  dpg_v1.quote_lines, dpg_v1.quote_shares, dpg_v1.orders,
  dpg_v1.order_lines, dpg_v1.payment_transactions,
  dpg_v1.service_idempotency_records, dpg_v1.commerce_idempotency_records
to authenticated;
grant insert, update on table dpg_v1.staff_users to authenticated;
grant insert, update, delete on table dpg_v1.staff_user_roles to authenticated;
grant insert, update on table dpg_v1.media_assets, dpg_v1.brands,
  dpg_v1.categories, dpg_v1.product_families,
  dpg_v1.product_family_configuration_groups, dpg_v1.products,
  dpg_v1.product_source_provenance, dpg_v1.collections,
  dpg_v1.attribute_definitions, dpg_v1.attribute_options,
  dpg_v1.category_attribute_policies, dpg_v1.product_attribute_values,
  dpg_v1.product_attribute_multi_options, dpg_v1.product_media,
  dpg_v1.product_documents, dpg_v1.content_entries, dpg_v1.content_blocks,
  dpg_v1.content_product_references, dpg_v1.content_category_references,
  dpg_v1.content_brand_references, dpg_v1.quotes, dpg_v1.quote_shares
to authenticated;
grant insert, update, delete on table dpg_v1.product_family_memberships,
  dpg_v1.collection_products, dpg_v1.quote_lines to authenticated;
grant delete on table dpg_v1.content_blocks to authenticated;
grant insert on table dpg_v1.payment_transactions to authenticated;
grant insert on table dpg_v1.orders, dpg_v1.order_lines to authenticated;
grant update (status, payment_status, paid_amount, refunded_amount, updated_at, updated_by)
  on table dpg_v1.orders to authenticated;
grant insert, update on table dpg_v1.service_idempotency_records,
  dpg_v1.commerce_idempotency_records to authenticated;
grant delete on table dpg_v1.service_idempotency_records to authenticated;

-- Only the transaction functions need the immutable quote/order snapshot
-- columns. Direct browser writes still cannot reach the private schema.

-- Staff identity and fixed-role policy.
create policy v1_staff_users_select_self on dpg_v1.staff_users
for select to authenticated
using (auth_user_id = auth.uid() and status = 'active');
create policy v1_staff_users_select_admin on dpg_v1.staff_users
for select to authenticated
using (dpg_v1.staff_has_capability('admin.staff.read'));
create policy v1_staff_users_insert on dpg_v1.staff_users
for insert to authenticated
with check (dpg_v1.staff_has_capability('admin.staff.create') and status = 'invited');
create policy v1_staff_users_update on dpg_v1.staff_users
for update to authenticated
using (dpg_v1.staff_has_capability('admin.staff.update') or dpg_v1.staff_has_capability('admin.staff.disable'))
with check (dpg_v1.staff_has_capability('admin.staff.update') or dpg_v1.staff_has_capability('admin.staff.disable'));

create policy v1_staff_roles_select_self on dpg_v1.staff_user_roles
for select to authenticated
using (auth_user_id = auth.uid() and exists (
  select 1 from dpg_v1.staff_users su
  where su.auth_user_id = staff_user_roles.auth_user_id and su.status = 'active'
));
create policy v1_staff_roles_select_admin on dpg_v1.staff_user_roles
for select to authenticated
using (dpg_v1.staff_has_capability('admin.staff.read'));
create policy v1_staff_roles_insert on dpg_v1.staff_user_roles
for insert to authenticated
with check (dpg_v1.staff_has_capability('admin.staff.assign_roles'));
create policy v1_staff_roles_update on dpg_v1.staff_user_roles
for update to authenticated
using (dpg_v1.staff_has_capability('admin.staff.assign_roles'))
with check (dpg_v1.staff_has_capability('admin.staff.assign_roles'));
create policy v1_staff_roles_delete on dpg_v1.staff_user_roles
for delete to authenticated
using (dpg_v1.staff_has_capability('admin.staff.assign_roles'));

-- Anonymous/public catalogue projections. The deeper publication function is
-- evaluated only after the simple PUBLISHED policy, avoiding recursive RLS.
create policy v1_products_public_select on dpg_v1.products
for select to anon using (status = 'PUBLISHED');
create policy v1_products_staff_select on dpg_v1.products
for select to authenticated
using (status = 'PUBLISHED' or dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_products_create on dpg_v1.products
for insert to authenticated
with check (dpg_v1.staff_has_capability('catalogue.create') and status = 'DRAFT');
create policy v1_products_update on dpg_v1.products
for update to authenticated
using (dpg_v1.staff_has_capability('catalogue.update')
  or dpg_v1.staff_has_capability('catalogue.publish')
  or dpg_v1.staff_has_capability('catalogue.archive'))
with check (dpg_v1.staff_has_capability('catalogue.update')
  or dpg_v1.staff_has_capability('catalogue.publish')
  or dpg_v1.staff_has_capability('catalogue.archive'));

create policy v1_brands_public_select on dpg_v1.brands
for select to anon using (is_active);
create policy v1_brands_staff_select on dpg_v1.brands
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_brands_write on dpg_v1.brands
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

create policy v1_categories_public_select on dpg_v1.categories
for select to anon using (is_active);
create policy v1_categories_staff_select on dpg_v1.categories
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_categories_write on dpg_v1.categories
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

create policy v1_media_public_select on dpg_v1.media_assets
for select to anon using (state = 'READY');
create policy v1_media_staff_select on dpg_v1.media_assets
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_media_write on dpg_v1.media_assets
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

create policy v1_family_public_select on dpg_v1.product_families
for select to anon using (exists (
  select 1 from dpg_v1.product_family_memberships m
  join dpg_v1.products p on p.id = m.product_id
  where m.family_id = product_families.id and p.status = 'PUBLISHED'
));
create policy v1_family_staff_select on dpg_v1.product_families
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_family_write on dpg_v1.product_families
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_family_group_public_select on dpg_v1.product_family_configuration_groups
for select to anon using (exists (
  select 1 from dpg_v1.product_family_memberships m
  join dpg_v1.products p on p.id = m.product_id
  where m.family_id = product_family_configuration_groups.family_id and p.status = 'PUBLISHED'
));
create policy v1_family_group_staff_select on dpg_v1.product_family_configuration_groups
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_family_group_write on dpg_v1.product_family_configuration_groups
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_family_membership_public_select on dpg_v1.product_family_memberships
for select to anon using (exists (
  select 1 from dpg_v1.products p where p.id = product_family_memberships.product_id and p.status = 'PUBLISHED'
));
create policy v1_family_membership_staff_select on dpg_v1.product_family_memberships
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_family_membership_write on dpg_v1.product_family_memberships
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

create policy v1_provenance_public_select on dpg_v1.product_source_provenance
for select to anon using (exists (
  select 1 from dpg_v1.products p where p.id = product_source_provenance.product_id and p.status = 'PUBLISHED'
));
create policy v1_provenance_staff_select on dpg_v1.product_source_provenance
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_provenance_write on dpg_v1.product_source_provenance
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

create policy v1_collection_public_select on dpg_v1.collections
for select to anon using (status = 'PUBLISHED');
create policy v1_collection_staff_select on dpg_v1.collections
for select to authenticated using (dpg_v1.staff_has_capability('marketing.collection.read'));
create policy v1_collection_write on dpg_v1.collections
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.collection.update')
  or dpg_v1.staff_has_capability('marketing.collection.publish')
  or dpg_v1.staff_has_capability('marketing.collection.archive'))
with check (dpg_v1.staff_has_capability('marketing.collection.create')
  or dpg_v1.staff_has_capability('marketing.collection.update')
  or dpg_v1.staff_has_capability('marketing.collection.publish')
  or dpg_v1.staff_has_capability('marketing.collection.archive'));
create policy v1_collection_product_public_select on dpg_v1.collection_products
for select to anon using (exists (
  select 1 from dpg_v1.collections c join dpg_v1.products p on p.id = collection_products.product_id
  where c.id = collection_products.collection_id and c.status = 'PUBLISHED' and p.status = 'PUBLISHED'
));
create policy v1_collection_product_staff_select on dpg_v1.collection_products
for select to authenticated using (dpg_v1.staff_has_capability('marketing.collection.read'));
create policy v1_collection_product_write on dpg_v1.collection_products
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.collection.update'))
with check (dpg_v1.staff_has_capability('marketing.collection.update'));

create policy v1_attribute_definition_public_select on dpg_v1.attribute_definitions
for select to anon using (exists (
  select 1 from dpg_v1.category_attribute_policies cap
  join dpg_v1.products p on p.primary_category_id = cap.category_id
  where cap.attribute_definition_id = attribute_definitions.id and p.status = 'PUBLISHED'
));
create policy v1_attribute_definition_staff_select on dpg_v1.attribute_definitions
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_attribute_definition_write on dpg_v1.attribute_definitions
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_attribute_option_public_select on dpg_v1.attribute_options
for select to anon using (exists (
  select 1 from dpg_v1.product_attribute_values pav
  join dpg_v1.products p on p.id = pav.product_id
  where pav.attribute_definition_id = attribute_options.attribute_definition_id and p.status = 'PUBLISHED'
));
create policy v1_attribute_option_staff_select on dpg_v1.attribute_options
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_attribute_option_write on dpg_v1.attribute_options
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_attribute_policy_public_select on dpg_v1.category_attribute_policies
for select to anon using (exists (
  select 1 from dpg_v1.products p where p.primary_category_id = category_attribute_policies.category_id and p.status = 'PUBLISHED'
));
create policy v1_attribute_policy_staff_select on dpg_v1.category_attribute_policies
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_attribute_policy_write on dpg_v1.category_attribute_policies
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_attribute_value_public_select on dpg_v1.product_attribute_values
for select to anon using (exists (
  select 1 from dpg_v1.products p where p.id = product_attribute_values.product_id and p.status = 'PUBLISHED'
));
create policy v1_attribute_value_staff_select on dpg_v1.product_attribute_values
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_attribute_value_write on dpg_v1.product_attribute_values
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_multi_option_public_select on dpg_v1.product_attribute_multi_options
for select to anon using (exists (
  select 1 from dpg_v1.product_attribute_values pav join dpg_v1.products p on p.id = pav.product_id
  where pav.id = product_attribute_multi_options.product_attribute_value_id and p.status = 'PUBLISHED'
));
create policy v1_multi_option_staff_select on dpg_v1.product_attribute_multi_options
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_multi_option_write on dpg_v1.product_attribute_multi_options
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

create policy v1_product_media_public_select on dpg_v1.product_media
for select to anon using (exists (
  select 1 from dpg_v1.products p where p.id = product_media.product_id and p.status = 'PUBLISHED'
));
create policy v1_product_media_staff_select on dpg_v1.product_media
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_product_media_write on dpg_v1.product_media
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));
create policy v1_product_document_public_select on dpg_v1.product_documents
for select to anon using (is_public and exists (
  select 1 from dpg_v1.products p where p.id = product_documents.product_id and p.status = 'PUBLISHED'
));
create policy v1_product_document_staff_select on dpg_v1.product_documents
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_product_document_write on dpg_v1.product_documents
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

-- V1 content is typed content, not the legacy Blog authority.
create policy v1_content_public_select on dpg_v1.content_entries
for select to anon using (status = 'PUBLISHED');
create policy v1_content_staff_select on dpg_v1.content_entries
for select to authenticated using (dpg_v1.staff_has_capability('marketing.content.read'));
create policy v1_content_write on dpg_v1.content_entries
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.content.update')
  or dpg_v1.staff_has_capability('marketing.content.publish')
  or dpg_v1.staff_has_capability('marketing.content.archive'))
with check (dpg_v1.staff_has_capability('marketing.content.create')
  or dpg_v1.staff_has_capability('marketing.content.update')
  or dpg_v1.staff_has_capability('marketing.content.publish')
  or dpg_v1.staff_has_capability('marketing.content.archive'));
create policy v1_content_block_public_select on dpg_v1.content_blocks
for select to anon using (exists (
  select 1 from dpg_v1.content_entries ce where ce.id = content_blocks.content_entry_id and ce.status = 'PUBLISHED'
));
create policy v1_content_block_staff_select on dpg_v1.content_blocks
for select to authenticated using (dpg_v1.staff_has_capability('marketing.content.read'));
create policy v1_content_block_write on dpg_v1.content_blocks
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.content.update'))
with check (dpg_v1.staff_has_capability('marketing.content.update'));
create policy v1_content_product_ref_public_select on dpg_v1.content_product_references
for select to anon using (exists (
  select 1 from dpg_v1.content_entries ce where ce.id = content_product_references.content_entry_id and ce.status = 'PUBLISHED'
));
create policy v1_content_product_ref_staff_select on dpg_v1.content_product_references
for select to authenticated using (dpg_v1.staff_has_capability('marketing.content.read'));
create policy v1_content_product_ref_write on dpg_v1.content_product_references
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.content.update'))
with check (dpg_v1.staff_has_capability('marketing.content.update'));
create policy v1_content_category_ref_public_select on dpg_v1.content_category_references
for select to anon using (exists (
  select 1 from dpg_v1.content_entries ce where ce.id = content_category_references.content_entry_id and ce.status = 'PUBLISHED'
));
create policy v1_content_category_ref_staff_select on dpg_v1.content_category_references
for select to authenticated using (dpg_v1.staff_has_capability('marketing.content.read'));
create policy v1_content_category_ref_write on dpg_v1.content_category_references
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.content.update'))
with check (dpg_v1.staff_has_capability('marketing.content.update'));
create policy v1_content_brand_ref_public_select on dpg_v1.content_brand_references
for select to anon using (exists (
  select 1 from dpg_v1.content_entries ce where ce.id = content_brand_references.content_entry_id and ce.status = 'PUBLISHED'
));
create policy v1_content_brand_ref_staff_select on dpg_v1.content_brand_references
for select to authenticated using (dpg_v1.staff_has_capability('marketing.content.read'));
create policy v1_content_brand_ref_write on dpg_v1.content_brand_references
for all to authenticated
using (dpg_v1.staff_has_capability('marketing.content.update'))
with check (dpg_v1.staff_has_capability('marketing.content.update'));

-- Guest operations are create-only. Their line policies bind the child to a
-- request/order being created in the same invoker transaction.
create policy v1_quote_request_guest_insert on dpg_v1.quote_requests
for insert to anon with check (true);
create policy v1_quote_request_staff_select on dpg_v1.quote_requests
for select to authenticated using (dpg_v1.staff_has_capability('sales.quote_request.read'));
create policy v1_quote_request_line_guest_insert on dpg_v1.quote_request_lines
for insert to anon with check (quote_request_id is not null);
create policy v1_quote_request_line_staff_select on dpg_v1.quote_request_lines
for select to authenticated using (dpg_v1.staff_has_capability('sales.quote_request.read'));

create policy v1_quote_staff_select on dpg_v1.quotes
for select to authenticated using (dpg_v1.staff_has_capability('sales.quote.read'));
create policy v1_quote_staff_insert on dpg_v1.quotes
for insert to authenticated with check (dpg_v1.staff_has_capability('sales.quote.create'));
create policy v1_quote_staff_update on dpg_v1.quotes
for update to authenticated
using (dpg_v1.staff_has_capability('sales.quote.update')
  or dpg_v1.staff_has_capability('sales.quote.publish')
  or dpg_v1.staff_has_capability('sales.quote.archive'))
with check (dpg_v1.staff_has_capability('sales.quote.update')
  or dpg_v1.staff_has_capability('sales.quote.publish')
  or dpg_v1.staff_has_capability('sales.quote.archive'));
create policy v1_quote_line_guest_deny on dpg_v1.quote_lines
for select to anon using (false);
create policy v1_quote_line_staff_select on dpg_v1.quote_lines
for select to authenticated using (dpg_v1.staff_has_capability('sales.quote.read'));
create policy v1_quote_line_staff_insert on dpg_v1.quote_lines
for insert to authenticated with check (dpg_v1.staff_has_capability('sales.quote.create') or dpg_v1.staff_has_capability('sales.quote.update'));
create policy v1_quote_line_staff_update on dpg_v1.quote_lines
for update to authenticated
using (dpg_v1.staff_has_capability('sales.quote.update'))
with check (dpg_v1.staff_has_capability('sales.quote.update'));
create policy v1_quote_line_staff_delete on dpg_v1.quote_lines
for delete to authenticated using (dpg_v1.staff_has_capability('sales.quote.update'));

create policy v1_quote_share_guest_select on dpg_v1.quote_shares
for select to anon
using (revoked_at is null and (expires_at is null or expires_at > clock_timestamp()));
create policy v1_quote_share_staff_select on dpg_v1.quote_shares
for select to authenticated using (dpg_v1.staff_has_capability('sales.quote.read'));
create policy v1_quote_share_staff_insert on dpg_v1.quote_shares
for insert to authenticated with check (dpg_v1.staff_has_capability('sales.quote.publish'));
create policy v1_quote_share_staff_update on dpg_v1.quote_shares
for update to authenticated
using (dpg_v1.staff_has_capability('sales.quote.publish') or dpg_v1.staff_has_capability('sales.quote.archive'))
with check (dpg_v1.staff_has_capability('sales.quote.publish') or dpg_v1.staff_has_capability('sales.quote.archive'));
create policy v1_quote_guest_projection_select on dpg_v1.quotes
for select to anon using (
  status in ('ISSUED', 'CONVERTED')
  and (expires_at is null or expires_at > clock_timestamp())
  and exists (
    select 1 from dpg_v1.quote_shares qs
    where qs.quote_id = quotes.id
      and qs.revoked_at is null
      and (qs.expires_at is null or qs.expires_at > clock_timestamp())
  )
);
create policy v1_quote_guest_line_projection_select on dpg_v1.quote_lines
for select to anon using (exists (
  select 1
  from dpg_v1.quotes q
  join dpg_v1.quote_shares qs on qs.quote_id = q.id
  where q.id = quote_lines.quote_id and q.status in ('ISSUED', 'CONVERTED')
    and (q.expires_at is null or q.expires_at > clock_timestamp())
    and qs.revoked_at is null
    and (qs.expires_at is null or qs.expires_at > clock_timestamp())
));

create policy v1_orders_guest_insert on dpg_v1.orders
for insert to anon
with check (source = 'RETAIL' and source_quote_id is null and status = 'NEW' and updated_by is null);
create policy v1_orders_staff_select on dpg_v1.orders
for select to authenticated using (dpg_v1.staff_has_capability('sales.order.read'));
create policy v1_orders_staff_insert_quote on dpg_v1.orders
for insert to authenticated
with check (source = 'QUOTE' and source_quote_id is not null
  and dpg_v1.staff_has_capability('sales.quote.create'));
create policy v1_orders_staff_update on dpg_v1.orders
for update to authenticated
using (dpg_v1.staff_has_capability('sales.order.lifecycle.update')
  or dpg_v1.staff_has_capability('sales.order.payment.update')
  or dpg_v1.staff_has_capability('sales.order.archive'))
with check (dpg_v1.staff_has_capability('sales.order.lifecycle.update')
  or dpg_v1.staff_has_capability('sales.order.payment.update')
  or dpg_v1.staff_has_capability('sales.order.archive'));
create policy v1_order_lines_guest_insert on dpg_v1.order_lines
for insert to anon with check (order_id is not null);
create policy v1_order_lines_staff_select on dpg_v1.order_lines
for select to authenticated using (dpg_v1.staff_has_capability('sales.order.read'));
create policy v1_order_lines_staff_insert_quote on dpg_v1.order_lines
for insert to authenticated with check (dpg_v1.staff_has_capability('sales.quote.create'));

create policy v1_payment_staff_select on dpg_v1.payment_transactions
for select to authenticated using (dpg_v1.staff_has_capability('sales.order.read'));
create policy v1_payment_staff_insert on dpg_v1.payment_transactions
for insert to authenticated with check (dpg_v1.staff_has_capability('sales.order.payment.update'));

create policy v1_service_idempotency_guest on dpg_v1.service_idempotency_records
for all to anon using (scope_key = 'guest') with check (scope_key = 'guest');
create policy v1_service_idempotency_staff on dpg_v1.service_idempotency_records
for all to authenticated
using (scope_key = auth.uid()::text)
with check (scope_key = auth.uid()::text);
create policy v1_commerce_idempotency_staff on dpg_v1.commerce_idempotency_records
for all to authenticated
using (operation = 'quote.convert')
with check (operation = 'quote.convert');

-- The fixed role map and helper functions are never an application write
-- surface. Only authenticated sessions may call the current-context helpers.
revoke all on function dpg_v1.current_staff_context() from public, anon, service_role;
revoke all on function dpg_v1.current_staff_user_id() from public, anon, service_role;
revoke all on function dpg_v1.staff_has_capability(dpg_v1.staff_capability) from public, anon, service_role;
grant execute on function dpg_v1.current_staff_context() to authenticated;
grant execute on function dpg_v1.current_staff_user_id() to authenticated;
grant execute on function dpg_v1.staff_has_capability(dpg_v1.staff_capability) to authenticated;
revoke all on function dpg_v1.require_capability(dpg_v1.staff_capability), dpg_v1.reserve_idempotency(text, text, char(64), text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function dpg_v1.sha256_text(text), dpg_v1.sha256_json(jsonb) from public, anon, authenticated, service_role;
grant execute on function dpg_v1.sha256_text(text), dpg_v1.sha256_json(jsonb) to anon, authenticated;
grant execute on function dpg_v1.require_capability(dpg_v1.staff_capability) to authenticated;
grant execute on function dpg_v1.reserve_idempotency(text, text, char(64), text, text, uuid) to anon, authenticated;
grant execute on function dpg_v1.convert_quote_to_order(uuid, integer, text) to authenticated;
grant usage on schema dpg_v1 to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema extensions to anon, authenticated;
revoke all on function dpg_v1.product_publication_failures(uuid),
  dpg_v1.content_publication_failures(uuid),
  dpg_v1.collection_publication_failures(uuid)
from public, anon, authenticated, service_role;
grant execute on function dpg_v1.product_publication_failures(uuid),
  dpg_v1.content_publication_failures(uuid),
  dpg_v1.collection_publication_failures(uuid) to authenticated;
grant execute on function dpg_v1.product_publication_failures(uuid) to anon;

-- The API schema contains only reviewed projections and RPCs. Every view is
-- security-invoker so its underlying dpg_v1 policies remain authoritative.
create view dpg_v1_api.public_products
with (security_invoker = true)
as
select p.id,
       p.sku,
       p.model,
       p.name,
       p.slug,
       b.name as brand_name,
       c.name as category_name,
       p.retail_price,
       p.list_price,
       p.currency,
       p.availability,
       p.description,
       p.seo_title,
       p.seo_description,
       primary_media.delivery_object_key as primary_image_key
from dpg_v1.products p
join dpg_v1.brands b on b.id = p.brand_id and b.is_active
join dpg_v1.categories c on c.id = p.primary_category_id and c.is_active and c.is_leaf
left join lateral (
  select ma.delivery_object_key
  from dpg_v1.product_media pm
  join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
  where pm.product_id = p.id
    and pm.role = 'PRIMARY'
    and ma.kind = 'IMAGE'
    and ma.state = 'READY'
  limit 1
) primary_media on true
where p.status = 'PUBLISHED';

create view dpg_v1_api.public_content
with (security_invoker = true)
as
select ce.id,
       ce.type,
       ce.title,
       ce.slug,
       ce.excerpt,
       ce.hero_media_id,
       ce.seo_title,
       ce.seo_description,
       ce.route_path,
       ce.published_at
from dpg_v1.content_entries ce
where ce.status = 'PUBLISHED';

create view dpg_v1_api.public_collections
with (security_invoker = true)
as
select c.id,
       c.title,
       c.slug,
       c.summary,
       c.hero_media_id,
       c.published_at
from dpg_v1.collections c
where c.status = 'PUBLISHED';

create view dpg_v1_api.staff_products
with (security_invoker = true)
as
select p.id,
       p.sku,
       p.model,
       p.name,
       p.slug,
       p.brand_id,
       p.primary_category_id,
       p.retail_price,
       p.list_price,
       p.currency,
       p.availability,
       p.status,
       p.unresolved_critical_conflict,
       p.version,
       p.published_at,
       p.created_at,
       p.updated_at,
       dpg_v1.product_publication_failures(p.id) as publication_failures
from dpg_v1.products p;

create function dpg_v1_api.staff_context()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'auth_user_id', c.auth_user_id,
        'email', c.email,
        'display_name', c.display_name,
        'status', c.status,
        'roles', to_jsonb(c.roles),
        'capabilities', to_jsonb(c.capabilities)
      )
      from dpg_v1.current_staff_context() c
      limit 1
    ),
    '{}'::jsonb
  )
$$;

create function dpg_v1_api.staff_can(p_capability text)
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  requested dpg_v1.staff_capability;
begin
  if p_capability is null then
    return false;
  end if;

  begin
    requested := p_capability::dpg_v1.staff_capability;
  exception
    when invalid_text_representation then
      return false;
  end;

  return dpg_v1.staff_has_capability(requested);
end
$$;

create function dpg_v1_api.public_product_list(p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.name), '[]'::jsonb)
  from (
    select *
    from dpg_v1_api.public_products
    order by name, id
    limit least(greatest(coalesce(p_limit, 24), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ) row_data
$$;

create function dpg_v1_api.public_product_get(p_product_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select to_jsonb(row_data) || jsonb_build_object(
    'media', coalesce((
      select jsonb_agg(to_jsonb(media_row) order by media_row.sort_order, media_row.id)
      from (
        select pm.id, pm.role, pm.sort_order, pm.alt_text, ma.delivery_object_key
        from dpg_v1.product_media pm
        join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
        where pm.product_id = row_data.id and ma.state = 'READY'
      ) media_row
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(document_row) order by document_row.sort_order, document_row.id)
      from (
        select pd.id, pd.document_type, pd.title, pd.sort_order, ma.delivery_object_key
        from dpg_v1.product_documents pd
        join dpg_v1.media_assets ma on ma.id = pd.media_asset_id
        where pd.product_id = row_data.id and pd.is_public and ma.state = 'READY'
      ) document_row
    ), '[]'::jsonb)
  )
  from dpg_v1_api.public_products row_data
  where row_data.id = p_product_id
$$;

create function dpg_v1_api.public_content_list(p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.published_at desc, row_data.id), '[]'::jsonb)
  from (
    select *
    from dpg_v1_api.public_content
    order by published_at desc, id
    limit least(greatest(coalesce(p_limit, 24), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ) row_data
$$;

create function dpg_v1_api.public_content_get(p_content_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select to_jsonb(row_data) || jsonb_build_object(
    'blocks', coalesce((
      select jsonb_agg(to_jsonb(block_row) order by block_row.sort_order, block_row.id)
      from (
        select cb.id, cb.block_type, cb.media_asset_id, cb.payload, cb.sort_order
        from dpg_v1.content_blocks cb
        where cb.content_entry_id = row_data.id
      ) block_row
    ), '[]'::jsonb)
  )
  from dpg_v1_api.public_content row_data
  where row_data.id = p_content_id
$$;

create function dpg_v1_api.public_collection_list(p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.title, row_data.id), '[]'::jsonb)
  from (
    select c.*, coalesce((
      select jsonb_agg(cp.product_id order by cp.sort_order, cp.product_id)
      from dpg_v1.collection_products cp
      where cp.collection_id = c.id
    ), '[]'::jsonb) as product_ids
    from dpg_v1_api.public_collections c
    order by c.title, c.id
    limit least(greatest(coalesce(p_limit, 24), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ) row_data
$$;

grant select on dpg_v1_api.public_products, dpg_v1_api.public_content,
  dpg_v1_api.public_collections to anon, authenticated;
grant select on dpg_v1_api.staff_products to authenticated;

-- Guest retail intake is intentionally a narrow create-only operation. The
-- client supplies identifiers and quantities; every commercial fact is read
-- from the current published V1 Product and copied into an immutable snapshot.
create function dpg_v1_api.order_intake_create(p_input jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  idem record;
  item jsonb;
  product_row record;
  order_id uuid;
  order_number text;
  customer_name text;
  customer_phone text;
  customer_email text;
  shipping_address text;
  public_note text;
  payment_method dpg_v1.payment_method;
  product_id uuid;
  quantity integer;
  line_index integer;
  item_count integer := 0;
  v_subtotal numeric(15,2) := 0;
  seen_product_ids uuid[] := '{}'::uuid[];
  snapshot_product_ids uuid[] := '{}'::uuid[];
  snapshot_skus text[] := '{}'::text[];
  snapshot_models text[] := '{}'::text[];
  snapshot_names text[] := '{}'::text[];
  snapshot_brands text[] := '{}'::text[];
  snapshot_categories text[] := '{}'::text[];
  snapshot_availabilities dpg_v1.availability_status[] := '{}'::dpg_v1.availability_status[];
  snapshot_prices numeric[] := '{}'::numeric[];
  snapshot_quantities integer[] := '{}'::integer[];
  snapshot_notes text[] := '{}'::text[];
  request_hash char(64);
  v_key_hash char(64);
  response jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or jsonb_typeof(p_input->'items') <> 'array'
     or jsonb_array_length(p_input->'items') not between 1 and 50 then
    raise exception 'INVALID_ORDER_INPUT';
  end if;

  customer_name := nullif(btrim(coalesce(p_input #>> '{customer,name}', p_input->>'customer_name')), '');
  customer_phone := nullif(btrim(coalesce(p_input #>> '{customer,phone}', p_input->>'customer_phone')), '');
  customer_email := nullif(btrim(coalesce(p_input #>> '{customer,email}', p_input->>'customer_email')), '');
  shipping_address := nullif(btrim(coalesce(p_input->>'shipping_address', p_input #>> '{shipping,address}')), '');
  public_note := nullif(btrim(p_input->>'public_note'), '');
  if customer_name is null or customer_phone is null or shipping_address is null then
    raise exception 'INVALID_ORDER_CUSTOMER';
  end if;
  begin
    payment_method := coalesce(nullif(upper(btrim(p_input->>'payment_method')), ''), 'COD')::dpg_v1.payment_method;
  exception when invalid_text_representation then
    raise exception 'INVALID_PAYMENT_METHOD';
  end;

  request_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    'guest', 'order_intake.create', request_hash, p_idempotency_key, 'order', null
  );
  if idem.replay then
    return idem.safe_response;
  end if;
  v_key_hash := idem.key_hash;

  order_id := gen_random_uuid();
  order_number := 'O-' || upper(replace(order_id::text, '-', ''));
  for item in select value from jsonb_array_elements(p_input->'items') loop
    begin
      product_id := (item->>'product_id')::uuid;
      quantity := (item->>'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_ORDER_LINE';
    end;
    if quantity is null or quantity not between 1 and 1000 or product_id is null then
      raise exception 'INVALID_ORDER_LINE';
    end if;
    if product_id = any(seen_product_ids) then
      raise exception 'DUPLICATE_ORDER_PRODUCT';
    end if;
    seen_product_ids := array_append(seen_product_ids, product_id);

    select p.sku, p.model, p.name, b.name as brand_name, c.name as category_name,
           p.retail_price, p.availability
      into product_row
    from dpg_v1.products p
    join dpg_v1.brands b on b.id = p.brand_id and b.is_active
    join dpg_v1.categories c on c.id = p.primary_category_id and c.is_active and c.is_leaf
    where p.id = product_id and p.status = 'PUBLISHED';
    if not found or product_row.retail_price is null
       or coalesce(cardinality(dpg_v1.product_publication_failures(product_id)), 1) <> 0 then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;

    snapshot_product_ids := array_append(snapshot_product_ids, product_id);
    snapshot_skus := array_append(snapshot_skus, product_row.sku);
    snapshot_models := array_append(snapshot_models, product_row.model);
    snapshot_names := array_append(snapshot_names, product_row.name);
    snapshot_brands := array_append(snapshot_brands, product_row.brand_name);
    snapshot_categories := array_append(snapshot_categories, product_row.category_name);
    snapshot_availabilities := array_append(snapshot_availabilities, product_row.availability);
    snapshot_prices := array_append(snapshot_prices, product_row.retail_price);
    snapshot_quantities := array_append(snapshot_quantities, quantity);
    snapshot_notes := array_append(snapshot_notes, nullif(btrim(item->>'customer_note'), ''));
    v_subtotal := v_subtotal + (product_row.retail_price * quantity);
    item_count := item_count + 1;
  end loop;

  insert into dpg_v1.orders (
    id, order_number, source, status, payment_method, payment_status,
    customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot,
    shipping_address_snapshot, public_note, subtotal, shipping_fee,
    discount_total, total
  ) values (
    order_id, order_number, 'RETAIL', 'NEW', payment_method, 'UNPAID',
    customer_name, customer_phone, customer_email, shipping_address, public_note,
    v_subtotal, 0, 0, v_subtotal
  );

  for line_index in 1..item_count loop
    insert into dpg_v1.order_lines (
      order_id, product_id, sort_order, product_sku_snapshot,
      product_model_snapshot, product_name_snapshot, brand_name_snapshot,
      primary_category_name_snapshot, availability_snapshot, quantity,
      unit_price, line_discount, public_note, snapshot_at
    ) values (
      order_id, snapshot_product_ids[line_index], line_index - 1,
      snapshot_skus[line_index], snapshot_models[line_index], snapshot_names[line_index],
      snapshot_brands[line_index], snapshot_categories[line_index],
      snapshot_availabilities[line_index], snapshot_quantities[line_index],
      snapshot_prices[line_index], 0, snapshot_notes[line_index], clock_timestamp()
    );
  end loop;

  response := jsonb_build_object(
    'order_id', order_id,
    'order_number', order_number,
    'status', 'NEW',
    'total', v_subtotal,
    'item_count', item_count
  );
  update dpg_v1.service_idempotency_records
  set resource_id = order_id, safe_response = response
  where scope_key = 'guest' and operation = 'order_intake.create' and key_hash = v_key_hash;
  return response;
end
$$;

create function dpg_v1_api.quote_request_intake_create(p_input jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  idem record;
  item jsonb;
  product_row record;
  request_id uuid;
  request_number text;
  customer_name text;
  customer_phone text;
  customer_email text;
  project_context text;
  customer_note text;
  product_id uuid;
  quantity integer;
  item_count integer := 0;
  seen_product_ids uuid[] := '{}'::uuid[];
  request_hash char(64);
  v_key_hash char(64);
  response jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or jsonb_typeof(p_input->'items') <> 'array'
     or jsonb_array_length(p_input->'items') not between 1 and 50 then
    raise exception 'INVALID_QUOTE_REQUEST_INPUT';
  end if;
  customer_name := nullif(btrim(coalesce(p_input #>> '{customer,name}', p_input->>'customer_name')), '');
  customer_phone := nullif(btrim(coalesce(p_input #>> '{customer,phone}', p_input->>'customer_phone')), '');
  customer_email := nullif(btrim(coalesce(p_input #>> '{customer,email}', p_input->>'customer_email')), '');
  project_context := nullif(btrim(p_input->>'project_context'), '');
  customer_note := nullif(btrim(coalesce(p_input->>'customer_note', p_input->>'public_note')), '');
  if customer_name is null or customer_phone is null then
    raise exception 'INVALID_QUOTE_REQUEST_CUSTOMER';
  end if;

  request_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    'guest', 'quote_request_intake.create', request_hash,
    p_idempotency_key, 'quote_request', null
  );
  if idem.replay then
    return idem.safe_response;
  end if;
  v_key_hash := idem.key_hash;

  request_id := gen_random_uuid();
  request_number := 'QR-' || upper(replace(request_id::text, '-', ''));
  insert into dpg_v1.quote_requests (
    id, request_number, customer_name, customer_phone, customer_email,
    project_context, customer_note
  ) values (
    request_id, request_number, customer_name, customer_phone, customer_email,
    project_context, customer_note
  );

  for item in select value from jsonb_array_elements(p_input->'items') loop
    begin
      product_id := (item->>'product_id')::uuid;
      quantity := (item->>'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_QUOTE_REQUEST_LINE';
    end;
    if quantity is null or quantity not between 1 and 1000 or product_id is null then
      raise exception 'INVALID_QUOTE_REQUEST_LINE';
    end if;
    if product_id = any(seen_product_ids) then
      raise exception 'DUPLICATE_QUOTE_REQUEST_PRODUCT';
    end if;
    seen_product_ids := array_append(seen_product_ids, product_id);
    select p.sku, p.model, p.name, b.name as brand_name, c.name as category_name,
           p.retail_price, p.availability
      into product_row
    from dpg_v1.products p
    join dpg_v1.brands b on b.id = p.brand_id and b.is_active
    join dpg_v1.categories c on c.id = p.primary_category_id and c.is_active and c.is_leaf
    where p.id = product_id and p.status = 'PUBLISHED';
    if not found or product_row.retail_price is null
       or coalesce(cardinality(dpg_v1.product_publication_failures(product_id)), 1) <> 0 then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;
    insert into dpg_v1.quote_request_lines (
      quote_request_id, product_id, sort_order, product_sku_snapshot,
      product_model_snapshot, product_name_snapshot, brand_name_snapshot,
      primary_category_name_snapshot, retail_price_snapshot,
      availability_snapshot, requested_quantity, customer_note, snapshot_at
    ) values (
      request_id, product_id, item_count, product_row.sku, product_row.model,
      product_row.name, product_row.brand_name, product_row.category_name,
      product_row.retail_price, product_row.availability, quantity,
      nullif(btrim(item->>'customer_note'), ''), clock_timestamp()
    );
    item_count := item_count + 1;
  end loop;

  response := jsonb_build_object(
    'quote_request_id', request_id,
    'request_number', request_number,
    'status', 'SUBMITTED',
    'item_count', item_count
  );
  update dpg_v1.service_idempotency_records
  set resource_id = request_id, safe_response = response
  where scope_key = 'guest' and operation = 'quote_request_intake.create' and key_hash = v_key_hash;
  return response;
end
$$;

-- The only public quote lookup accepts a high-entropy bearer token and emits
-- a deliberate projection. It never returns token hashes, private notes, or
-- internal foreign keys.
create function dpg_v1_api.shareable_quote_read(p_share_token text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  response jsonb;
begin
  if p_share_token is null or length(p_share_token) < 32
     or p_share_token !~ '^[0-9a-fA-F]+$' then
    raise exception 'QUOTE_SHARE_NOT_FOUND';
  end if;
  select jsonb_build_object(
    'quote_number', q.quote_number,
    'status', q.status,
    'currency', q.currency,
    'customer_name', q.customer_name_snapshot,
    'project_context', q.project_context_snapshot,
    'public_note', q.public_note,
    'subtotal', q.subtotal,
    'shipping_fee', q.shipping_fee,
    'discount_total', q.discount_total,
    'total', q.total,
    'issued_at', q.issued_at,
    'expires_at', q.expires_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sku', ql.product_sku_snapshot,
        'model', ql.product_model_snapshot,
        'name', ql.product_name_snapshot,
        'brand_name', ql.brand_name_snapshot,
        'category_name', ql.primary_category_name_snapshot,
        'availability', ql.availability_snapshot,
        'quantity', ql.quantity,
        'unit_price', ql.unit_price,
        'line_discount', ql.line_discount,
        'line_total', ql.line_total,
        'public_note', ql.public_note
      ) order by ql.sort_order)
      from dpg_v1.quote_lines ql
      where ql.quote_id = q.id
    ), '[]'::jsonb)
  ) into response
  from dpg_v1.quote_shares qs
  join dpg_v1.quotes q on q.id = qs.quote_id
  where qs.token_hash = dpg_v1.sha256_text(lower(btrim(p_share_token)))
    and qs.revoked_at is null
    and (qs.expires_at is null or qs.expires_at > clock_timestamp())
    and q.status in ('ISSUED', 'CONVERTED')
    and (q.expires_at is null or q.expires_at > clock_timestamp());
  if response is null then
    raise exception 'QUOTE_SHARE_NOT_FOUND';
  end if;
  return response;
end
$$;

create function dpg_v1_api.catalogue_product_create(p_input jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.create');
  idem record;
  input_key text;
  product_id uuid;
  response jsonb;
  product_row dpg_v1.products%rowtype;
  product_hash char(64);
  v_key_hash char(64);
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_PRODUCT_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in (
      'sku', 'model', 'name', 'slug', 'brand_id', 'primary_category_id',
      'retail_price', 'list_price', 'availability', 'description',
      'seo_title', 'seo_description', 'unresolved_critical_conflict'
    ) then
      raise exception 'UNKNOWN_PRODUCT_FIELD';
    end if;
  end loop;
  if nullif(btrim(p_input->>'sku'), '') is null
     or nullif(btrim(p_input->>'model'), '') is null
     or nullif(btrim(p_input->>'name'), '') is null
     or nullif(btrim(p_input->>'slug'), '') is null
     or p_input->>'brand_id' is null
     or p_input->>'primary_category_id' is null then
    raise exception 'INVALID_PRODUCT_INPUT';
  end if;

  product_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.product.create', product_hash,
    p_idempotency_key, 'product', null
  );
  if idem.replay then
    return idem.safe_response;
  end if;
  v_key_hash := idem.key_hash;

  product_id := gen_random_uuid();
  insert into dpg_v1.products (
    id, sku, model, name, slug, brand_id, primary_category_id,
    retail_price, list_price, availability, description, seo_title,
    seo_description, unresolved_critical_conflict, status
  ) values (
    product_id,
    btrim(p_input->>'sku'),
    btrim(p_input->>'model'),
    btrim(p_input->>'name'),
    btrim(p_input->>'slug'),
    (p_input->>'brand_id')::uuid,
    (p_input->>'primary_category_id')::uuid,
    nullif(p_input->>'retail_price', '')::numeric,
    nullif(p_input->>'list_price', '')::numeric,
    coalesce(nullif(upper(btrim(p_input->>'availability')), ''), 'CONTACT')::dpg_v1.availability_status,
    nullif(btrim(p_input->>'description'), ''),
    nullif(btrim(p_input->>'seo_title'), ''),
    nullif(btrim(p_input->>'seo_description'), ''),
    coalesce((p_input->>'unresolved_critical_conflict')::boolean, false),
    'DRAFT'
  ) returning * into product_row;

  response := jsonb_build_object(
    'product_id', product_row.id,
    'status', product_row.status,
    'version', product_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = product_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.product.create'
    and key_hash = v_key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_product_update(
  p_product_id uuid,
  p_expected_version integer,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.update');
  idem record;
  product_row dpg_v1.products%rowtype;
  input_key text;
  request_hash char(64);
  response jsonb;
begin
  if p_product_id is null or p_expected_version is null or p_input is null
     or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_PRODUCT_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in (
      'sku', 'model', 'name', 'slug', 'brand_id', 'primary_category_id',
      'retail_price', 'list_price', 'availability', 'description',
      'seo_title', 'seo_description', 'unresolved_critical_conflict'
    ) then
      raise exception 'UNKNOWN_PRODUCT_FIELD';
    end if;
  end loop;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'product_id', p_product_id, 'expected_version', p_expected_version, 'input', p_input
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.product.update', request_hash,
    p_idempotency_key, 'product', p_product_id
  );
  if idem.replay then
    return idem.safe_response;
  end if;

  select * into product_row from dpg_v1.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if product_row.version <> p_expected_version then raise exception 'STALE_PRODUCT_VERSION'; end if;
  update dpg_v1.products
  set sku = case when p_input ? 'sku' then p_input->>'sku' else product_row.sku end,
      model = case when p_input ? 'model' then p_input->>'model' else product_row.model end,
      name = case when p_input ? 'name' then p_input->>'name' else product_row.name end,
      slug = case when p_input ? 'slug' then p_input->>'slug' else product_row.slug end,
      brand_id = case when p_input ? 'brand_id' then (p_input->>'brand_id')::uuid else product_row.brand_id end,
      primary_category_id = case when p_input ? 'primary_category_id'
        then (p_input->>'primary_category_id')::uuid else product_row.primary_category_id end,
      retail_price = case when p_input ? 'retail_price' then nullif(p_input->>'retail_price', '')::numeric
        else product_row.retail_price end,
      list_price = case when p_input ? 'list_price' then nullif(p_input->>'list_price', '')::numeric
        else product_row.list_price end,
      availability = case when p_input ? 'availability'
        then (p_input->>'availability')::dpg_v1.availability_status else product_row.availability end,
      description = case when p_input ? 'description' then nullif(p_input->>'description', '') else product_row.description end,
      seo_title = case when p_input ? 'seo_title' then nullif(p_input->>'seo_title', '') else product_row.seo_title end,
      seo_description = case when p_input ? 'seo_description' then nullif(p_input->>'seo_description', '') else product_row.seo_description end,
      unresolved_critical_conflict = case when p_input ? 'unresolved_critical_conflict'
        then (p_input->>'unresolved_critical_conflict')::boolean else product_row.unresolved_critical_conflict end,
      version = product_row.version + 1
  where id = p_product_id
  returning * into product_row;
  if product_row.status = 'PUBLISHED'
     and coalesce(cardinality(dpg_v1.product_publication_failures(product_row.id)), 1) <> 0 then
    raise exception 'PRODUCT_NOT_PUBLISHABLE';
  end if;
  response := jsonb_build_object(
    'product_id', product_row.id, 'status', product_row.status, 'version', product_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = product_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.product.update'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_product_publish(
  p_product_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.publish');
  idem record;
  product_row dpg_v1.products%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'product_id', p_product_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.product.publish', request_hash,
    p_idempotency_key, 'product', p_product_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into product_row from dpg_v1.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if product_row.version <> p_expected_version then raise exception 'STALE_PRODUCT_VERSION'; end if;
  if product_row.status <> 'DRAFT' then raise exception 'PRODUCT_NOT_DRAFT'; end if;
  if coalesce(cardinality(dpg_v1.product_publication_failures(p_product_id)), 1) <> 0 then
    raise exception 'PRODUCT_NOT_PUBLISHABLE';
  end if;
  update dpg_v1.products
  set status = 'PUBLISHED', published_at = clock_timestamp(), version = version + 1
  where id = p_product_id
  returning * into product_row;
  response := jsonb_build_object(
    'product_id', product_row.id, 'status', product_row.status, 'version', product_row.version,
    'published_at', product_row.published_at
  );
  update dpg_v1.service_idempotency_records
  set resource_id = product_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.product.publish'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_product_archive(
  p_product_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.archive');
  idem record;
  product_row dpg_v1.products%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'product_id', p_product_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.product.archive', request_hash,
    p_idempotency_key, 'product', p_product_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into product_row from dpg_v1.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if product_row.version <> p_expected_version then raise exception 'STALE_PRODUCT_VERSION'; end if;
  if product_row.status = 'ARCHIVED' then raise exception 'PRODUCT_ALREADY_ARCHIVED'; end if;
  update dpg_v1.products
  set status = 'ARCHIVED', published_at = null, version = version + 1
  where id = p_product_id
  returning * into product_row;
  response := jsonb_build_object(
    'product_id', product_row.id, 'status', product_row.status, 'version', product_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = product_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.product.archive'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_content_create(p_input jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.content.create');
  idem record;
  content_row dpg_v1.content_entries%rowtype;
  item jsonb;
  block_type dpg_v1.content_block_type;
  block_media_id uuid;
  block_payload jsonb;
  block_order integer;
  block_index integer := 0;
  input_key text;
  content_id uuid;
  request_hash char(64);
  response jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_CONTENT_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in (
      'type', 'title', 'slug', 'excerpt', 'hero_media_id', 'seo_title',
      'seo_description', 'route_path', 'blocks'
    ) then
      raise exception 'UNKNOWN_CONTENT_FIELD';
    end if;
  end loop;
  if nullif(btrim(p_input->>'title'), '') is null
     or nullif(btrim(p_input->>'slug'), '') is null
     or p_input->>'type' is null then
    raise exception 'INVALID_CONTENT_INPUT';
  end if;
  if p_input ? 'blocks' and (jsonb_typeof(p_input->'blocks') <> 'array'
     or jsonb_array_length(p_input->'blocks') > 100) then
    raise exception 'INVALID_CONTENT_BLOCKS';
  end if;
  request_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.content.create', request_hash,
    p_idempotency_key, 'content_entry', null
  );
  if idem.replay then return idem.safe_response; end if;

  content_id := gen_random_uuid();
  insert into dpg_v1.content_entries (
    id, type, title, slug, excerpt, hero_media_id, seo_title,
    seo_description, route_path, author_id, editor_id, status
  ) values (
    content_id,
    (p_input->>'type')::dpg_v1.content_type,
    btrim(p_input->>'title'),
    btrim(p_input->>'slug'),
    nullif(btrim(p_input->>'excerpt'), ''),
    nullif(p_input->>'hero_media_id', '')::uuid,
    nullif(btrim(p_input->>'seo_title'), ''),
    nullif(btrim(p_input->>'seo_description'), ''),
    nullif(btrim(p_input->>'route_path'), ''),
    actor_id, actor_id, 'DRAFT'
  ) returning * into content_row;

  if p_input ? 'blocks' then
    for item in select value from jsonb_array_elements(p_input->'blocks') loop
      if jsonb_typeof(item) <> 'object' or item->>'block_type' is null
         or jsonb_typeof(coalesce(item->'payload', '{}'::jsonb)) <> 'object' then
        raise exception 'INVALID_CONTENT_BLOCK';
      end if;
      begin
        block_type := (item->>'block_type')::dpg_v1.content_block_type;
        block_media_id := nullif(item->>'media_asset_id', '')::uuid;
        block_order := coalesce((item->>'sort_order')::integer, block_index);
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'INVALID_CONTENT_BLOCK';
      end;
      block_payload := coalesce(item->'payload', '{}'::jsonb);
      insert into dpg_v1.content_blocks (
        content_entry_id, block_type, media_asset_id, payload, sort_order
      ) values (content_id, block_type, block_media_id, block_payload, block_order);
      block_index := block_index + 1;
    end loop;
  end if;

  response := jsonb_build_object(
    'content_entry_id', content_row.id, 'status', content_row.status, 'version', content_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = content_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.content.create'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_content_update(
  p_content_id uuid,
  p_expected_version integer,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.content.update');
  idem record;
  content_row dpg_v1.content_entries%rowtype;
  item jsonb;
  block_type dpg_v1.content_block_type;
  block_media_id uuid;
  block_payload jsonb;
  block_order integer;
  block_index integer := 0;
  input_key text;
  request_hash char(64);
  response jsonb;
begin
  if p_content_id is null or p_expected_version is null or p_input is null
     or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_CONTENT_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in (
      'title', 'slug', 'excerpt', 'hero_media_id', 'seo_title',
      'seo_description', 'route_path', 'blocks'
    ) then
      raise exception 'UNKNOWN_CONTENT_FIELD';
    end if;
  end loop;
  if p_input ? 'blocks' and (jsonb_typeof(p_input->'blocks') <> 'array'
     or jsonb_array_length(p_input->'blocks') > 100) then
    raise exception 'INVALID_CONTENT_BLOCKS';
  end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'content_entry_id', p_content_id, 'expected_version', p_expected_version, 'input', p_input
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.content.update', request_hash,
    p_idempotency_key, 'content_entry', p_content_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into content_row from dpg_v1.content_entries where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND'; end if;
  if content_row.version <> p_expected_version then raise exception 'STALE_CONTENT_VERSION'; end if;

  if p_input ? 'blocks' then
    delete from dpg_v1.content_blocks where content_entry_id = p_content_id;
    for item in select value from jsonb_array_elements(p_input->'blocks') loop
      if jsonb_typeof(item) <> 'object' or item->>'block_type' is null
         or jsonb_typeof(coalesce(item->'payload', '{}'::jsonb)) <> 'object' then
        raise exception 'INVALID_CONTENT_BLOCK';
      end if;
      begin
        block_type := (item->>'block_type')::dpg_v1.content_block_type;
        block_media_id := nullif(item->>'media_asset_id', '')::uuid;
        block_order := coalesce((item->>'sort_order')::integer, block_index);
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'INVALID_CONTENT_BLOCK';
      end;
      block_payload := coalesce(item->'payload', '{}'::jsonb);
      insert into dpg_v1.content_blocks (
        content_entry_id, block_type, media_asset_id, payload, sort_order
      ) values (p_content_id, block_type, block_media_id, block_payload, block_order);
      block_index := block_index + 1;
    end loop;
  end if;

  update dpg_v1.content_entries
  set title = case when p_input ? 'title' then p_input->>'title' else content_row.title end,
      slug = case when p_input ? 'slug' then p_input->>'slug' else content_row.slug end,
      excerpt = case when p_input ? 'excerpt' then nullif(p_input->>'excerpt', '') else content_row.excerpt end,
      hero_media_id = case when p_input ? 'hero_media_id' then nullif(p_input->>'hero_media_id', '')::uuid else content_row.hero_media_id end,
      seo_title = case when p_input ? 'seo_title' then nullif(p_input->>'seo_title', '') else content_row.seo_title end,
      seo_description = case when p_input ? 'seo_description' then nullif(p_input->>'seo_description', '') else content_row.seo_description end,
      route_path = case when p_input ? 'route_path' then nullif(p_input->>'route_path', '') else content_row.route_path end,
      editor_id = actor_id,
      version = content_row.version + 1
  where id = p_content_id
  returning * into content_row;
  if content_row.status = 'PUBLISHED'
     and coalesce(cardinality(dpg_v1.content_publication_failures(content_row.id)), 1) <> 0 then
    raise exception 'CONTENT_NOT_PUBLISHABLE';
  end if;
  response := jsonb_build_object(
    'content_entry_id', content_row.id, 'status', content_row.status, 'version', content_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = content_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.content.update'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_content_publish(
  p_content_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.content.publish');
  idem record;
  content_row dpg_v1.content_entries%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'content_entry_id', p_content_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.content.publish', request_hash,
    p_idempotency_key, 'content_entry', p_content_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into content_row from dpg_v1.content_entries where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND'; end if;
  if content_row.version <> p_expected_version then raise exception 'STALE_CONTENT_VERSION'; end if;
  if content_row.status <> 'DRAFT' then raise exception 'CONTENT_NOT_DRAFT'; end if;
  if coalesce(cardinality(dpg_v1.content_publication_failures(p_content_id)), 1) <> 0 then
    raise exception 'CONTENT_NOT_PUBLISHABLE';
  end if;
  update dpg_v1.content_entries
  set status = 'PUBLISHED', published_at = clock_timestamp(), version = version + 1, editor_id = actor_id
  where id = p_content_id
  returning * into content_row;
  response := jsonb_build_object(
    'content_entry_id', content_row.id, 'status', content_row.status, 'version', content_row.version,
    'published_at', content_row.published_at
  );
  update dpg_v1.service_idempotency_records
  set resource_id = content_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.content.publish'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_content_archive(
  p_content_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.content.archive');
  idem record;
  content_row dpg_v1.content_entries%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'content_entry_id', p_content_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.content.archive', request_hash,
    p_idempotency_key, 'content_entry', p_content_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into content_row from dpg_v1.content_entries where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND'; end if;
  if content_row.version <> p_expected_version then raise exception 'STALE_CONTENT_VERSION'; end if;
  if content_row.status = 'ARCHIVED' then raise exception 'CONTENT_ALREADY_ARCHIVED'; end if;
  update dpg_v1.content_entries
  set status = 'ARCHIVED', published_at = null, version = version + 1, editor_id = actor_id
  where id = p_content_id
  returning * into content_row;
  response := jsonb_build_object(
    'content_entry_id', content_row.id, 'status', content_row.status, 'version', content_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = content_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.content.archive'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_collection_create(p_input jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.collection.create');
  idem record;
  collection_row dpg_v1.collections%rowtype;
  product_value text;
  product_id uuid;
  collection_id uuid;
  sort_order integer := 0;
  seen_product_ids uuid[] := '{}'::uuid[];
  input_key text;
  request_hash char(64);
  response jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or nullif(btrim(p_input->>'title'), '') is null
     or nullif(btrim(p_input->>'slug'), '') is null then
    raise exception 'INVALID_COLLECTION_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in ('title', 'slug', 'summary', 'hero_media_id', 'product_ids') then
      raise exception 'UNKNOWN_COLLECTION_FIELD';
    end if;
  end loop;
  if p_input ? 'product_ids' and (jsonb_typeof(p_input->'product_ids') <> 'array'
     or jsonb_array_length(p_input->'product_ids') > 100) then
    raise exception 'INVALID_COLLECTION_PRODUCTS';
  end if;
  request_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.collection.create', request_hash,
    p_idempotency_key, 'collection', null
  );
  if idem.replay then return idem.safe_response; end if;

  collection_id := gen_random_uuid();
  insert into dpg_v1.collections (
    id, title, slug, summary, hero_media_id, status
  ) values (
    collection_id, btrim(p_input->>'title'), btrim(p_input->>'slug'),
    nullif(btrim(p_input->>'summary'), ''), nullif(p_input->>'hero_media_id', '')::uuid, 'DRAFT'
  ) returning * into collection_row;

  if p_input ? 'product_ids' then
    for product_value in select value from jsonb_array_elements_text(p_input->'product_ids') loop
      begin
        product_id := product_value::uuid;
      exception when invalid_text_representation then
        raise exception 'INVALID_COLLECTION_PRODUCT';
      end;
      if product_id = any(seen_product_ids) then raise exception 'DUPLICATE_COLLECTION_PRODUCT'; end if;
      seen_product_ids := array_append(seen_product_ids, product_id);
      insert into dpg_v1.collection_products (collection_id, product_id, sort_order)
      values (collection_id, product_id, sort_order);
      sort_order := sort_order + 1;
    end loop;
  end if;
  response := jsonb_build_object(
    'collection_id', collection_row.id, 'status', collection_row.status, 'version', collection_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = collection_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.collection.create'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_collection_update(
  p_collection_id uuid,
  p_expected_version integer,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.collection.update');
  idem record;
  collection_row dpg_v1.collections%rowtype;
  product_value text;
  product_id uuid;
  sort_order integer := 0;
  seen_product_ids uuid[] := '{}'::uuid[];
  input_key text;
  request_hash char(64);
  response jsonb;
begin
  if p_collection_id is null or p_expected_version is null or p_input is null
     or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_COLLECTION_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in ('title', 'slug', 'summary', 'hero_media_id', 'product_ids') then
      raise exception 'UNKNOWN_COLLECTION_FIELD';
    end if;
  end loop;
  if p_input ? 'product_ids' and (jsonb_typeof(p_input->'product_ids') <> 'array'
     or jsonb_array_length(p_input->'product_ids') > 100) then
    raise exception 'INVALID_COLLECTION_PRODUCTS';
  end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'collection_id', p_collection_id, 'expected_version', p_expected_version, 'input', p_input
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.collection.update', request_hash,
    p_idempotency_key, 'collection', p_collection_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into collection_row from dpg_v1.collections where id = p_collection_id for update;
  if not found then raise exception 'COLLECTION_NOT_FOUND'; end if;
  if collection_row.version <> p_expected_version then raise exception 'STALE_COLLECTION_VERSION'; end if;

  if p_input ? 'product_ids' then
    delete from dpg_v1.collection_products where collection_id = p_collection_id;
    for product_value in select value from jsonb_array_elements_text(p_input->'product_ids') loop
      begin
        product_id := product_value::uuid;
      exception when invalid_text_representation then
        raise exception 'INVALID_COLLECTION_PRODUCT';
      end;
      if product_id = any(seen_product_ids) then raise exception 'DUPLICATE_COLLECTION_PRODUCT'; end if;
      seen_product_ids := array_append(seen_product_ids, product_id);
      insert into dpg_v1.collection_products (collection_id, product_id, sort_order)
      values (p_collection_id, product_id, sort_order);
      sort_order := sort_order + 1;
    end loop;
  end if;
  update dpg_v1.collections
  set title = case when p_input ? 'title' then p_input->>'title' else collection_row.title end,
      slug = case when p_input ? 'slug' then p_input->>'slug' else collection_row.slug end,
      summary = case when p_input ? 'summary' then nullif(p_input->>'summary', '') else collection_row.summary end,
      hero_media_id = case when p_input ? 'hero_media_id' then nullif(p_input->>'hero_media_id', '')::uuid else collection_row.hero_media_id end,
      version = collection_row.version + 1
  where id = p_collection_id
  returning * into collection_row;
  if collection_row.status = 'PUBLISHED'
     and coalesce(cardinality(dpg_v1.collection_publication_failures(collection_row.id)), 1) <> 0 then
    raise exception 'COLLECTION_NOT_PUBLISHABLE';
  end if;
  response := jsonb_build_object(
    'collection_id', collection_row.id, 'status', collection_row.status, 'version', collection_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = collection_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.collection.update'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_collection_publish(
  p_collection_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.collection.publish');
  idem record;
  collection_row dpg_v1.collections%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'collection_id', p_collection_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.collection.publish', request_hash,
    p_idempotency_key, 'collection', p_collection_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into collection_row from dpg_v1.collections where id = p_collection_id for update;
  if not found then raise exception 'COLLECTION_NOT_FOUND'; end if;
  if collection_row.version <> p_expected_version then raise exception 'STALE_COLLECTION_VERSION'; end if;
  if collection_row.status <> 'DRAFT' then raise exception 'COLLECTION_NOT_DRAFT'; end if;
  if coalesce(cardinality(dpg_v1.collection_publication_failures(p_collection_id)), 1) <> 0 then
    raise exception 'COLLECTION_NOT_PUBLISHABLE';
  end if;
  update dpg_v1.collections
  set status = 'PUBLISHED', published_at = clock_timestamp(), version = version + 1
  where id = p_collection_id
  returning * into collection_row;
  response := jsonb_build_object(
    'collection_id', collection_row.id, 'status', collection_row.status,
    'version', collection_row.version, 'published_at', collection_row.published_at
  );
  update dpg_v1.service_idempotency_records
  set resource_id = collection_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.collection.publish'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.marketing_collection_archive(
  p_collection_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('marketing.collection.archive');
  idem record;
  collection_row dpg_v1.collections%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'collection_id', p_collection_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'marketing.collection.archive', request_hash,
    p_idempotency_key, 'collection', p_collection_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into collection_row from dpg_v1.collections where id = p_collection_id for update;
  if not found then raise exception 'COLLECTION_NOT_FOUND'; end if;
  if collection_row.version <> p_expected_version then raise exception 'STALE_COLLECTION_VERSION'; end if;
  if collection_row.status = 'ARCHIVED' then raise exception 'COLLECTION_ALREADY_ARCHIVED'; end if;
  update dpg_v1.collections
  set status = 'ARCHIVED', published_at = null, version = version + 1
  where id = p_collection_id
  returning * into collection_row;
  response := jsonb_build_object(
    'collection_id', collection_row.id, 'status', collection_row.status, 'version', collection_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = collection_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'marketing.collection.archive'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_order_list(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  ignored uuid := dpg_v1.require_capability('sales.order.read');
  response jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc, row_data.id), '[]'::jsonb)
    into response
  from (
    select o.id, o.order_number, o.source, o.source_quote_id, o.status,
           o.payment_method, o.payment_status, o.customer_name_snapshot,
           o.customer_phone_snapshot, o.total, o.created_at, o.updated_at
    from dpg_v1.orders o
    order by o.created_at desc, o.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ) row_data;
  return response;
end
$$;

create function dpg_v1_api.sales_order_get(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  ignored uuid := dpg_v1.require_capability('sales.order.read');
  response jsonb;
begin
  select to_jsonb(order_row) || jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(to_jsonb(line_row) order by line_row.sort_order, line_row.id)
      from (
        select ol.id, ol.product_id, ol.sort_order, ol.product_sku_snapshot,
               ol.product_model_snapshot, ol.product_name_snapshot,
               ol.brand_name_snapshot, ol.primary_category_name_snapshot,
               ol.availability_snapshot, ol.quantity, ol.unit_price,
               ol.line_discount, ol.line_total, ol.public_note, ol.snapshot_at
        from dpg_v1.order_lines ol where ol.order_id = order_row.id
      ) line_row
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(payment_row) order by payment_row.occurred_at, payment_row.id)
      from (
        select pt.id, pt.transaction_type, pt.amount, pt.reference, pt.occurred_at
        from dpg_v1.payment_transactions pt where pt.order_id = order_row.id
      ) payment_row
    ), '[]'::jsonb)
  ) into response
  from (
    select o.id, o.order_number, o.source, o.source_quote_id, o.status,
           o.payment_method, o.payment_status, o.customer_name_snapshot,
           o.customer_phone_snapshot, o.customer_email_snapshot,
           o.shipping_address_snapshot, o.public_note, o.currency,
           o.subtotal, o.shipping_fee, o.discount_total, o.total,
           o.paid_amount, o.refunded_amount, o.created_at, o.updated_at
    from dpg_v1.orders o where o.id = p_order_id
  ) order_row;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_request_list(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  ignored uuid := dpg_v1.require_capability('sales.quote_request.read');
  response jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.submitted_at desc, row_data.id), '[]'::jsonb)
    into response
  from (
    select qr.id, qr.request_number, qr.customer_name, qr.customer_phone,
           qr.customer_email, qr.project_context, qr.customer_note,
           qr.submitted_at, exists(
             select 1 from dpg_v1.quotes q where q.quote_request_id = qr.id
           ) as has_quote
    from dpg_v1.quote_requests qr
    order by qr.submitted_at desc, qr.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ) row_data;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_request_get(p_request_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  ignored uuid := dpg_v1.require_capability('sales.quote_request.read');
  response jsonb;
begin
  select to_jsonb(request_row) || jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(to_jsonb(line_row) order by line_row.sort_order, line_row.id)
      from (
        select qrl.id, qrl.product_id, qrl.sort_order,
               qrl.product_sku_snapshot, qrl.product_model_snapshot,
               qrl.product_name_snapshot, qrl.brand_name_snapshot,
               qrl.primary_category_name_snapshot, qrl.retail_price_snapshot,
               qrl.availability_snapshot, qrl.requested_quantity,
               qrl.customer_note, qrl.snapshot_at
        from dpg_v1.quote_request_lines qrl
        where qrl.quote_request_id = request_row.id
      ) line_row
    ), '[]'::jsonb)
  ) into response
  from (
    select qr.id, qr.request_number, qr.customer_name, qr.customer_phone,
           qr.customer_email, qr.project_context, qr.customer_note,
           qr.submitted_at
    from dpg_v1.quote_requests qr where qr.id = p_request_id
  ) request_row;
  return response;
end
$$;

create function dpg_v1_api.sales_order_lifecycle_update(
  p_order_id uuid,
  p_status text,
  p_expected_updated_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.order.lifecycle.update');
  idem record;
  order_row dpg_v1.orders%rowtype;
  next_status dpg_v1.order_status;
  request_hash char(64);
  response jsonb;
begin
  begin
    next_status := upper(btrim(p_status))::dpg_v1.order_status;
  exception when invalid_text_representation then
    raise exception 'INVALID_ORDER_STATUS';
  end;
  if p_order_id is null or p_expected_updated_at is null then raise exception 'INVALID_ORDER_UPDATE'; end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'order_id', p_order_id, 'status', next_status, 'expected_updated_at', p_expected_updated_at
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.order.lifecycle.update', request_hash,
    p_idempotency_key, 'order', p_order_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into order_row from dpg_v1.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.updated_at <> p_expected_updated_at then raise exception 'STALE_ORDER_VERSION'; end if;
  if order_row.status = next_status then
    null;
  elsif not (
    (order_row.status = 'NEW' and next_status in ('CONTACTED', 'CANCELLED'))
    or (order_row.status = 'CONTACTED' and next_status in ('CONFIRMED', 'CANCELLED'))
    or (order_row.status = 'CONFIRMED' and next_status in ('PROCESSING', 'CANCELLED'))
    or (order_row.status = 'PROCESSING' and next_status in ('COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'INVALID_ORDER_TRANSITION';
  else
    update dpg_v1.orders set status = next_status where id = p_order_id returning * into order_row;
  end if;
  response := jsonb_build_object(
    'order_id', order_row.id, 'order_number', order_row.order_number,
    'status', order_row.status, 'updated_at', order_row.updated_at
  );
  update dpg_v1.service_idempotency_records
  set resource_id = order_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.order.lifecycle.update'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_order_payment_update(
  p_order_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_reference text,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.order.payment.update');
  idem record;
  order_row dpg_v1.orders%rowtype;
  transaction_type dpg_v1.payment_transaction_type;
  request_hash char(64);
  response jsonb;
begin
  begin
    transaction_type := upper(btrim(p_transaction_type))::dpg_v1.payment_transaction_type;
  exception when invalid_text_representation then
    raise exception 'INVALID_PAYMENT_TRANSACTION';
  end;
  if p_order_id is null or p_amount is null or p_amount <= 0
     or nullif(btrim(p_reference), '') is null or p_occurred_at is null then
    raise exception 'INVALID_PAYMENT_TRANSACTION';
  end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'order_id', p_order_id, 'transaction_type', transaction_type,
    'amount', p_amount, 'reference', btrim(p_reference), 'occurred_at', p_occurred_at
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.order.payment.update', request_hash,
    p_idempotency_key, 'order', p_order_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into order_row from dpg_v1.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into dpg_v1.payment_transactions (
    order_id, transaction_type, amount, reference, occurred_at, created_by
  ) values (p_order_id, transaction_type, p_amount, btrim(p_reference), p_occurred_at, actor_id);
  select * into order_row from dpg_v1.orders where id = p_order_id;
  response := jsonb_build_object(
    'order_id', order_row.id, 'order_number', order_row.order_number,
    'payment_status', order_row.payment_status, 'paid_amount', order_row.paid_amount,
    'refunded_amount', order_row.refunded_amount, 'updated_at', order_row.updated_at
  );
  update dpg_v1.service_idempotency_records
  set resource_id = order_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.order.payment.update'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_order_archive(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.order.archive');
  idem record;
  order_row dpg_v1.orders%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'order_id', p_order_id, 'expected_updated_at', p_expected_updated_at
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.order.archive', request_hash,
    p_idempotency_key, 'order', p_order_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into order_row from dpg_v1.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.updated_at <> p_expected_updated_at then raise exception 'STALE_ORDER_VERSION'; end if;
  if order_row.status = 'COMPLETED' then raise exception 'COMPLETED_ORDER_NOT_ARCHIVABLE'; end if;
  if order_row.status <> 'CANCELLED' then
    update dpg_v1.orders set status = 'CANCELLED' where id = p_order_id returning * into order_row;
  end if;
  response := jsonb_build_object(
    'order_id', order_row.id, 'order_number', order_row.order_number,
    'status', order_row.status, 'updated_at', order_row.updated_at
  );
  update dpg_v1.service_idempotency_records
  set resource_id = order_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.order.archive'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_create(p_input jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.quote.create');
  idem record;
  request_row dpg_v1.quote_requests%rowtype;
  quote_row dpg_v1.quotes%rowtype;
  request_line dpg_v1.quote_request_lines%rowtype;
  request_id uuid;
  quote_id uuid;
  subtotal numeric(15,2) := 0;
  shipping_fee numeric(15,2) := 0;
  discount_total numeric(15,2) := 0;
  expires_at timestamptz;
  request_hash char(64);
  response jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or p_input->>'quote_request_id' is null then
    raise exception 'INVALID_QUOTE_INPUT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_input) input_key
    where input_key not in ('quote_request_id', 'public_note', 'private_note',
                            'shipping_fee', 'discount_total', 'expires_at')
  ) then
    raise exception 'UNKNOWN_QUOTE_FIELD';
  end if;
  begin
    request_id := (p_input->>'quote_request_id')::uuid;
    shipping_fee := coalesce(nullif(p_input->>'shipping_fee', '')::numeric, 0);
    discount_total := coalesce(nullif(p_input->>'discount_total', '')::numeric, 0);
    expires_at := nullif(p_input->>'expires_at', '')::timestamptz;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_QUOTE_INPUT';
  end;
  if shipping_fee < 0 or discount_total < 0 then raise exception 'INVALID_QUOTE_TOTALS'; end if;
  request_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.quote.create', request_hash,
    p_idempotency_key, 'quote', null
  );
  if idem.replay then return idem.safe_response; end if;

  select * into request_row from dpg_v1.quote_requests where id = request_id;
  if not found then raise exception 'QUOTE_REQUEST_NOT_FOUND'; end if;
  if exists (select 1 from dpg_v1.quotes where quote_request_id = request_id) then
    raise exception 'QUOTE_ALREADY_EXISTS';
  end if;
  select coalesce(sum(qrl.retail_price_snapshot * qrl.requested_quantity), 0)
    into subtotal
  from dpg_v1.quote_request_lines qrl
  where qrl.quote_request_id = request_id;
  if subtotal <= 0 then raise exception 'QUOTE_REQUEST_HAS_NO_LINES'; end if;
  if discount_total > subtotal + shipping_fee then raise exception 'INVALID_QUOTE_TOTALS'; end if;

  quote_id := gen_random_uuid();
  insert into dpg_v1.quotes (
    id, quote_number, quote_request_id, status, customer_name_snapshot,
    customer_phone_snapshot, customer_email_snapshot, project_context_snapshot,
    public_note, private_note, subtotal, shipping_fee, discount_total, total,
    expires_at
  ) values (
    quote_id, 'Q-' || upper(replace(quote_id::text, '-', '')), request_row.id,
    'DRAFT', request_row.customer_name, request_row.customer_phone,
    request_row.customer_email, request_row.project_context,
    nullif(btrim(p_input->>'public_note'), ''),
    nullif(btrim(p_input->>'private_note'), ''), subtotal, shipping_fee,
    discount_total, subtotal + shipping_fee - discount_total, expires_at
  ) returning * into quote_row;

  for request_line in
    select * from dpg_v1.quote_request_lines
    where quote_request_id = request_id order by sort_order
  loop
    insert into dpg_v1.quote_lines (
      quote_id, product_id, sort_order, product_sku_snapshot,
      product_model_snapshot, product_name_snapshot, brand_name_snapshot,
      primary_category_name_snapshot, availability_snapshot, quantity,
      unit_price, line_discount, public_note, snapshot_at
    ) values (
      quote_id, request_line.product_id, request_line.sort_order,
      request_line.product_sku_snapshot, request_line.product_model_snapshot,
      request_line.product_name_snapshot, request_line.brand_name_snapshot,
      request_line.primary_category_name_snapshot, request_line.availability_snapshot,
      request_line.requested_quantity, request_line.retail_price_snapshot, 0,
      request_line.customer_note, request_line.snapshot_at
    );
  end loop;
  response := jsonb_build_object(
    'quote_id', quote_row.id, 'quote_number', quote_row.quote_number,
    'status', quote_row.status, 'version', quote_row.version, 'total', quote_row.total
  );
  update dpg_v1.service_idempotency_records
  set resource_id = quote_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.quote.create'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_update(
  p_quote_id uuid,
  p_expected_version integer,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.quote.update');
  idem record;
  quote_row dpg_v1.quotes%rowtype;
  request_line dpg_v1.quote_request_lines%rowtype;
  line_item jsonb;
  line_product_id uuid;
  quantity integer;
  sort_order integer := 0;
  unit_price numeric(15,2);
  line_discount numeric(15,2);
  v_subtotal numeric(15,2) := 0;
  v_shipping_fee numeric(15,2);
  v_discount_total numeric(15,2);
  v_expires_at timestamptz;
  request_hash char(64);
  response jsonb;
begin
  if p_quote_id is null or p_expected_version is null or p_input is null
     or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_QUOTE_INPUT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_input) input_key
    where input_key not in ('public_note', 'private_note', 'shipping_fee',
                            'discount_total', 'expires_at', 'lines')
  ) then
    raise exception 'UNKNOWN_QUOTE_FIELD';
  end if;
  if p_input ? 'lines' and (jsonb_typeof(p_input->'lines') <> 'array'
     or jsonb_array_length(p_input->'lines') not between 1 and 100) then
    raise exception 'INVALID_QUOTE_LINES';
  end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'quote_id', p_quote_id, 'expected_version', p_expected_version, 'input', p_input
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.quote.update', request_hash,
    p_idempotency_key, 'quote', p_quote_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into quote_row from dpg_v1.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if quote_row.version <> p_expected_version then raise exception 'STALE_QUOTE_VERSION'; end if;
  if quote_row.status <> 'DRAFT' then raise exception 'ONLY_DRAFT_QUOTE_EDITABLE'; end if;

  v_shipping_fee := case when p_input ? 'shipping_fee'
    then coalesce(nullif(p_input->>'shipping_fee', '')::numeric, 0) else quote_row.shipping_fee end;
  v_discount_total := case when p_input ? 'discount_total'
    then coalesce(nullif(p_input->>'discount_total', '')::numeric, 0) else quote_row.discount_total end;
  v_expires_at := case when p_input ? 'expires_at'
    then nullif(p_input->>'expires_at', '')::timestamptz else quote_row.expires_at end;
  if v_shipping_fee < 0 or v_discount_total < 0 then raise exception 'INVALID_QUOTE_TOTALS'; end if;

  if p_input ? 'lines' then
    delete from dpg_v1.quote_lines where quote_id = p_quote_id;
    for line_item in select value from jsonb_array_elements(p_input->'lines') loop
      begin
        line_product_id := (line_item->>'product_id')::uuid;
        quantity := (line_item->>'quantity')::integer;
        unit_price := coalesce(nullif(line_item->>'unit_price', '')::numeric, 0);
        line_discount := coalesce(nullif(line_item->>'line_discount', '')::numeric, 0);
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'INVALID_QUOTE_LINE';
      end;
      if line_product_id is null or quantity is null or quantity not between 1 and 1000
         or unit_price <= 0 or line_discount < 0 or line_discount > quantity * unit_price then
        raise exception 'INVALID_QUOTE_LINE';
      end if;
      select qrl.* into request_line
      from dpg_v1.quote_request_lines qrl
      where qrl.quote_request_id = quote_row.quote_request_id
        and qrl.product_id = line_product_id
      order by qrl.sort_order limit 1;
      if not found then raise exception 'QUOTE_PRODUCT_NOT_IN_REQUEST'; end if;
      insert into dpg_v1.quote_lines (
        quote_id, product_id, sort_order, product_sku_snapshot,
        product_model_snapshot, product_name_snapshot, brand_name_snapshot,
        primary_category_name_snapshot, availability_snapshot, quantity,
        unit_price, line_discount, public_note, private_note, snapshot_at
      ) values (
        p_quote_id, request_line.product_id, sort_order,
        request_line.product_sku_snapshot, request_line.product_model_snapshot,
        request_line.product_name_snapshot, request_line.brand_name_snapshot,
        request_line.primary_category_name_snapshot, request_line.availability_snapshot,
        quantity, unit_price, line_discount,
        nullif(btrim(line_item->>'public_note'), ''),
        nullif(btrim(line_item->>'private_note'), ''), clock_timestamp()
      );
      v_subtotal := v_subtotal + (quantity * unit_price) - line_discount;
      sort_order := sort_order + 1;
    end loop;
  else
    select coalesce(sum(ql.line_total), 0) into v_subtotal
    from dpg_v1.quote_lines ql where ql.quote_id = p_quote_id;
  end if;
  if v_subtotal <= 0 or v_discount_total > v_subtotal + v_shipping_fee then
    raise exception 'INVALID_QUOTE_TOTALS';
  end if;
  update dpg_v1.quotes
  set public_note = case when p_input ? 'public_note' then nullif(p_input->>'public_note', '') else quote_row.public_note end,
      private_note = case when p_input ? 'private_note' then nullif(p_input->>'private_note', '') else quote_row.private_note end,
      subtotal = v_subtotal,
      shipping_fee = v_shipping_fee,
      discount_total = v_discount_total,
      total = v_subtotal + v_shipping_fee - v_discount_total,
      expires_at = v_expires_at,
      version = quote_row.version + 1
  where id = p_quote_id
  returning * into quote_row;
  response := jsonb_build_object(
    'quote_id', quote_row.id, 'quote_number', quote_row.quote_number,
    'status', quote_row.status, 'version', quote_row.version, 'total', quote_row.total
  );
  update dpg_v1.service_idempotency_records
  set resource_id = quote_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.quote.update'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_publish(
  p_quote_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1, extensions
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.quote.publish');
  idem record;
  quote_row dpg_v1.quotes%rowtype;
  share_token text;
  share_expires_at timestamptz;
  computed_subtotal numeric(15,2);
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'quote_id', p_quote_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.quote.publish', request_hash,
    p_idempotency_key, 'quote', p_quote_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into quote_row from dpg_v1.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if quote_row.version <> p_expected_version then raise exception 'STALE_QUOTE_VERSION'; end if;
  if quote_row.status <> 'DRAFT' then raise exception 'QUOTE_NOT_DRAFT'; end if;
  select coalesce(sum(ql.line_total), 0) into computed_subtotal
  from dpg_v1.quote_lines ql where ql.quote_id = p_quote_id;
  if computed_subtotal <= 0 or computed_subtotal <> quote_row.subtotal then
    raise exception 'QUOTE_TOTAL_MISMATCH';
  end if;
  share_expires_at := coalesce(quote_row.expires_at, clock_timestamp() + interval '7 days');
  if share_expires_at <= clock_timestamp() then raise exception 'QUOTE_EXPIRY_REQUIRED'; end if;
  share_token := encode(extensions.gen_random_bytes(32), 'hex');
  update dpg_v1.quotes
  set status = 'ISSUED', issued_at = clock_timestamp(), expires_at = share_expires_at,
      version = version + 1
  where id = p_quote_id
  returning * into quote_row;
  insert into dpg_v1.quote_shares (quote_id, token_hash, expires_at)
  values (p_quote_id, dpg_v1.sha256_text(share_token), share_expires_at)
  on conflict (quote_id) do update
    set token_hash = excluded.token_hash, expires_at = excluded.expires_at,
        revoked_at = null;
  response := jsonb_build_object(
    'quote_id', quote_row.id, 'quote_number', quote_row.quote_number,
    'status', quote_row.status, 'version', quote_row.version,
    'share_token', share_token, 'share_expires_at', share_expires_at,
    'total', quote_row.total
  );
  update dpg_v1.service_idempotency_records
  set resource_id = quote_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.quote.publish'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_archive(
  p_quote_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.quote.archive');
  idem record;
  quote_row dpg_v1.quotes%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'quote_id', p_quote_id, 'expected_version', p_expected_version
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.quote.archive', request_hash,
    p_idempotency_key, 'quote', p_quote_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into quote_row from dpg_v1.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if quote_row.version <> p_expected_version then raise exception 'STALE_QUOTE_VERSION'; end if;
  if quote_row.status in ('CONVERTED', 'EXPIRED') then raise exception 'QUOTE_NOT_ARCHIVABLE'; end if;
  if quote_row.status <> 'CANCELLED' then
    update dpg_v1.quotes
    set status = 'CANCELLED', version = version + 1
    where id = p_quote_id returning * into quote_row;
    update dpg_v1.quote_shares set revoked_at = coalesce(revoked_at, clock_timestamp())
    where quote_id = p_quote_id;
  end if;
  response := jsonb_build_object(
    'quote_id', quote_row.id, 'quote_number', quote_row.quote_number,
    'status', quote_row.status, 'version', quote_row.version
  );
  update dpg_v1.service_idempotency_records
  set resource_id = quote_row.id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.quote.archive'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_revoke_share(p_quote_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.quote.archive');
  idem record;
  quote_row dpg_v1.quotes%rowtype;
  request_hash char(64);
  response jsonb;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object('quote_id', p_quote_id));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'sales.quote.revoke_share', request_hash,
    p_idempotency_key, 'quote', p_quote_id
  );
  if idem.replay then return idem.safe_response; end if;
  select * into quote_row from dpg_v1.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  update dpg_v1.quote_shares
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where quote_id = p_quote_id;
  response := jsonb_build_object('quote_id', p_quote_id, 'share_revoked', true);
  update dpg_v1.service_idempotency_records
  set resource_id = p_quote_id, safe_response = response
  where scope_key = actor_id::text and operation = 'sales.quote.revoke_share'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.sales_quote_convert(
  p_quote_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('sales.quote.publish');
  order_id uuid;
  order_number text;
begin
  order_id := dpg_v1.convert_quote_to_order(p_quote_id, p_expected_version, p_idempotency_key);
  select o.order_number into order_number from dpg_v1.orders o where o.id = order_id;
  return jsonb_build_object(
    'quote_id', p_quote_id, 'order_id', order_id, 'order_number', order_number, 'status', 'CONVERTED'
  );
end
$$;

create function dpg_v1_api.staff_user_list()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  ignored uuid := dpg_v1.require_capability('admin.staff.read');
  response jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.email, row_data.auth_user_id), '[]'::jsonb)
    into response
  from (
    select su.auth_user_id, su.email, su.display_name, su.status,
           su.created_at, su.updated_at,
           coalesce(array_agg(sur.role order by sur.role) filter (where sur.role is not null), '{}'::dpg_v1.staff_role[]) as roles
    from dpg_v1.staff_users su
    left join dpg_v1.staff_user_roles sur on sur.auth_user_id = su.auth_user_id
    group by su.auth_user_id, su.email, su.display_name, su.status, su.created_at, su.updated_at
  ) row_data;
  return response;
end
$$;

create function dpg_v1_api.staff_user_provision(
  p_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_roles dpg_v1.staff_role[],
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('admin.staff.create');
  idem record;
  staff_row dpg_v1.staff_users%rowtype;
  existing_role_count integer;
  requested_role_count integer;
  request_hash char(64);
  response jsonb;
begin
  if p_auth_user_id is null or nullif(btrim(lower(p_email)), '') is null
     or nullif(btrim(p_display_name), '') is null
     or p_roles is null or cardinality(p_roles) < 1 then
    raise exception 'INVALID_STAFF_INPUT';
  end if;
  if lower(btrim(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    raise exception 'INVALID_STAFF_EMAIL';
  end if;
  select count(distinct role) into requested_role_count from unnest(p_roles) role;
  if requested_role_count <> cardinality(p_roles) then raise exception 'DUPLICATE_STAFF_ROLE'; end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'auth_user_id', p_auth_user_id, 'email', lower(btrim(p_email)),
    'display_name', btrim(p_display_name), 'roles', to_jsonb(p_roles)
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'staff.user.provision', request_hash,
    p_idempotency_key, 'staff_user', p_auth_user_id
  );
  if idem.replay then return idem.safe_response; end if;
  perform pg_advisory_xact_lock(hashtextextended('dpg_v1:staff:' || p_auth_user_id::text, 0));
  select * into staff_row from dpg_v1.staff_users where auth_user_id = p_auth_user_id for update;
  if found then
    if staff_row.email <> lower(btrim(p_email)) then raise exception 'STAFF_IDENTITY_CONFLICT'; end if;
    if staff_row.status = 'disabled' then raise exception 'STAFF_DISABLED'; end if;
    if staff_row.status = 'active' then
      select count(*) into existing_role_count from dpg_v1.staff_user_roles where auth_user_id = p_auth_user_id;
      if existing_role_count <> requested_role_count
         or exists (select 1 from unnest(p_roles) requested where not exists (
           select 1 from dpg_v1.staff_user_roles current
           where current.auth_user_id = p_auth_user_id and current.role = requested
         )) then
        raise exception 'STAFF_ALREADY_PROVISIONED';
      end if;
    else
      update dpg_v1.staff_users
      set email = lower(btrim(p_email)), display_name = btrim(p_display_name)
      where auth_user_id = p_auth_user_id returning * into staff_row;
      delete from dpg_v1.staff_user_roles where auth_user_id = p_auth_user_id;
      insert into dpg_v1.staff_user_roles (auth_user_id, role)
      select p_auth_user_id, requested_role from unnest(p_roles) requested_role;
    end if;
  else
    insert into dpg_v1.staff_users (auth_user_id, email, display_name, status)
    values (p_auth_user_id, lower(btrim(p_email)), btrim(p_display_name), 'invited')
    returning * into staff_row;
    insert into dpg_v1.staff_user_roles (auth_user_id, role)
    select p_auth_user_id, requested_role from unnest(p_roles) requested_role;
  end if;
  response := jsonb_build_object(
    'auth_user_id', staff_row.auth_user_id, 'email', staff_row.email,
    'display_name', staff_row.display_name, 'status', staff_row.status,
    'roles', to_jsonb(p_roles)
  );
  update dpg_v1.service_idempotency_records
  set resource_id = staff_row.auth_user_id, safe_response = response
  where scope_key = actor_id::text and operation = 'staff.user.provision'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.staff_user_assign_roles(
  p_auth_user_id uuid,
  p_roles dpg_v1.staff_role[],
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('admin.staff.assign_roles');
  idem record;
  staff_row dpg_v1.staff_users%rowtype;
  requested_role_count integer;
  active_admin_count integer;
  request_hash char(64);
  response jsonb;
begin
  if p_auth_user_id is null or p_roles is null or cardinality(p_roles) < 1 then
    raise exception 'INVALID_STAFF_ROLES';
  end if;
  select count(distinct role) into requested_role_count from unnest(p_roles) role;
  if requested_role_count <> cardinality(p_roles) then raise exception 'DUPLICATE_STAFF_ROLE'; end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'auth_user_id', p_auth_user_id, 'roles', to_jsonb(p_roles)
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'staff.user.assign_roles', request_hash,
    p_idempotency_key, 'staff_user', p_auth_user_id
  );
  if idem.replay then return idem.safe_response; end if;
  perform pg_advisory_xact_lock(hashtextextended('dpg_v1:staff:' || p_auth_user_id::text, 0));
  select * into staff_row from dpg_v1.staff_users where auth_user_id = p_auth_user_id for update;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;
  if staff_row.status = 'disabled' then raise exception 'STAFF_DISABLED'; end if;
  if staff_row.status = 'active'
     and exists (select 1 from dpg_v1.staff_user_roles where auth_user_id = p_auth_user_id and role = 'Admin')
     and not ('Admin' = any(p_roles)) then
    select count(*) into active_admin_count
    from dpg_v1.staff_users su
    join dpg_v1.staff_user_roles sur on sur.auth_user_id = su.auth_user_id
    where su.status = 'active' and sur.role = 'Admin';
    if active_admin_count <= 1 then raise exception 'LAST_ACTIVE_ADMIN'; end if;
  end if;
  delete from dpg_v1.staff_user_roles where auth_user_id = p_auth_user_id;
  insert into dpg_v1.staff_user_roles (auth_user_id, role)
  select p_auth_user_id, requested_role from unnest(p_roles) requested_role;
  response := jsonb_build_object(
    'auth_user_id', p_auth_user_id, 'status', staff_row.status, 'roles', to_jsonb(p_roles)
  );
  update dpg_v1.service_idempotency_records
  set resource_id = p_auth_user_id, safe_response = response
  where scope_key = actor_id::text and operation = 'staff.user.assign_roles'
    and key_hash = idem.key_hash;
  return response;
end
$$;

create function dpg_v1_api.staff_user_disable(p_auth_user_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('admin.staff.disable');
  idem record;
  staff_row dpg_v1.staff_users%rowtype;
  active_admin_count integer;
  request_hash char(64);
  response jsonb;
begin
  if p_auth_user_id is null then raise exception 'INVALID_STAFF_INPUT'; end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object('auth_user_id', p_auth_user_id));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'staff.user.disable', request_hash,
    p_idempotency_key, 'staff_user', p_auth_user_id
  );
  if idem.replay then return idem.safe_response; end if;
  perform pg_advisory_xact_lock(hashtextextended('dpg_v1:staff:' || p_auth_user_id::text, 0));
  select * into staff_row from dpg_v1.staff_users where auth_user_id = p_auth_user_id for update;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;
  if staff_row.status = 'active'
     and exists (select 1 from dpg_v1.staff_user_roles where auth_user_id = p_auth_user_id and role = 'Admin') then
    select count(*) into active_admin_count
    from dpg_v1.staff_users su
    join dpg_v1.staff_user_roles sur on sur.auth_user_id = su.auth_user_id
    where su.status = 'active' and sur.role = 'Admin';
    if active_admin_count <= 1 then raise exception 'LAST_ACTIVE_ADMIN'; end if;
  end if;
  if staff_row.status <> 'disabled' then
    update dpg_v1.staff_users set status = 'disabled'
    where auth_user_id = p_auth_user_id returning * into staff_row;
  end if;
  response := jsonb_build_object(
    'auth_user_id', staff_row.auth_user_id, 'status', staff_row.status
  );
  update dpg_v1.service_idempotency_records
  set resource_id = staff_row.auth_user_id, safe_response = response
  where scope_key = actor_id::text and operation = 'staff.user.disable'
    and key_hash = idem.key_hash;
  return response;
end
$$;

-- API execute grants are deliberately enumerated. A future function in this
-- schema must not become callable merely because it was created here.
revoke all on all functions in schema dpg_v1_api from public, anon, authenticated, service_role;

grant execute on function dpg_v1_api.public_product_list(integer, integer),
  dpg_v1_api.public_product_get(uuid),
  dpg_v1_api.public_content_list(integer, integer),
  dpg_v1_api.public_content_get(uuid),
  dpg_v1_api.public_collection_list(integer, integer),
  dpg_v1_api.order_intake_create(jsonb, text),
  dpg_v1_api.quote_request_intake_create(jsonb, text),
  dpg_v1_api.shareable_quote_read(text)
to anon, authenticated;

grant execute on function dpg_v1_api.staff_context(), dpg_v1_api.staff_can(text),
  dpg_v1_api.catalogue_product_create(jsonb, text),
  dpg_v1_api.catalogue_product_update(uuid, integer, jsonb, text),
  dpg_v1_api.catalogue_product_publish(uuid, integer, text),
  dpg_v1_api.catalogue_product_archive(uuid, integer, text),
  dpg_v1_api.marketing_content_create(jsonb, text),
  dpg_v1_api.marketing_content_update(uuid, integer, jsonb, text),
  dpg_v1_api.marketing_content_publish(uuid, integer, text),
  dpg_v1_api.marketing_content_archive(uuid, integer, text),
  dpg_v1_api.marketing_collection_create(jsonb, text),
  dpg_v1_api.marketing_collection_update(uuid, integer, jsonb, text),
  dpg_v1_api.marketing_collection_publish(uuid, integer, text),
  dpg_v1_api.marketing_collection_archive(uuid, integer, text),
  dpg_v1_api.sales_order_list(integer, integer),
  dpg_v1_api.sales_order_get(uuid),
  dpg_v1_api.sales_quote_request_list(integer, integer),
  dpg_v1_api.sales_quote_request_get(uuid),
  dpg_v1_api.sales_order_lifecycle_update(uuid, text, timestamptz, text),
  dpg_v1_api.sales_order_payment_update(uuid, text, numeric, text, timestamptz, text),
  dpg_v1_api.sales_order_archive(uuid, timestamptz, text),
  dpg_v1_api.sales_quote_create(jsonb, text),
  dpg_v1_api.sales_quote_update(uuid, integer, jsonb, text),
  dpg_v1_api.sales_quote_publish(uuid, integer, text),
  dpg_v1_api.sales_quote_archive(uuid, integer, text),
  dpg_v1_api.sales_quote_revoke_share(uuid, text),
  dpg_v1_api.sales_quote_convert(uuid, integer, text),
  dpg_v1_api.staff_user_list(),
  dpg_v1_api.staff_user_provision(uuid, text, text, dpg_v1.staff_role[], text),
  dpg_v1_api.staff_user_assign_roles(uuid, dpg_v1.staff_role[], text),
  dpg_v1_api.staff_user_disable(uuid, text)
to authenticated;
