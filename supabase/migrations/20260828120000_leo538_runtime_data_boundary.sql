-- LEO-538: authorize the approved reduced Production-derived runtime dataset
-- while preserving the isolated LEO-539 target, credential, write, and budget
-- boundaries. No Production credential is accepted by this target contract.

alter table dpg_control.target_contract
  drop constraint target_contract_data_class_check,
  drop constraint target_contract_production_data_allowed_check;

update dpg_control.target_contract
set data_class = 'production-derived-reduced-runtime',
    production_data_allowed = true;

alter table dpg_control.target_contract
  add constraint target_contract_data_class_check
    check (data_class = 'production-derived-reduced-runtime'),
  add constraint target_contract_production_data_allowed_check
    check (production_data_allowed);

do $ownership$
declare
  object_name text;
begin
  for object_name in
    select tablename from pg_tables
    where schemaname = 'dpg_app' and tablename <> 'leo539_rls_probe'
    order by tablename
  loop
    execute format('alter table dpg_app.%I owner to dpg_migration', object_name);
  end loop;

  for object_name in
    select sequencename from pg_sequences
    where schemaname = 'dpg_app'
    order by sequencename
  loop
    execute format('alter sequence dpg_app.%I owner to dpg_migration', object_name);
  end loop;
end
$ownership$;

create or replace function dpg_control.enforce_free_tier_headroom_statement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if pg_database_size(current_database()) > 367001600 then
    raise exception 'LEO-538 free-tier hard stop: database size exceeds 350 MiB';
  end if;
  return null;
end;
$$;

alter function dpg_control.enforce_free_tier_headroom_statement() owner to dpg_migration;
revoke execute on function dpg_control.enforce_free_tier_headroom_statement()
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;

do $retained_boundary$
declare
  table_name text;
  retained_tables constant text[] := array[
    'admin_users', 'banners', 'blog_categories', 'blog_post_tags',
    'blog_posts', 'blog_tags', 'brands', 'catalog_taxons', 'categories',
    'colors', 'customers', 'external_taxonomy_mappings',
    'filter_definitions', 'materials', 'order_items', 'orders', 'origins',
    'partners', 'product_attribute_values', 'product_descriptions',
    'product_documents', 'product_feature_values', 'product_features',
    'product_images', 'product_package_items', 'product_relationships',
    'product_secondary_subcategories', 'product_source_mappings',
    'product_spec_values', 'product_sub_types', 'product_taxon_assignments',
    'product_types', 'product_variant_groups', 'products', 'projects',
    'publishing_blog_post_media', 'publishing_global_controls',
    'publishing_identity_capabilities', 'publishing_identity_ip_allowlist',
    'publishing_machine_identities', 'publishing_managed_media',
    'publishing_scheduler_state', 'quote_items', 'quote_requests', 'redirects',
    'spec_definitions', 'spec_options', 'subcategories'
  ];
begin
  foreach table_name in array retained_tables
  loop
    execute format('revoke all on table dpg_app.%I from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly', table_name);
    execute format('grant select on table dpg_app.%I to dpg_runtime, dpg_readonly', table_name);
    execute format('alter table dpg_app.%I enable row level security', table_name);
    execute format('alter table dpg_app.%I force row level security', table_name);
    execute format('create policy leo538_runtime_select on dpg_app.%I for select to dpg_runtime, dpg_readonly using (true)', table_name);
    execute format('create trigger leo538_free_tier_headroom after insert or update on dpg_app.%I for each statement execute function dpg_control.enforce_free_tier_headroom_statement()', table_name);
  end loop;
end
$retained_boundary$;

create table dpg_control.leo538_restore_manifest (
  table_name text primary key,
  row_count bigint not null check (row_count >= 0),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  source_authority text not null check (
    source_authority in ('codex_production_readonly', 'owner-blog-readonly')
  )
);

alter table dpg_control.leo538_restore_manifest owner to dpg_migration;
alter table dpg_control.leo538_restore_manifest enable row level security;
alter table dpg_control.leo538_restore_manifest force row level security;
revoke all on table dpg_control.leo538_restore_manifest
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant select on table dpg_control.leo538_restore_manifest to dpg_readonly;

create policy leo538_manifest_read
on dpg_control.leo538_restore_manifest
for select to dpg_migration, dpg_readonly
using (true);
