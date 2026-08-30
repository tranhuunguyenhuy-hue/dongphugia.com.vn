-- LEO-561 canonical V1 catalogue, content, commerce, and staff-role schema.
--
-- This migration creates a clean private authority in dpg_v1. Existing
-- dpg_app/public legacy structures remain untouched and are migration input
-- only. LEO-562 owns data mapping/import. LEO-564 owns Auth integration,
-- grants, RLS policies, capability population, and public/staff interfaces.

create schema if not exists dpg_v1;
revoke all on schema dpg_v1 from public;

create type dpg_v1.record_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type dpg_v1.availability_status as enum ('IN_STOCK', 'PREORDER', 'CONTACT', 'DISCONTINUED');
create type dpg_v1.attribute_value_type as enum ('text', 'number', 'boolean', 'enum', 'multi_enum');
create type dpg_v1.attribute_requirement_tier as enum ('none', 'launch', 'deep');
create type dpg_v1.source_quality as enum ('official', 'verified', 'legacy', 'quarantined');
create type dpg_v1.media_kind as enum ('IMAGE', 'DOCUMENT');
create type dpg_v1.media_state as enum ('PENDING', 'READY', 'TOMBSTONED');
create type dpg_v1.product_media_role as enum ('PRIMARY', 'GALLERY');
create type dpg_v1.content_type as enum ('GUIDE', 'INSPIRATION', 'BUYING_GUIDE', 'LANDING_PAGE');
create type dpg_v1.content_block_type as enum (
  'RICH_TEXT', 'HEADING', 'MEDIA', 'QUOTE_CALLOUT', 'PRODUCT_GRID',
  'CATEGORY_LINKS', 'BRAND_LINKS', 'CTA', 'SPECIFICATIONS_TABLE'
);
create type dpg_v1.order_source as enum ('RETAIL', 'QUOTE');
create type dpg_v1.order_status as enum ('NEW', 'CONTACTED', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED');
create type dpg_v1.payment_method as enum ('COD', 'BANK_TRANSFER');
create type dpg_v1.payment_status as enum ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');
create type dpg_v1.payment_transaction_type as enum ('PAYMENT', 'REFUND');
create type dpg_v1.quote_status as enum ('DRAFT', 'ISSUED', 'CONVERTED', 'CANCELLED', 'EXPIRED');
create type dpg_v1.staff_status as enum ('invited', 'active', 'disabled');
create type dpg_v1.staff_role as enum ('Product', 'Sales', 'Marketing', 'Admin');
create type dpg_v1.staff_capability as enum (
  'catalogue.read', 'catalogue.create', 'catalogue.update', 'catalogue.publish', 'catalogue.archive',
  'sales.order.read', 'sales.order.lifecycle.update', 'sales.order.payment.update', 'sales.order.archive',
  'sales.quote_request.read',
  'sales.quote.read', 'sales.quote.create', 'sales.quote.update', 'sales.quote.publish', 'sales.quote.archive',
  'marketing.content.read', 'marketing.content.create', 'marketing.content.update', 'marketing.content.publish', 'marketing.content.archive',
  'marketing.collection.read', 'marketing.collection.create', 'marketing.collection.update', 'marketing.collection.publish', 'marketing.collection.archive',
  'admin.staff.read', 'admin.staff.create', 'admin.staff.update', 'admin.staff.disable', 'admin.staff.assign_roles',
  'admin.config.read', 'admin.config.create', 'admin.config.update'
);

create table dpg_v1.staff_users (
  auth_user_id uuid primary key,
  email text not null,
  display_name text not null,
  status dpg_v1.staff_status not null default 'invited',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid,
  constraint staff_users_email_normalized check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint staff_users_updated_by_fkey foreign key (updated_by)
    references dpg_v1.staff_users(auth_user_id) on delete set null
);

create unique index staff_users_email_key on dpg_v1.staff_users (lower(email));

create table dpg_v1.staff_user_roles (
  auth_user_id uuid not null references dpg_v1.staff_users(auth_user_id) on delete cascade,
  role dpg_v1.staff_role not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  primary key (auth_user_id, role)
);

-- Fixed-role configuration boundary only. LEO-564 owns the reviewed rows and
-- the current-staff capability helper; there is no custom-role table.
create table dpg_v1.role_capabilities (
  role dpg_v1.staff_role not null,
  capability dpg_v1.staff_capability not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (role, capability)
);

create table dpg_v1.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind dpg_v1.media_kind not null,
  original_object_key text not null,
  delivery_object_key text not null,
  profile_version text,
  sha256 char(64) not null,
  mime_type text not null,
  byte_size bigint not null,
  width_px integer,
  height_px integer,
  provenance text not null,
  state dpg_v1.media_state not null default 'PENDING',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint media_assets_original_key_check check (btrim(original_object_key) <> '' and original_object_key !~ '^[a-z][a-z0-9+.-]*://'),
  constraint media_assets_delivery_key_check check (btrim(delivery_object_key) <> '' and delivery_object_key !~ '^[a-z][a-z0-9+.-]*://'),
  constraint media_assets_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint media_assets_size_check check (byte_size > 0),
  constraint media_assets_dimensions_check check (
    (kind = 'IMAGE' and width_px > 0 and height_px > 0 and profile_version is not null)
    or (kind = 'DOCUMENT' and width_px is null and height_px is null)
  ),
  constraint media_assets_mime_check check (
    (kind = 'IMAGE' and mime_type like 'image/%')
    or (kind = 'DOCUMENT' and mime_type in ('application/pdf', 'application/octet-stream'))
  ),
  unique (delivery_object_key),
  unique (sha256, delivery_object_key)
);

create table dpg_v1.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  summary text,
  logo_media_id uuid references dpg_v1.media_assets(id) on delete restrict,
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint brands_name_check check (btrim(name) <> ''),
  constraint brands_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint brands_version_check check (version > 0),
  unique (slug)
);

create unique index brands_name_key on dpg_v1.brands (lower(name));

create table dpg_v1.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references dpg_v1.categories(id) on delete restrict,
  sector text not null,
  name text not null,
  slug text not null,
  summary text,
  is_leaf boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint categories_sector_check check (sector in ('sanitary', 'tile', 'water', 'kitchen')),
  constraint categories_name_check check (btrim(name) <> ''),
  constraint categories_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_sort_order_check check (sort_order >= 0),
  constraint categories_version_check check (version > 0),
  constraint categories_root_check check (
    parent_id is not null
    or (not is_leaf and slug = sector)
  ),
  unique (parent_id, slug)
);

