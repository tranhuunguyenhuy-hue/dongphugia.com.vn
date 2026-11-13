-- Server-only legacy Admin role for the enabled login, Products, and Blog Posts
-- routes. This is additive to the existing Public/runtime read policies.
-- No password is embedded here; any deployment credential must be managed
-- separately in the server environment and must never be exposed to a browser.
--
-- Preflight is fail-closed: the selected dpg_app schema, the observed forced-RLS
-- state, existing dpg_runtime read policies, and nullable component_skus must
-- match the reviewed target before any role or grants are created.
BEGIN;

DO $preflight$
DECLARE
  v_table text;
  v_rel oid;
  v_rls_tables text[] := ARRAY[
    'admin_users',
    'blog_categories', 'blog_post_tags', 'blog_posts', 'blog_tags',
    'brands', 'catalog_taxons', 'categories', 'colors', 'filter_definitions',
    'materials', 'origins', 'product_documents', 'product_feature_values',
    'product_features', 'product_images', 'product_relationships',
    'product_spec_values', 'product_sub_types', 'product_taxon_assignments',
    'product_types', 'publishing_machine_identities', 'publishing_managed_media',
    'spec_definitions', 'spec_options', 'subcategories', 'products'
  ];
  v_non_rls_tables text[] := ARRAY[
    'admin_sessions', 'audit_logs', 'publishing_audit_events'
  ];
BEGIN
  IF to_regnamespace('dpg_app') IS NULL THEN
    RAISE EXCEPTION 'Expected schema dpg_app is missing';
  END IF;

  FOREACH v_table IN ARRAY v_rls_tables LOOP
    v_rel := to_regclass(format('%I.%I', 'dpg_app', v_table));
    IF v_rel IS NULL THEN
      RAISE EXCEPTION 'Required Admin route table dpg_app.% is missing', v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c WHERE c.oid = v_rel
        AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'Expected ENABLE and FORCE ROW LEVEL SECURITY on dpg_app.%', v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'dpg_app'
        AND p.tablename = v_table
        AND p.policyname = 'leo538_runtime_select'
        AND p.cmd = 'SELECT'
        AND p.qual = 'true'
        AND 'dpg_runtime' = ANY(p.roles)
        AND 'dpg_readonly' = ANY(p.roles)
    ) THEN
      RAISE EXCEPTION 'Expected existing dpg_runtime read policy on dpg_app.%', v_table;
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY v_non_rls_tables LOOP
    v_rel := to_regclass(format('%I.%I', 'dpg_app', v_table));
    IF v_rel IS NULL THEN
      RAISE EXCEPTION 'Required Admin route table dpg_app.% is missing', v_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c WHERE c.oid = v_rel
        AND (c.relrowsecurity OR c.relforcerowsecurity)
    ) THEN
      RAISE EXCEPTION 'Expected RLS to remain disabled on dpg_app.%', v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'dpg_app' AND table_name = 'products'
      AND column_name = 'component_skus' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Expected nullable dpg_app.products.component_skus; no data rewrite is permitted';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'admin_sessions', 'audit_logs', 'blog_posts', 'product_images',
    'product_relationships', 'product_taxon_assignments', 'products',
    'publishing_audit_events'
  ] LOOP
    IF pg_get_serial_sequence(format('%I.%I', 'dpg_app', v_table), 'id') IS NULL THEN
      RAISE EXCEPTION 'Expected serial id sequence for dpg_app.%', v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'dpg_app' AND p.tablename = 'products'
      AND p.policyname = 'leo541_products_select_public'
      AND p.cmd = 'SELECT' AND 'authenticated' = ANY(p.roles)
  ) THEN
    RAISE EXCEPTION 'Expected existing Public product read policy; refusing to alter Public access';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_admin_runtime_login') THEN
    RAISE EXCEPTION 'dpg_admin_runtime_login already exists; inspect its ownership/grants before applying this migration';
  END IF;