create unique index categories_one_root_per_sector on dpg_v1.categories (sector) where parent_id is null;
create index categories_parent_order_idx on dpg_v1.categories (parent_id, sort_order, name);

insert into dpg_v1.categories (id, sector, name, slug, sort_order) values
  ('10000000-0000-4000-8000-000000000001', 'sanitary', 'Thiết bị vệ sinh', 'sanitary', 0),
  ('10000000-0000-4000-8000-000000000002', 'tile', 'Gạch ốp lát', 'tile', 1),
  ('10000000-0000-4000-8000-000000000003', 'water', 'Thiết bị nước', 'water', 2),
  ('10000000-0000-4000-8000-000000000004', 'kitchen', 'Thiết bị bếp', 'kitchen', 3);

create table dpg_v1.product_families (
  id uuid primary key default gen_random_uuid(),
  family_key text not null,
  name text not null,
  summary text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_families_key_check check (family_key ~ '^[a-z0-9]+(?::[a-z0-9-]+)+$'),
  constraint product_families_name_check check (btrim(name) <> ''),
  unique (family_key)
);

create table dpg_v1.product_family_configuration_groups (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references dpg_v1.product_families(id) on delete cascade,
  group_key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_family_configuration_groups_key_check check (group_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint product_family_configuration_groups_label_check check (btrim(label) <> ''),
  constraint product_family_configuration_groups_order_check check (sort_order >= 0),
  unique (family_id, group_key),
  unique (family_id, sort_order),
  unique (id, family_id)
);

create table dpg_v1.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  model text not null,
  name text not null,
  slug text not null,
  brand_id uuid not null references dpg_v1.brands(id) on delete restrict,
  primary_category_id uuid not null references dpg_v1.categories(id) on delete restrict,
  retail_price numeric(15,2),
  list_price numeric(15,2),
  currency char(3) not null default 'VND',
  availability dpg_v1.availability_status not null default 'CONTACT',
  status dpg_v1.record_status not null default 'DRAFT',
  description text,
  seo_title text,
  seo_description text,
  unresolved_critical_conflict boolean not null default false,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint products_sku_check check (btrim(sku) <> ''),
  constraint products_model_check check (btrim(model) <> ''),
  constraint products_name_check check (btrim(name) <> ''),
  constraint products_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_prices_check check (
    (retail_price is null or retail_price > 0)
    and (list_price is null or list_price > 0)
  ),
  constraint products_currency_check check (currency = 'VND'),
  constraint products_version_check check (version > 0),
  constraint products_public_price_check check (
    status <> 'PUBLISHED' or (retail_price is not null and retail_price > 0)
  ),
  constraint products_published_at_check check (
    (status = 'DRAFT' and published_at is null)
    or (status = 'PUBLISHED' and published_at is not null)
    or status = 'ARCHIVED'
  ),
  unique (sku),
  unique (model),
  unique (slug)
);

create index products_brand_status_idx on dpg_v1.products (brand_id, status, name);
create index products_category_status_idx on dpg_v1.products (primary_category_id, status, name);

create table dpg_v1.product_family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references dpg_v1.product_families(id) on delete cascade,
  product_id uuid not null references dpg_v1.products(id) on delete cascade,
  configuration_group_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_family_memberships_order_check check (sort_order >= 0),
  constraint product_family_memberships_configuration_group_fkey
    foreign key (configuration_group_id, family_id)
    references dpg_v1.product_family_configuration_groups(id, family_id) on delete restrict,
  constraint product_family_memberships_one_family_per_product unique (product_id),
  constraint product_family_memberships_family_order_key unique (family_id, sort_order),
  constraint product_family_memberships_family_product_key unique (family_id, product_id)
);

create view dpg_v1.product_family_navigation_eligibility
with (security_invoker = true)
as
select f.id as family_id, count(m.product_id) >= 2 as eligible, count(m.product_id)::integer as product_count
from dpg_v1.product_families f
left join dpg_v1.product_family_memberships m on m.family_id = f.id
group by f.id;

create table dpg_v1.product_source_provenance (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references dpg_v1.products(id) on delete cascade,
  source_kind text not null,
  source_reference text not null,
  quality dpg_v1.source_quality not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_source_provenance_kind_check check (source_kind in ('manufacturer', 'catalogue', 'legacy', 'manual')),
  constraint product_source_provenance_reference_check check (btrim(source_reference) <> ''),
  unique (product_id, source_kind, source_reference),
  unique (id, product_id)
);

create index product_source_provenance_product_quality_idx on dpg_v1.product_source_provenance (product_id, quality);

create table dpg_v1.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  summary text,
  hero_media_id uuid references dpg_v1.media_assets(id) on delete restrict,
  status dpg_v1.record_status not null default 'DRAFT',
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint collections_title_check check (btrim(title) <> ''),
  constraint collections_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint collections_version_check check (version > 0),
  constraint collections_published_at_check check (
    (status = 'DRAFT' and published_at is null)
    or (status = 'PUBLISHED' and published_at is not null)
    or status = 'ARCHIVED'
  ),
  unique (slug)
);

create table dpg_v1.collection_products (
  collection_id uuid not null references dpg_v1.collections(id) on delete cascade,
  product_id uuid not null references dpg_v1.products(id) on delete restrict,
  sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  primary key (collection_id, product_id),
  constraint collection_products_order_check check (sort_order >= 0),
  constraint collection_products_order_key unique (collection_id, sort_order)
);

create table dpg_v1.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  attribute_key text not null,
  label text not null,
  value_type dpg_v1.attribute_value_type not null,
  canonical_unit text,
  canonical_dimension text,
  number_min numeric,
  number_max numeric,
  validation_pattern text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint attribute_definitions_key_check check (attribute_key ~ '^[a-z][a-z0-9_]*$'),
  constraint attribute_definitions_label_check check (btrim(label) <> ''),
  constraint attribute_definitions_number_range_check check (
    (number_min is null or number_max is null or number_min <= number_max)
    and (value_type = 'number' or (number_min is null and number_max is null and canonical_unit is null and canonical_dimension is null))
  ),
  constraint attribute_definitions_pattern_check check (value_type = 'text' or validation_pattern is null),
  unique (attribute_key)
);