END
$preflight$;

DO $create_role$
BEGIN
  CREATE ROLE dpg_admin_runtime_login
    LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
END
$create_role$;

GRANT USAGE ON SCHEMA dpg_app TO dpg_admin_runtime_login;

-- Product and Blog route data. INSERT/UPDATE are column-scoped where fields
-- outside the old editor's contract must remain protected. Prisma emits
-- model defaults such as source metadata on create; these default columns are
-- insert-only and do not grant permission to rewrite existing provenance.
GRANT SELECT, DELETE ON TABLE dpg_app.products TO dpg_admin_runtime_login;
GRANT INSERT (
  sku, name, display_name, slug, category_id, subcategory_id, brand_id,
  origin_id, color_id, material_id, price, original_price, list_price,
  sale_price, online_discount_amount, price_display, description, features,
  specs, warranty_months, image_main_url, stock_status, is_active,
  is_featured, is_home_featured, is_promotion, is_combo, is_master, sort_order,
  product_type, product_sub_type, source_url, hita_product_id, seo_title,
  seo_description, created_at, updated_at, component_skus, variant_options,
  publication_status, pdp_visibility, listing_visibility, search_visibility,
  listing_tier, listing_priority, data_quality_score, sale_status, price_state,
  price_source, price_confidence, sellable_status, seo_indexing, sitemap_include,
  source_system, source_confidence, crawl_status
) ON TABLE dpg_app.products TO dpg_admin_runtime_login;
GRANT UPDATE (
  sku, name, display_name, slug, category_id, subcategory_id, brand_id,
  origin_id, color_id, material_id, price, original_price, list_price,
  sale_price, online_discount_amount, price_display, description, features,
  specs, warranty_months, image_main_url, stock_status, is_active,
  is_featured, is_home_featured, is_promotion, is_combo, is_master, sort_order,
  product_type, product_sub_type, product_type_id, product_sub_type_id,
  source_url, hita_product_id, seo_title, seo_description, publication_status,
  pdp_visibility, listing_visibility, search_visibility, sellable_status,
  seo_indexing, sitemap_include, variant_group, updated_at
) ON TABLE dpg_app.products TO dpg_admin_runtime_login;

GRANT SELECT, DELETE ON TABLE dpg_app.product_images TO dpg_admin_runtime_login;
GRANT INSERT (product_id, image_url, alt_text, image_type, sort_order, created_at)
  ON TABLE dpg_app.product_images TO dpg_admin_runtime_login;
GRANT UPDATE (sort_order) ON TABLE dpg_app.product_images TO dpg_admin_runtime_login;

GRANT SELECT, DELETE ON TABLE dpg_app.product_relationships TO dpg_admin_runtime_login;
GRANT INSERT (
  parent_id, child_id, child_sku, relationship_type, sort_order, created_at,
  component_type, resolution_status
)
  ON TABLE dpg_app.product_relationships TO dpg_admin_runtime_login;

GRANT SELECT, DELETE ON TABLE dpg_app.product_taxon_assignments TO dpg_admin_runtime_login;
GRANT INSERT (product_id, taxon_id, is_primary, role, sort_order, source, confidence, metadata, created_at, updated_at)
  ON TABLE dpg_app.product_taxon_assignments TO dpg_admin_runtime_login;

GRANT SELECT, DELETE ON TABLE dpg_app.blog_posts TO dpg_admin_runtime_login;
GRANT INSERT (
  title, slug, excerpt, content, category_id, thumbnail_url, cover_image_url,
  seo_title, seo_description, seo_keywords, reading_time, status, published_at,
  first_published_at, author_name, author_avatar, is_featured, is_pinned,
  created_at, updated_at, view_count, version
) ON TABLE dpg_app.blog_posts TO dpg_admin_runtime_login;
GRANT UPDATE (
  title, slug, excerpt, content, category_id, thumbnail_url, cover_image_url,
  seo_title, seo_description, seo_keywords, reading_time, status, published_at,
  first_published_at, scheduled_for, scheduled_timezone, scheduled_version,
  schedule_blocked_code, schedule_blocked_at, schedule_last_attempt_at,
  author_name, author_avatar, is_featured, is_pinned, version, updated_at
) ON TABLE dpg_app.blog_posts TO dpg_admin_runtime_login;

GRANT SELECT, DELETE ON TABLE dpg_app.blog_post_tags TO dpg_admin_runtime_login;
GRANT INSERT (post_id, tag_id) ON TABLE dpg_app.blog_post_tags TO dpg_admin_runtime_login;
GRANT SELECT ON TABLE dpg_app.blog_tags TO dpg_admin_runtime_login;
GRANT UPDATE (post_count) ON TABLE dpg_app.blog_tags TO dpg_admin_runtime_login;

-- Read-only reference and editor-detail tables used by the mounted forms.
GRANT SELECT ON TABLE
  dpg_app.blog_categories,
  dpg_app.brands,
  dpg_app.catalog_taxons,
  dpg_app.categories,
  dpg_app.colors,
  dpg_app.filter_definitions,
  dpg_app.materials,
  dpg_app.origins,
  dpg_app.product_documents,
  dpg_app.product_feature_values,
  dpg_app.product_features,
  dpg_app.product_spec_values,
  dpg_app.product_sub_types,
  dpg_app.product_types,
  dpg_app.spec_definitions,
  dpg_app.spec_options,
  dpg_app.subcategories
TO dpg_admin_runtime_login;

-- Login and request identity. Explicit source selects keep session/token and
-- staff rows narrow; last_login_at is the only admin_users write.
GRANT SELECT (id, email, username, name, role, password_hash, is_active, avatar_url)
  ON TABLE dpg_app.admin_users TO dpg_admin_runtime_login;
GRANT UPDATE (last_login_at) ON TABLE dpg_app.admin_users TO dpg_admin_runtime_login;
GRANT SELECT (id, user_id, token_hash, expires_at)
  ON TABLE dpg_app.admin_sessions TO dpg_admin_runtime_login;
GRANT INSERT (user_id, token_hash, ip_address, user_agent, expires_at, created_at)
  ON TABLE dpg_app.admin_sessions TO dpg_admin_runtime_login;
GRANT DELETE ON TABLE dpg_app.admin_sessions TO dpg_admin_runtime_login;

-- Append-only audit access; SELECT(id) is only for Prisma's explicit RETURNING.
GRANT SELECT (id) ON TABLE dpg_app.audit_logs TO dpg_admin_runtime_login;
GRANT INSERT (user_id, action, entity_type, entity_id, new_value, created_at)
  ON TABLE dpg_app.audit_logs TO dpg_admin_runtime_login;
GRANT SELECT (id) ON TABLE dpg_app.publishing_audit_events TO dpg_admin_runtime_login;
GRANT INSERT (
  actor_kind, identity_id, admin_actor_id, sponsor_user_id, action, post_id,
  external_id, request_id, idempotency_key_hash, from_version, to_version,
  from_state, to_state, changed_fields, content_hash, metadata, created_at
) ON TABLE dpg_app.publishing_audit_events TO dpg_admin_runtime_login;

-- Media normalization and linked Blog-post audits are read/append only.
GRANT SELECT (id, purpose, status, primary_url, identity_id)
  ON TABLE dpg_app.publishing_managed_media TO dpg_admin_runtime_login;
GRANT SELECT (id, is_active, sponsor_user_id)
  ON TABLE dpg_app.publishing_machine_identities TO dpg_admin_runtime_login;