create table dpg_v1.attribute_options (
  id uuid primary key default gen_random_uuid(),
  attribute_definition_id uuid not null references dpg_v1.attribute_definitions(id) on delete cascade,
  option_key text not null,
  label text not null,
  aliases text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint attribute_options_key_check check (option_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint attribute_options_label_check check (btrim(label) <> ''),
  constraint attribute_options_order_check check (sort_order >= 0),
  unique (attribute_definition_id, option_key),
  unique (attribute_definition_id, sort_order),
  unique (id, attribute_definition_id)
);

create table dpg_v1.category_attribute_policies (
  category_id uuid not null references dpg_v1.categories(id) on delete cascade,
  attribute_definition_id uuid not null references dpg_v1.attribute_definitions(id) on delete restrict,
  pdp_visible boolean not null default true,
  pdp_sort_order integer,
  filterable boolean not null default false,
  filter_sort_order integer,
  requirement_tier dpg_v1.attribute_requirement_tier not null default 'none',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  primary key (category_id, attribute_definition_id),
  constraint category_attribute_policies_pdp_order_check check ((pdp_visible and pdp_sort_order >= 0) or (not pdp_visible and pdp_sort_order is null)),
  constraint category_attribute_policies_filter_order_check check ((filterable and filter_sort_order >= 0) or (not filterable and filter_sort_order is null))
);

create unique index category_attribute_policies_pdp_order_key
  on dpg_v1.category_attribute_policies (category_id, pdp_sort_order)
  where pdp_visible;
create unique index category_attribute_policies_filter_order_key
  on dpg_v1.category_attribute_policies (category_id, filter_sort_order)
  where filterable;

create table dpg_v1.product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references dpg_v1.products(id) on delete cascade,
  attribute_definition_id uuid not null references dpg_v1.attribute_definitions(id) on delete restrict,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  option_id uuid,
  quality dpg_v1.source_quality not null,
  source_provenance_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_attribute_values_option_fkey
    foreign key (option_id, attribute_definition_id)
    references dpg_v1.attribute_options(id, attribute_definition_id) on delete restrict,
  constraint product_attribute_values_provenance_fkey
    foreign key (source_provenance_id, product_id)
    references dpg_v1.product_source_provenance(id, product_id) on delete restrict,
  constraint product_attribute_values_official_verified_provenance_check check (
    quality not in ('official', 'verified') or source_provenance_id is not null
  ),
  unique (product_id, attribute_definition_id),
  unique (id, attribute_definition_id)
);

create index product_attribute_values_number_idx
  on dpg_v1.product_attribute_values (attribute_definition_id, number_value, product_id)
  where number_value is not null;
create index product_attribute_values_option_idx
  on dpg_v1.product_attribute_values (attribute_definition_id, option_id, product_id)
  where option_id is not null;
create index product_attribute_values_boolean_idx
  on dpg_v1.product_attribute_values (attribute_definition_id, boolean_value, product_id)
  where boolean_value is not null;

create table dpg_v1.product_attribute_multi_options (
  product_attribute_value_id uuid not null,
  attribute_definition_id uuid not null,
  option_id uuid not null,
  sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (product_attribute_value_id, option_id),
  constraint product_attribute_multi_options_order_check check (sort_order >= 0),
  constraint product_attribute_multi_options_value_fkey
    foreign key (product_attribute_value_id, attribute_definition_id)
    references dpg_v1.product_attribute_values(id, attribute_definition_id) on delete cascade,
  constraint product_attribute_multi_options_option_fkey
    foreign key (option_id, attribute_definition_id)
    references dpg_v1.attribute_options(id, attribute_definition_id) on delete restrict,
  unique (product_attribute_value_id, sort_order)
);

create table dpg_v1.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references dpg_v1.products(id) on delete cascade,
  media_asset_id uuid not null references dpg_v1.media_assets(id) on delete restrict,
  role dpg_v1.product_media_role not null,
  sort_order integer not null,
  alt_text text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_media_order_check check (
    (role = 'PRIMARY' and sort_order = 0)
    or (role = 'GALLERY' and sort_order >= 0)
  ),
  constraint product_media_alt_check check (btrim(alt_text) <> ''),
  unique (product_id, media_asset_id),
  unique (product_id, role, sort_order)
);

create unique index product_media_one_primary on dpg_v1.product_media (product_id) where role = 'PRIMARY';

create table dpg_v1.product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references dpg_v1.products(id) on delete cascade,
  media_asset_id uuid not null references dpg_v1.media_assets(id) on delete restrict,
  document_type text not null,
  title text not null,
  sort_order integer not null,
  is_public boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint product_documents_type_check check (document_type in ('TECHNICAL_SHEET', 'INSTALLATION_GUIDE', 'WARRANTY', 'CERTIFICATE', 'OTHER')),
  constraint product_documents_title_check check (btrim(title) <> ''),
  constraint product_documents_order_check check (sort_order >= 0),
  unique (product_id, media_asset_id),
  unique (product_id, sort_order)
);

create table dpg_v1.content_entries (
  id uuid primary key default gen_random_uuid(),
  type dpg_v1.content_type not null,
  title text not null,
  slug text not null,
  excerpt text,
  hero_media_id uuid references dpg_v1.media_assets(id) on delete restrict,
  seo_title text,
  seo_description text,
  author_id uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  editor_id uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  route_path text,
  status dpg_v1.record_status not null default 'DRAFT',
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint content_entries_title_check check (btrim(title) <> ''),
  constraint content_entries_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint content_entries_route_check check (
    (type = 'LANDING_PAGE' and route_path ~ '^/[a-z0-9][a-z0-9/-]*$')
    or (type <> 'LANDING_PAGE' and route_path is null)
  ),
  constraint content_entries_landing_route_reserved_check check (
    type <> 'LANDING_PAGE'
    or (
      route_path not in (
        '/', '/tim-kiem', '/danh-muc', '/thuong-hieu', '/san-pham', '/bo-suu-tap',
        '/yeu-thich', '/gio-hang', '/thanh-toan', '/dat-hang', '/bao-gia', '/cam-nang',
        '/showroom', '/ho-tro'
      )
      and route_path !~ '^/(?:tim-kiem|danh-muc|thuong-hieu|san-pham|bo-suu-tap|yeu-thich|gio-hang|thanh-toan|dat-hang|bao-gia|cam-nang|showroom|ho-tro)(?:/|$)'
    )
  ),
  constraint content_entries_version_check check (version > 0),
  constraint content_entries_published_at_check check (
    (status = 'DRAFT' and published_at is null)
    or (status = 'PUBLISHED' and published_at is not null)
    or status = 'ARCHIVED'
  ),
  unique (slug),
  unique (route_path)
);

create table dpg_v1.content_blocks (
  id uuid primary key default gen_random_uuid(),
  content_entry_id uuid not null references dpg_v1.content_entries(id) on delete cascade,
  block_type dpg_v1.content_block_type not null,
  media_asset_id uuid references dpg_v1.media_assets(id) on delete restrict,
  payload jsonb not null,
  sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint content_blocks_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint content_blocks_media_reference_check check (
    (block_type = 'MEDIA' and media_asset_id is not null)
    or (block_type <> 'MEDIA' and media_asset_id is null)
  ),
  constraint content_blocks_order_check check (sort_order >= 0),
  unique (content_entry_id, sort_order),
  unique (id, content_entry_id)
);