-- Only sequences actually consumed by the enabled auth/Product/Blog actions.
GRANT USAGE ON SEQUENCE
  dpg_app.admin_sessions_id_seq,
  dpg_app.audit_logs_id_seq,
  dpg_app.blog_posts_id_seq,
  dpg_app.product_images_id_seq,
  dpg_app.product_relationships_id_seq,
  dpg_app.product_taxon_assignments_id_seq,
  dpg_app.products_id_seq,
  dpg_app.publishing_audit_events_id_seq
TO dpg_admin_runtime_login;

-- Add role-specific RLS policies without changing, replacing, or broadening
-- existing Public/dpg_runtime policies or altering FORCE RLS state.
DO $select_policies$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'admin_users',
    'blog_categories', 'blog_post_tags', 'blog_posts', 'blog_tags',
    'brands', 'catalog_taxons', 'categories', 'colors', 'filter_definitions',
    'materials', 'origins', 'product_documents', 'product_feature_values',
    'product_features', 'product_images', 'product_relationships',
    'product_spec_values', 'product_sub_types', 'product_taxon_assignments',
    'product_types', 'publishing_machine_identities', 'publishing_managed_media',
    'spec_definitions', 'spec_options', 'subcategories', 'products'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'CREATE POLICY dpg_admin_runtime_select ON dpg_app.%I FOR SELECT TO dpg_admin_runtime_login USING (true)',
      v_table
    );
  END LOOP;
END
$select_policies$;

CREATE POLICY dpg_admin_runtime_update ON dpg_app.admin_users
  FOR UPDATE TO dpg_admin_runtime_login USING (true) WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_products_insert ON dpg_app.products
  FOR INSERT TO dpg_admin_runtime_login WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_products_update ON dpg_app.products
  FOR UPDATE TO dpg_admin_runtime_login USING (true) WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_products_delete ON dpg_app.products
  FOR DELETE TO dpg_admin_runtime_login USING (true);
CREATE POLICY dpg_admin_runtime_product_images_insert ON dpg_app.product_images
  FOR INSERT TO dpg_admin_runtime_login WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_product_images_update ON dpg_app.product_images
  FOR UPDATE TO dpg_admin_runtime_login USING (true) WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_product_images_delete ON dpg_app.product_images
  FOR DELETE TO dpg_admin_runtime_login USING (true);
CREATE POLICY dpg_admin_runtime_product_relationships_insert ON dpg_app.product_relationships
  FOR INSERT TO dpg_admin_runtime_login WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_product_relationships_delete ON dpg_app.product_relationships
  FOR DELETE TO dpg_admin_runtime_login USING (true);
CREATE POLICY dpg_admin_runtime_product_taxon_assignments_insert ON dpg_app.product_taxon_assignments
  FOR INSERT TO dpg_admin_runtime_login WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_product_taxon_assignments_delete ON dpg_app.product_taxon_assignments
  FOR DELETE TO dpg_admin_runtime_login USING (true);
CREATE POLICY dpg_admin_runtime_blog_posts_insert ON dpg_app.blog_posts
  FOR INSERT TO dpg_admin_runtime_login WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_blog_posts_update ON dpg_app.blog_posts
  FOR UPDATE TO dpg_admin_runtime_login USING (true) WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_blog_posts_delete ON dpg_app.blog_posts
  FOR DELETE TO dpg_admin_runtime_login USING (true);
CREATE POLICY dpg_admin_runtime_blog_post_tags_insert ON dpg_app.blog_post_tags
  FOR INSERT TO dpg_admin_runtime_login WITH CHECK (true);
CREATE POLICY dpg_admin_runtime_blog_post_tags_delete ON dpg_app.blog_post_tags
  FOR DELETE TO dpg_admin_runtime_login USING (true);
CREATE POLICY dpg_admin_runtime_blog_tags_update ON dpg_app.blog_tags
  FOR UPDATE TO dpg_admin_runtime_login USING (true) WITH CHECK (true);