create table dpg_v1.content_product_references (
  content_entry_id uuid not null references dpg_v1.content_entries(id) on delete cascade,
  product_id uuid not null references dpg_v1.products(id) on delete restrict,
  block_id uuid,
  role text not null,
  sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (content_entry_id, product_id, role),
  constraint content_product_references_block_fkey foreign key (block_id, content_entry_id)
    references dpg_v1.content_blocks(id, content_entry_id) on delete cascade,
  constraint content_product_references_role_check check (role ~ '^[a-z][a-z0-9_]*$'),
  constraint content_product_references_order_check check (sort_order >= 0),
  unique (content_entry_id, role, sort_order)
);

create table dpg_v1.content_category_references (
  content_entry_id uuid not null references dpg_v1.content_entries(id) on delete cascade,
  category_id uuid not null references dpg_v1.categories(id) on delete restrict,
  block_id uuid,
  role text not null,
  sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (content_entry_id, category_id, role),
  constraint content_category_references_block_fkey foreign key (block_id, content_entry_id)
    references dpg_v1.content_blocks(id, content_entry_id) on delete cascade,
  constraint content_category_references_role_check check (role ~ '^[a-z][a-z0-9_]*$'),
  constraint content_category_references_order_check check (sort_order >= 0),
  unique (content_entry_id, role, sort_order)
);

create table dpg_v1.content_brand_references (
  content_entry_id uuid not null references dpg_v1.content_entries(id) on delete cascade,
  brand_id uuid not null references dpg_v1.brands(id) on delete restrict,
  block_id uuid,
  role text not null,
  sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (content_entry_id, brand_id, role),
  constraint content_brand_references_block_fkey foreign key (block_id, content_entry_id)
    references dpg_v1.content_blocks(id, content_entry_id) on delete cascade,
  constraint content_brand_references_role_check check (role ~ '^[a-z][a-z0-9_]*$'),
  constraint content_brand_references_order_check check (sort_order >= 0),
  unique (content_entry_id, role, sort_order)
);

create table dpg_v1.quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  project_context text,
  customer_note text,
  submitted_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint quote_requests_number_check check (request_number ~ '^QR-[A-Z0-9-]+$'),
  constraint quote_requests_name_check check (btrim(customer_name) <> ''),
  constraint quote_requests_phone_check check (btrim(customer_phone) <> ''),
  unique (request_number)
);

create table dpg_v1.quote_request_lines (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references dpg_v1.quote_requests(id) on delete restrict,
  product_id uuid references dpg_v1.products(id) on delete set null,
  sort_order integer not null,
  product_sku_snapshot text not null,
  product_model_snapshot text not null,
  product_name_snapshot text not null,
  brand_name_snapshot text not null,
  primary_category_name_snapshot text not null,
  retail_price_snapshot numeric(15,2) not null,
  availability_snapshot dpg_v1.availability_status not null,
  requested_quantity integer not null,
  customer_note text,
  snapshot_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint quote_request_lines_order_check check (sort_order >= 0),
  constraint quote_request_lines_snapshot_check check (
    btrim(product_sku_snapshot) <> '' and btrim(product_model_snapshot) <> ''
    and btrim(product_name_snapshot) <> '' and btrim(brand_name_snapshot) <> ''
    and btrim(primary_category_name_snapshot) <> '' and retail_price_snapshot > 0
    and requested_quantity > 0
  ),
  unique (quote_request_id, sort_order)
);

create table dpg_v1.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null,
  quote_request_id uuid not null references dpg_v1.quote_requests(id) on delete restrict,
  status dpg_v1.quote_status not null default 'DRAFT',
  version integer not null default 1,
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  customer_email_snapshot text,
  project_context_snapshot text,
  public_note text,
  private_note text,
  currency char(3) not null default 'VND',
  subtotal numeric(15,2) not null default 0,
  shipping_fee numeric(15,2) not null default 0,
  discount_total numeric(15,2) not null default 0,
  total numeric(15,2) not null default 0,
  issued_at timestamptz,
  expires_at timestamptz,
  converted_order_id uuid,
  converted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint quotes_number_check check (quote_number ~ '^Q-[A-Z0-9-]+$'),
  constraint quotes_version_check check (version > 0),
  constraint quotes_currency_check check (currency = 'VND'),
  constraint quotes_totals_check check (
    subtotal >= 0 and shipping_fee >= 0 and discount_total >= 0 and total >= 0
    and total = subtotal + shipping_fee - discount_total
    and discount_total <= subtotal + shipping_fee
  ),
  constraint quotes_issued_check check (
    (status = 'DRAFT' and issued_at is null)
    or status = 'CANCELLED'
    or (status in ('ISSUED', 'CONVERTED', 'EXPIRED') and issued_at is not null)
  ),
  constraint quotes_expiry_check check (expires_at is null or expires_at > issued_at),
  constraint quotes_conversion_check check (
    (status = 'CONVERTED' and converted_order_id is not null and converted_at is not null)
    or (status <> 'CONVERTED' and converted_order_id is null and converted_at is null)
  ),
  unique (quote_number),
  unique (quote_request_id)
);

create table dpg_v1.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references dpg_v1.quotes(id) on delete restrict,
  product_id uuid references dpg_v1.products(id) on delete set null,
  sort_order integer not null,
  product_sku_snapshot text not null,
  product_model_snapshot text not null,
  product_name_snapshot text not null,
  brand_name_snapshot text not null,
  primary_category_name_snapshot text not null,
  availability_snapshot dpg_v1.availability_status not null,
  quantity integer not null,
  unit_price numeric(15,2) not null,
  line_discount numeric(15,2) not null default 0,
  line_total numeric(15,2) generated always as ((quantity * unit_price) - line_discount) stored,
  public_note text,
  private_note text,
  snapshot_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint quote_lines_order_check check (sort_order >= 0),
  constraint quote_lines_snapshot_check check (
    btrim(product_sku_snapshot) <> '' and btrim(product_model_snapshot) <> ''
    and btrim(product_name_snapshot) <> '' and btrim(brand_name_snapshot) <> ''
    and btrim(primary_category_name_snapshot) <> '' and quantity > 0
    and unit_price > 0 and line_discount >= 0 and line_discount <= quantity * unit_price
  ),
  unique (quote_id, sort_order)
);

create index quote_lines_quote_idx on dpg_v1.quote_lines (quote_id, sort_order);