-- Postflight: catch privilege drift before the migration is marked complete.
DO $postflight$
DECLARE
  v_forbidden_table text;
  v_any_table text;
  v_forbidden text[] := ARRAY[
    'orders', 'order_items', 'customers', 'quote_requests', 'quote_items',
    'partners', 'projects', 'banners', 'publishing_credentials',
    'product_source_mappings'
  ];
  v_read_only text[] := ARRAY[
    'blog_categories', 'brands', 'catalog_taxons', 'categories', 'colors',
    'filter_definitions', 'materials', 'origins', 'product_documents',
    'product_feature_values', 'product_features', 'product_spec_values',
    'product_sub_types', 'product_types', 'publishing_machine_identities',
    'publishing_managed_media', 'spec_definitions', 'spec_options', 'subcategories'
  ];
  v_allowed_seq text[] := ARRAY[
    'admin_sessions_id_seq', 'audit_logs_id_seq', 'blog_posts_id_seq',
    'product_images_id_seq', 'product_relationships_id_seq',
    'product_taxon_assignments_id_seq', 'products_id_seq',
    'publishing_audit_events_id_seq'
  ];
  v_allowed_table text[] := ARRAY[
    'admin_users', 'admin_sessions', 'audit_logs',
    'blog_categories', 'blog_post_tags', 'blog_posts', 'blog_tags',
    'brands', 'catalog_taxons', 'categories', 'colors', 'filter_definitions',
    'materials', 'origins', 'product_documents', 'product_feature_values',
    'product_features', 'product_images', 'product_relationships',
    'product_spec_values', 'product_sub_types', 'product_taxon_assignments',
    'product_types', 'products', 'publishing_audit_events',
    'publishing_machine_identities', 'publishing_managed_media',
    'spec_definitions', 'spec_options', 'subcategories'
  ];
  v_seq record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'dpg_admin_runtime_login'
      AND rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb
      AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'dpg_admin_runtime_login does not have the required least-privilege role attributes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.roleid OR r.oid = m.member
    WHERE r.rolname = 'dpg_admin_runtime_login'
  ) THEN
    RAISE EXCEPTION 'dpg_admin_runtime_login must not have or grant role membership';
  END IF;
  IF has_schema_privilege('dpg_admin_runtime_login', 'dpg_app', 'CREATE') THEN
    RAISE EXCEPTION 'dpg_admin_runtime_login must not create objects in dpg_app';
  END IF;

  IF NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_users', 'password_hash', 'SELECT')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_users', 'last_login_at', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_users', 'role', 'UPDATE')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_sessions', 'token_hash', 'SELECT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_sessions', 'ip_address', 'SELECT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_sessions', 'user_agent', 'SELECT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_sessions', 'created_at', 'SELECT')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_sessions', 'created_at', 'INSERT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.admin_sessions', 'created_at', 'UPDATE') THEN
    RAISE EXCEPTION 'Auth column privileges differ from the reviewed contract';
  END IF;
  IF NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'price', 'UPDATE')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'component_skus', 'INSERT')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'price_source', 'INSERT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'price_source', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'price_confidence', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'source_system', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'source_confidence', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'component_skus', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.products', 'created_at', 'UPDATE') THEN
    RAISE EXCEPTION 'Product update privileges differ from the reviewed editor/provenance contract';
  END IF;
  IF NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.blog_posts', 'view_count', 'INSERT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.blog_posts', 'view_count', 'UPDATE')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.blog_posts', 'version', 'INSERT')
     OR NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.blog_posts', 'version', 'UPDATE') THEN
    RAISE EXCEPTION 'Blog post create/version privileges differ from the reviewed contract';
  END IF;
  IF NOT has_column_privilege('dpg_admin_runtime_login', 'dpg_app.blog_tags', 'post_count', 'UPDATE')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.blog_tags', 'name', 'UPDATE') THEN
    RAISE EXCEPTION 'Blog tag count privileges differ from the reviewed contract';
  END IF;
  IF has_column_privilege('dpg_admin_runtime_login', 'dpg_app.audit_logs', 'action', 'SELECT')
     OR has_column_privilege('dpg_admin_runtime_login', 'dpg_app.publishing_audit_events', 'action', 'SELECT')
     OR has_table_privilege('dpg_admin_runtime_login', 'dpg_app.audit_logs', 'UPDATE')
     OR has_table_privilege('dpg_admin_runtime_login', 'dpg_app.audit_logs', 'DELETE')
     OR has_table_privilege('dpg_admin_runtime_login', 'dpg_app.publishing_audit_events', 'UPDATE')
     OR has_table_privilege('dpg_admin_runtime_login', 'dpg_app.publishing_audit_events', 'DELETE') THEN
    RAISE EXCEPTION 'Audit access must remain append-only with no history read';
  END IF;

  FOREACH v_forbidden_table IN ARRAY v_forbidden LOOP
    IF to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)) IS NOT NULL
       AND (
         has_table_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'SELECT')
         OR has_table_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'INSERT')
         OR has_table_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'UPDATE')
         OR has_table_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'DELETE')
         OR has_any_column_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'SELECT')
         OR has_any_column_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'INSERT')
         OR has_any_column_privilege('dpg_admin_runtime_login', to_regclass(format('%I.%I', 'dpg_app', v_forbidden_table)), 'UPDATE')
       ) THEN
      RAISE EXCEPTION 'dpg_admin_runtime_login unexpectedly has privileges on deferred table dpg_app.%', v_forbidden_table;
    END IF;
  END LOOP;

  FOREACH v_forbidden_table IN ARRAY v_read_only LOOP
    IF has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_forbidden_table), 'INSERT')
       OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_forbidden_table), 'UPDATE')
       OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_forbidden_table), 'DELETE')
       OR has_any_column_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_forbidden_table), 'INSERT')
       OR has_any_column_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_forbidden_table), 'UPDATE') THEN
      RAISE EXCEPTION 'dpg_admin_runtime_login has a write privilege on read-only route table dpg_app.%', v_forbidden_table;
    END IF;
  END LOOP;

  FOR v_any_table IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'dpg_app'
  LOOP
    IF NOT (v_any_table = ANY(v_allowed_table))
       AND (
         has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'SELECT')
         OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'INSERT')
         OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'UPDATE')
         OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'DELETE')
         OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'TRUNCATE')
         OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'REFERENCES')
         OR has_table_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'TRIGGER')
         OR has_any_column_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'SELECT')
         OR has_any_column_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'INSERT')
         OR has_any_column_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'UPDATE')
         OR has_any_column_privilege('dpg_admin_runtime_login', format('%I.%I', 'dpg_app', v_any_table), 'REFERENCES')
       ) THEN
      RAISE EXCEPTION 'dpg_admin_runtime_login unexpectedly has privileges on out-of-scope table dpg_app.%', v_any_table;
    END IF;
  END LOOP;

  FOR v_seq IN
    SELECT c.relname AS sequence_name, c.oid
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'dpg_app' AND c.relkind = 'S'
  LOOP
    IF NOT (v_seq.sequence_name = ANY(v_allowed_seq))
       AND has_sequence_privilege('dpg_admin_runtime_login', v_seq.oid, 'USAGE') THEN
      RAISE EXCEPTION 'Unexpected sequence USAGE on dpg_app.%', v_seq.sequence_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='dpg_app' AND p.tablename='products'
      AND p.policyname='leo541_products_select_public'
      AND p.cmd='SELECT' AND 'authenticated'=ANY(p.roles)
  ) THEN
    RAISE EXCEPTION 'Existing Public product read policy was not preserved';
  END IF;
END
$postflight$;

-- The rollback is acceptance-tested by the guarded local-only script in
-- supabase/tests/admin_runtime_role_revoke.sql; it revokes only this patch.
COMMIT;