create table dpg_v1.quote_shares (
  quote_id uuid primary key references dpg_v1.quotes(id) on delete cascade,
  token_hash char(64) not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint quote_shares_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  unique (token_hash)
);

create table dpg_v1.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  source dpg_v1.order_source not null,
  source_quote_id uuid references dpg_v1.quotes(id) on delete restrict,
  status dpg_v1.order_status not null default 'NEW',
  payment_method dpg_v1.payment_method not null,
  payment_status dpg_v1.payment_status not null default 'UNPAID',
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  customer_email_snapshot text,
  shipping_address_snapshot text,
  public_note text,
  currency char(3) not null default 'VND',
  subtotal numeric(15,2) not null,
  shipping_fee numeric(15,2) not null default 0,
  discount_total numeric(15,2) not null default 0,
  total numeric(15,2) not null,
  paid_amount numeric(15,2) not null default 0,
  refunded_amount numeric(15,2) not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint orders_number_check check (order_number ~ '^O-[A-Z0-9-]+$'),
  constraint orders_source_check check (
    (source = 'RETAIL' and source_quote_id is null)
    or (source = 'QUOTE' and source_quote_id is not null)
  ),
  constraint orders_currency_check check (currency = 'VND'),
  constraint orders_totals_check check (
    subtotal >= 0 and shipping_fee >= 0 and discount_total >= 0 and total >= 0
    and total = subtotal + shipping_fee - discount_total
    and discount_total <= subtotal + shipping_fee
  ),
  constraint orders_payment_amounts_check check (
    paid_amount >= 0 and refunded_amount >= 0 and refunded_amount <= paid_amount
  ),
  unique (order_number),
  unique (source_quote_id),
  unique (id, source_quote_id)
);

alter table dpg_v1.quotes
  add constraint quotes_converted_order_fkey
  foreign key (converted_order_id, id)
  references dpg_v1.orders(id, source_quote_id) deferrable initially deferred;

create index orders_status_created_idx on dpg_v1.orders (status, created_at desc);
create index orders_payment_status_created_idx on dpg_v1.orders (payment_status, created_at desc);

create table dpg_v1.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references dpg_v1.orders(id) on delete restrict,
  product_id uuid references dpg_v1.products(id) on delete set null,
  sort_order integer not null,
  product_sku_snapshot text not null,
  product_model_snapshot text not null,
  product_name_snapshot text not null,
  brand_name_snapshot text not null,
  primary_category_name_snapshot text not null,
  availability_snapshot dpg_v1.availability_status not null,
  quantity integer not null,
  unit_price numeric(15,2) not null,
  line_discount numeric(15,2) not null default 0,
  line_total numeric(15,2) generated always as ((quantity * unit_price) - line_discount) stored,
  public_note text,
  snapshot_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint order_lines_order_check check (sort_order >= 0),
  constraint order_lines_snapshot_check check (
    btrim(product_sku_snapshot) <> '' and btrim(product_model_snapshot) <> ''
    and btrim(product_name_snapshot) <> '' and btrim(brand_name_snapshot) <> ''
    and btrim(primary_category_name_snapshot) <> '' and quantity > 0
    and unit_price > 0 and line_discount >= 0 and line_discount <= quantity * unit_price
  ),
  unique (order_id, sort_order)
);

create table dpg_v1.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references dpg_v1.orders(id) on delete restrict,
  transaction_type dpg_v1.payment_transaction_type not null,
  amount numeric(15,2) not null,
  reference text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint payment_transactions_amount_check check (amount > 0),
  unique (order_id, reference)
);

create index payment_transactions_order_time_idx on dpg_v1.payment_transactions (order_id, occurred_at, id);

create table dpg_v1.commerce_idempotency_records (
  operation text not null,
  key_hash char(64) not null,
  request_hash char(64) not null,
  resource_type text not null,
  resource_id uuid,
  safe_response jsonb,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key (operation, key_hash),
  constraint commerce_idempotency_operation_check check (operation in ('retail_order.create', 'quote_request.create', 'quote.convert')),
  constraint commerce_idempotency_hashes_check check (key_hash ~ '^[0-9a-f]{64}$' and request_hash ~ '^[0-9a-f]{64}$'),
  constraint commerce_idempotency_resource_check check (resource_type in ('order', 'quote_request')),
  constraint commerce_idempotency_expiry_check check (expires_at > created_at)
);

create function dpg_v1.validate_category_tree()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  parent_row dpg_v1.categories%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'CATEGORY_CYCLE';
  end if;
  select * into parent_row from dpg_v1.categories where id = new.parent_id;
  if not found or not parent_row.is_active or parent_row.is_leaf or parent_row.sector <> new.sector then
    raise exception 'INVALID_CATEGORY_PARENT';
  end if;
  if tg_op = 'UPDATE' and exists (
    with recursive descendants(id) as (
      select id from dpg_v1.categories where parent_id = new.id
      union all
      select c.id from dpg_v1.categories c join descendants d on c.parent_id = d.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'CATEGORY_CYCLE';
  end if;
  if new.is_leaf and exists (select 1 from dpg_v1.categories where parent_id = new.id) then
    raise exception 'LEAF_CATEGORY_CANNOT_HAVE_CHILDREN';
  end if;
  if tg_op = 'UPDATE' and (not new.is_leaf or not new.is_active)
     and exists (select 1 from dpg_v1.products where primary_category_id = new.id) then
    raise exception 'ASSIGNED_PRIMARY_CATEGORY_MUST_REMAIN_ACTIVE_LEAF';
  end if;
  return new;
end
$$;

create trigger categories_validate_tree
before insert or update on dpg_v1.categories
for each row execute function dpg_v1.validate_category_tree();

create function dpg_v1.validate_attribute_option()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare definition_type dpg_v1.attribute_value_type;
begin
  select value_type into definition_type from dpg_v1.attribute_definitions where id = new.attribute_definition_id;
  if definition_type not in ('enum', 'multi_enum') then
    raise exception 'ATTRIBUTE_OPTIONS_REQUIRE_ENUM_DEFINITION';
  end if;
  return new;
end
$$;

create trigger attribute_options_validate_definition
before insert or update on dpg_v1.attribute_options
for each row execute function dpg_v1.validate_attribute_option();

create function dpg_v1.validate_category_attribute_policy()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare category_leaf boolean; definition_type dpg_v1.attribute_value_type;
begin
  select is_leaf and is_active into category_leaf from dpg_v1.categories where id = new.category_id;
  select value_type into definition_type from dpg_v1.attribute_definitions where id = new.attribute_definition_id;
  if category_leaf is distinct from true then raise exception 'ATTRIBUTE_POLICY_REQUIRES_ACTIVE_LEAF_CATEGORY'; end if;
  if new.filterable and definition_type = 'text' then raise exception 'TEXT_ATTRIBUTE_NOT_FILTERABLE_BY_DEFAULT'; end if;
  return new;
end
$$;

create trigger category_attribute_policies_validate
before insert or update on dpg_v1.category_attribute_policies
for each row execute function dpg_v1.validate_category_attribute_policy();

create function dpg_v1.validate_product_attribute_value()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  definition dpg_v1.attribute_definitions%rowtype;
  product_category uuid;
  populated integer;
begin
  select * into definition from dpg_v1.attribute_definitions where id = new.attribute_definition_id;
  select primary_category_id into product_category from dpg_v1.products where id = new.product_id;
  if not exists (
    select 1 from dpg_v1.category_attribute_policies
    where category_id = product_category and attribute_definition_id = new.attribute_definition_id
  ) then raise exception 'ATTRIBUTE_NOT_ALLOWED_FOR_PRODUCT_CATEGORY'; end if;
  populated := num_nonnulls(new.text_value, new.number_value, new.boolean_value, new.option_id);
  if (definition.value_type = 'text' and not (populated = 1 and new.text_value is not null))
    or (definition.value_type = 'number' and not (populated = 1 and new.number_value is not null))
    or (definition.value_type = 'boolean' and not (populated = 1 and new.boolean_value is not null))
    or (definition.value_type = 'enum' and not (populated = 1 and new.option_id is not null))
    or (definition.value_type = 'multi_enum' and populated <> 0)
  then raise exception 'ATTRIBUTE_TYPED_VALUE_MISMATCH'; end if;
  if definition.value_type = 'number' and (
    (definition.number_min is not null and new.number_value < definition.number_min)
    or (definition.number_max is not null and new.number_value > definition.number_max)
  ) then raise exception 'ATTRIBUTE_NUMBER_OUT_OF_RANGE'; end if;
  if definition.value_type = 'text' and definition.validation_pattern is not null
     and new.text_value !~ definition.validation_pattern then
    raise exception 'ATTRIBUTE_TEXT_PATTERN_MISMATCH';
  end if;
  return new;
end
$$;

create trigger product_attribute_values_validate
before insert or update on dpg_v1.product_attribute_values
for each row execute function dpg_v1.validate_product_attribute_value();

create function dpg_v1.validate_product_multi_option()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
begin
  if not exists (
    select 1 from dpg_v1.attribute_definitions
    where id = new.attribute_definition_id and value_type = 'multi_enum'
  ) then raise exception 'MULTI_OPTION_REQUIRES_MULTI_ENUM'; end if;
  return new;
end
$$;

create trigger product_attribute_multi_options_validate
before insert or update on dpg_v1.product_attribute_multi_options
for each row execute function dpg_v1.validate_product_multi_option();

create function dpg_v1.validate_product_media_asset()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
begin
  if not exists (select 1 from dpg_v1.media_assets where id = new.media_asset_id and kind = 'IMAGE' and state = 'READY') then
    raise exception 'PRODUCT_MEDIA_REQUIRES_READY_IMAGE';
  end if;
  return new;
end
$$;

create trigger product_media_validate_asset
before insert or update on dpg_v1.product_media
for each row execute function dpg_v1.validate_product_media_asset();

create function dpg_v1.validate_product_document_asset()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
begin
  if not exists (select 1 from dpg_v1.media_assets where id = new.media_asset_id and kind = 'DOCUMENT' and state = 'READY') then
    raise exception 'PRODUCT_DOCUMENT_REQUIRES_READY_DOCUMENT';
  end if;
  return new;
end
$$;

create trigger product_documents_validate_asset
before insert or update on dpg_v1.product_documents
for each row execute function dpg_v1.validate_product_document_asset();

create function dpg_v1.content_block_payload_valid(p_type dpg_v1.content_block_type, p_payload jsonb)
returns boolean
language sql
immutable
strict
security invoker
set search_path = pg_catalog
as $$
  select jsonb_typeof(p_payload) = 'object' and case p_type
    when 'RICH_TEXT' then jsonb_typeof(p_payload->'html') = 'string'
      and (p_payload - 'html') = '{}'::jsonb
    when 'HEADING' then jsonb_typeof(p_payload->'text') = 'string'
      and jsonb_typeof(p_payload->'level') = 'number'
      and (p_payload->>'level')::integer between 2 and 4
      and (p_payload - 'text' - 'level') = '{}'::jsonb
    when 'MEDIA' then (not (p_payload ? 'caption') or jsonb_typeof(p_payload->'caption') in ('string', 'null'))
      and (p_payload - 'caption') = '{}'::jsonb
    when 'QUOTE_CALLOUT' then jsonb_typeof(p_payload->'text') = 'string'
      and (p_payload - 'text' - 'attribution') = '{}'::jsonb
    when 'PRODUCT_GRID' then (p_payload - 'layout' - 'heading') = '{}'::jsonb
    when 'CATEGORY_LINKS' then (p_payload - 'layout' - 'heading') = '{}'::jsonb
    when 'BRAND_LINKS' then (p_payload - 'layout' - 'heading') = '{}'::jsonb
    when 'CTA' then jsonb_typeof(p_payload->'label') = 'string' and jsonb_typeof(p_payload->'href') = 'string'
      and (p_payload - 'label' - 'href') = '{}'::jsonb
    when 'SPECIFICATIONS_TABLE' then (not (p_payload ? 'heading') or jsonb_typeof(p_payload->'heading') in ('string', 'null'))
      and (p_payload - 'heading') = '{}'::jsonb
    else false
  end
$$;

alter table dpg_v1.content_blocks
  add constraint content_blocks_payload_schema_check
  check (dpg_v1.content_block_payload_valid(block_type, payload));

create function dpg_v1.validate_content_block_media()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
begin
  if new.block_type = 'MEDIA' and not exists (
    select 1 from dpg_v1.media_assets
    where id = new.media_asset_id and kind = 'IMAGE' and state = 'READY'
  ) then raise exception 'CONTENT_MEDIA_REQUIRES_READY_IMAGE'; end if;
  return new;
end
$$;

create trigger content_blocks_validate_media
before insert or update on dpg_v1.content_blocks
for each row execute function dpg_v1.validate_content_block_media();

create function dpg_v1.product_publication_failures(p_product_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1
as $$
  select array_remove(array[
    case when p.brand_id is null or not b.is_active then 'BRAND' end,
    case when p.primary_category_id is null or not c.is_active or not c.is_leaf then 'PRIMARY_LEAF_CATEGORY' end,
    case when p.retail_price is null or p.retail_price <= 0 then 'PUBLIC_PRICE' end,
    case when p.availability = 'DISCONTINUED' then 'AVAILABILITY' end,
    case when p.unresolved_critical_conflict then 'CRITICAL_CONFLICT' end,
    case when not exists (
      select 1 from dpg_v1.product_media pm join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
      where pm.product_id = p.id and pm.role = 'PRIMARY' and ma.kind = 'IMAGE' and ma.state = 'READY'
    ) then 'PRIMARY_IMAGE' end,
    case when not exists (
      select 1 from dpg_v1.product_source_provenance sp
      where sp.product_id = p.id
        and (
          (c.sector = 'sanitary' and sp.source_kind = 'manufacturer' and sp.quality = 'official')
          or (c.sector <> 'sanitary' and sp.quality in ('official', 'verified'))
        )
    ) then 'PROVENANCE' end,
    case when exists (
      select 1 from dpg_v1.category_attribute_policies cap
      where cap.category_id = p.primary_category_id and cap.requirement_tier <> 'none'
        and not exists (
          select 1 from dpg_v1.product_attribute_values pav
          where pav.product_id = p.id and pav.attribute_definition_id = cap.attribute_definition_id
            and pav.quality in ('official', 'verified')
            and exists (
              select 1 from dpg_v1.product_source_provenance sp
              where sp.id = pav.source_provenance_id and sp.product_id = p.id
                and (
                  (c.sector <> 'sanitary' or cap.requirement_tier <> 'deep')
                  or (pav.quality = 'official' and sp.source_kind = 'manufacturer' and sp.quality = 'official')
                )
            )
            and (exists (
              select 1 from dpg_v1.attribute_definitions ad
              where ad.id = pav.attribute_definition_id and ad.value_type <> 'multi_enum'
            ) or exists (
              select 1 from dpg_v1.product_attribute_multi_options pamo
              where pamo.product_attribute_value_id = pav.id
            ))
        )
    ) then 'REQUIRED_ATTRIBUTES' end
  ], null)
  from dpg_v1.products p
  left join dpg_v1.brands b on b.id = p.brand_id
  left join dpg_v1.categories c on c.id = p.primary_category_id
  where p.id = p_product_id
$$;

create view dpg_v1.product_publication_eligibility
with (security_invoker = true)
as
select p.id as product_id,
       cardinality(dpg_v1.product_publication_failures(p.id)) = 0 as eligible,
       dpg_v1.product_publication_failures(p.id) as failures
from dpg_v1.products p;

create function dpg_v1.enforce_product_publication()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare failures text[];
begin
  if not exists (
    select 1 from dpg_v1.categories
    where id = new.primary_category_id and is_active and is_leaf
  ) then
    raise exception 'PRODUCT_REQUIRES_ACTIVE_PRIMARY_LEAF_CATEGORY';
  end if;
  if exists (
    select 1 from dpg_v1.product_attribute_values pav
    where pav.product_id = new.id
      and not exists (
        select 1 from dpg_v1.category_attribute_policies cap
        where cap.category_id = new.primary_category_id
          and cap.attribute_definition_id = pav.attribute_definition_id
      )
  ) then
    raise exception 'PRODUCT_CATEGORY_ATTRIBUTE_MISMATCH';
  end if;
  if new.status = 'PUBLISHED' then
    if tg_op = 'INSERT' then
      raise exception 'PRODUCT_MUST_BE_DRAFT_BEFORE_PUBLICATION';
    end if;
    failures := dpg_v1.product_publication_failures(new.id);
    if cardinality(failures) <> 0 then
      raise exception 'PRODUCT_NOT_PUBLISHABLE:%', array_to_string(failures, ',');
    end if;
  end if;
  return new;
end
$$;

create trigger products_enforce_publication
before insert or update on dpg_v1.products
for each row execute function dpg_v1.enforce_product_publication();

create function dpg_v1.prevent_immutable_snapshot_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'IMMUTABLE_COMMERCIAL_SNAPSHOT';
end
$$;

create function dpg_v1.guard_immutable_line_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.product_id is not null and new.product_id is null then
    return new;
  end if;
  raise exception 'IMMUTABLE_COMMERCIAL_SNAPSHOT';
end
$$;

create trigger quote_requests_immutable
before update or delete on dpg_v1.quote_requests
for each row execute function dpg_v1.prevent_immutable_snapshot_change();
create trigger quote_request_lines_immutable
before update or delete on dpg_v1.quote_request_lines
for each row execute function dpg_v1.guard_immutable_line_snapshot();
create trigger order_lines_immutable
before update or delete on dpg_v1.order_lines
for each row execute function dpg_v1.guard_immutable_line_snapshot();
create trigger payment_transactions_immutable
before update or delete on dpg_v1.payment_transactions
for each row execute function dpg_v1.prevent_immutable_snapshot_change();

create function dpg_v1.guard_quote_header_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' or old.status in ('CONVERTED', 'CANCELLED', 'EXPIRED') then
    raise exception 'QUOTE_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end
$$;

create trigger quotes_guard_terminal_mutation
before update or delete on dpg_v1.quotes
for each row execute function dpg_v1.guard_quote_header_mutation();

create function dpg_v1.guard_quote_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare parent_status dpg_v1.quote_status;
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.product_id is not null and new.product_id is null then
    return new;
  end if;
  select status into parent_status from dpg_v1.quotes where id = coalesce(new.quote_id, old.quote_id);
  if parent_status not in ('DRAFT', 'ISSUED') then raise exception 'QUOTE_SNAPSHOT_IMMUTABLE'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger quote_lines_guard_mutation
before insert or update or delete on dpg_v1.quote_lines
for each row execute function dpg_v1.guard_quote_mutation();

create function dpg_v1.guard_order_snapshot_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if (to_jsonb(new) - array['status', 'payment_status', 'paid_amount', 'refunded_amount', 'updated_at', 'updated_by'])
     <> (to_jsonb(old) - array['status', 'payment_status', 'paid_amount', 'refunded_amount', 'updated_at', 'updated_by']) then
    raise exception 'ORDER_COMMERCIAL_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end
$$;

create trigger orders_guard_commercial_snapshot
before update on dpg_v1.orders
for each row execute function dpg_v1.guard_order_snapshot_update();

create function dpg_v1.validate_order_payment_projection()
returns trigger
language plpgsql
security invoker
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

create trigger orders_validate_payment_projection
before insert or update of payment_status, paid_amount, refunded_amount on dpg_v1.orders
for each row execute function dpg_v1.validate_order_payment_projection();

create function dpg_v1.validate_order_line_totals()
returns trigger
language plpgsql
security invoker
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

create function dpg_v1.validate_order_header_line_totals()
returns trigger
language plpgsql
security invoker
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

create constraint trigger orders_validate_line_totals
after insert or update on dpg_v1.orders
deferrable initially deferred
for each row execute function dpg_v1.validate_order_header_line_totals();

create constraint trigger order_lines_validate_totals
after insert or update or delete on dpg_v1.order_lines
deferrable initially deferred
for each row execute function dpg_v1.validate_order_line_totals();

create function dpg_v1.maintain_payment_projection()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  target_order uuid := coalesce(new.order_id, old.order_id);
  paid numeric(15,2);
  refunded numeric(15,2);
  order_total numeric(15,2);
  projected dpg_v1.payment_status;
begin
  select coalesce(sum(amount) filter (where transaction_type = 'PAYMENT'), 0),
         coalesce(sum(amount) filter (where transaction_type = 'REFUND'), 0)
    into paid, refunded
  from dpg_v1.payment_transactions where order_id = target_order;
  select total into order_total from dpg_v1.orders where id = target_order for update;
  if refunded > paid then raise exception 'REFUND_EXCEEDS_PAID_AMOUNT'; end if;
  projected := case
    when refunded > 0 then 'REFUNDED'::dpg_v1.payment_status
    when paid = 0 then 'UNPAID'::dpg_v1.payment_status
    when paid < order_total then 'PARTIALLY_PAID'::dpg_v1.payment_status
    else 'PAID'::dpg_v1.payment_status
  end;
  update dpg_v1.orders set paid_amount = paid, refunded_amount = refunded,
    payment_status = projected, updated_at = clock_timestamp()
  where id = target_order;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger payment_transactions_maintain_projection
after insert or update or delete on dpg_v1.payment_transactions
for each row execute function dpg_v1.maintain_payment_projection();

create function dpg_v1.convert_quote_to_order(
  p_quote_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  locked_quote dpg_v1.quotes%rowtype;
  v_key_hash char(64);
  v_request_hash char(64);
  existing_idempotency dpg_v1.commerce_idempotency_records%rowtype;
  order_id uuid;
  computed_subtotal numeric(15,2);
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_key_hash := encode(sha256(convert_to(btrim(p_idempotency_key), 'UTF8')), 'hex');
  v_request_hash := encode(sha256(convert_to(
    jsonb_build_object('quote_id', p_quote_id, 'expected_version', p_expected_version)::text, 'UTF8'
  )), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('leo561:quote:' || p_quote_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('leo561:quote.convert:' || v_key_hash, 0));

  select * into existing_idempotency
  from dpg_v1.commerce_idempotency_records
  where operation = 'quote.convert' and key_hash = v_key_hash
  for update;
  if found then
    if existing_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if existing_idempotency.resource_id is null then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return existing_idempotency.resource_id;
  end if;

  select * into locked_quote from dpg_v1.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if locked_quote.status = 'CONVERTED' then return locked_quote.converted_order_id; end if;
  if locked_quote.status <> 'ISSUED' then raise exception 'QUOTE_NOT_ISSUED'; end if;
  if locked_quote.version <> p_expected_version then raise exception 'STALE_QUOTE_VERSION'; end if;
  if locked_quote.expires_at is not null and locked_quote.expires_at <= clock_timestamp() then raise exception 'QUOTE_EXPIRED'; end if;
  select sum(line_total) into computed_subtotal from dpg_v1.quote_lines where quote_id = p_quote_id;
  if computed_subtotal is null or computed_subtotal <> locked_quote.subtotal then raise exception 'QUOTE_TOTAL_MISMATCH'; end if;

  insert into dpg_v1.commerce_idempotency_records (
    operation, key_hash, request_hash, resource_type, resource_id, safe_response, expires_at
  ) values ('quote.convert', v_key_hash, v_request_hash, 'order', null, null, clock_timestamp() + interval '24 hours');

  order_id := gen_random_uuid();
  insert into dpg_v1.orders (
    id, order_number, source, source_quote_id, status, payment_method, payment_status,
    customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot,
    public_note, subtotal, shipping_fee, discount_total, total
  ) values (
    order_id, 'O-' || upper(replace(order_id::text, '-', '')), 'QUOTE', locked_quote.id,
    'NEW', 'BANK_TRANSFER', 'UNPAID', locked_quote.customer_name_snapshot,
    locked_quote.customer_phone_snapshot, locked_quote.customer_email_snapshot,
    locked_quote.public_note, locked_quote.subtotal, locked_quote.shipping_fee,
    locked_quote.discount_total, locked_quote.total
  );

  insert into dpg_v1.order_lines (
    order_id, product_id, sort_order, product_sku_snapshot, product_model_snapshot,
    product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
    availability_snapshot, quantity, unit_price, line_discount, public_note, snapshot_at
  )
  select order_id, product_id, sort_order, product_sku_snapshot, product_model_snapshot,
    product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
    availability_snapshot, quantity, unit_price, line_discount, public_note, clock_timestamp()
  from dpg_v1.quote_lines where quote_id = p_quote_id order by sort_order;

  update dpg_v1.quotes set status = 'CONVERTED', converted_order_id = order_id,
    converted_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
  where id = p_quote_id;
  update dpg_v1.commerce_idempotency_records
    set resource_id = order_id, safe_response = jsonb_build_object('order_id', order_id)
  where operation = 'quote.convert' and key_hash = v_key_hash;
  return order_id;
end
$$;

revoke all on function dpg_v1.convert_quote_to_order(uuid, integer, text) from public;

-- Private canonical tables are closed by default. LEO-564 will add exact
-- policies and grants; enabling/forcing RLS here is the minimal schema
-- prerequisite and deliberately exposes no usable application path.
do $rls$
declare table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'dpg_v1' order by tablename
  loop
    execute format('alter table dpg_v1.%I enable row level security', table_name);
    execute format('alter table dpg_v1.%I force row level security', table_name);
    execute format('revoke all on table dpg_v1.%I from public', table_name);
  end loop;
end
$rls$;

comment on schema dpg_v1 is 'Canonical Dong Phu Gia V1 authority; legacy schemas are migration evidence only';
comment on table dpg_v1.products is 'One manufacturer model, one sellable Product, one PDP';
comment on table dpg_v1.product_families is 'Optional related-Product grouping; never commerce or PDP authority';
comment on table dpg_v1.quote_requests is 'Immutable customer-submitted request; distinct from negotiated Quote';
comment on table dpg_v1.order_lines is 'Immutable commercial snapshot; Product FK is navigation only';
