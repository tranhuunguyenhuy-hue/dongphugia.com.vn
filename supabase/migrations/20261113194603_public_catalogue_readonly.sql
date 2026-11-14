-- Dedicated V1 Public Worker principal. No credential is embedded here; a
-- login secret must be provisioned through the private Owner channel for Hyperdrive.
-- Public queries are constrained by both column privileges and forced RLS.

DO $m1_public_readonly_preflight$
DECLARE
  missing_tables text[];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_public_catalogue') THEN
    RAISE EXCEPTION 'M1_PUBLIC_ROLE_ALREADY_EXISTS';
  END IF;

  SELECT array_agg(required.table_name ORDER BY required.table_name)
    INTO missing_tables
  FROM unnest(ARRAY[
    'products', 'categories', 'subcategories', 'brands', 'product_images',
    'product_descriptions', 'product_spec_values', 'spec_definitions', 'spec_options',
    'product_documents', 'product_feature_values', 'product_features',
    'blog_posts', 'blog_categories'
  ]) AS required(table_name)
  WHERE to_regclass(format('dpg_app.%I', required.table_name)) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'M1_PUBLIC_SCHEMA_TABLES_MISSING: %', missing_tables;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'dpg_app'
      AND c.relname = ANY(ARRAY[
        'products', 'categories', 'subcategories', 'brands', 'product_images',
        'product_descriptions', 'product_spec_values', 'spec_definitions', 'spec_options',
        'product_documents', 'product_feature_values', 'product_features',
        'blog_posts', 'blog_categories'
      ])
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'M1_PUBLIC_RLS_MUST_BE_ENABLED_AND_FORCED';
  END IF;
END;
$m1_public_readonly_preflight$;

CREATE ROLE dpg_public_catalogue
  LOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 5;

ALTER ROLE dpg_public_catalogue SET statement_timeout = '5s';
ALTER ROLE dpg_public_catalogue SET lock_timeout = '1s';
ALTER ROLE dpg_public_catalogue SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE dpg_public_catalogue SET default_transaction_read_only = 'on';

GRANT CONNECT ON DATABASE postgres TO dpg_public_catalogue;
GRANT USAGE ON SCHEMA dpg_app TO dpg_public_catalogue;

-- Only columns read by the fixed Public query adapter receive SELECT.
GRANT SELECT (
  id, sku, name, display_name, slug, description, image_main_url, is_featured,
  variant_group, variant_type, variant_label, category_id, subcategory_id, brand_id,
  listing_priority, sort_order, is_active, publication_status, pdp_visibility,
  listing_visibility, search_visibility
) ON dpg_app.products TO dpg_public_catalogue;
GRANT SELECT (id, name, slug, is_active) ON dpg_app.categories TO dpg_public_catalogue;
GRANT SELECT (id, category_id, name, slug, is_active) ON dpg_app.subcategories TO dpg_public_catalogue;
GRANT SELECT (id, name, slug, is_active) ON dpg_app.brands TO dpg_public_catalogue;
GRANT SELECT (id, product_id, image_url, sort_order) ON dpg_app.product_images TO dpg_public_catalogue;
GRANT SELECT (id, product_id, clean_html, updated_at) ON dpg_app.product_descriptions TO dpg_public_catalogue;
GRANT SELECT (
  id, product_id, spec_definition_id, option_id, value_text, value_number, value_json,
  raw_value, sort_order
) ON dpg_app.product_spec_values TO dpg_public_catalogue;
GRANT SELECT (id, label, is_pdp_visible, sort_order) ON dpg_app.spec_definitions TO dpg_public_catalogue;
GRANT SELECT (id, spec_definition_id, value, is_active) ON dpg_app.spec_options TO dpg_public_catalogue;
GRANT SELECT (id, product_id, name, url, document_type, file_size, sort_order)
  ON dpg_app.product_documents TO dpg_public_catalogue;
GRANT SELECT (product_id, feature_id) ON dpg_app.product_feature_values TO dpg_public_catalogue;
GRANT SELECT (id, name, sort_order) ON dpg_app.product_features TO dpg_public_catalogue;
GRANT SELECT (
  id, title, slug, excerpt, content, category_id, thumbnail_url, cover_image_url,
  seo_title, seo_description, reading_time, status, published_at, author_name,
  updated_at, is_pinned
) ON dpg_app.blog_posts TO dpg_public_catalogue;
GRANT SELECT (
  id, name, slug, description, thumbnail_url, is_active, sort_order, seo_title, seo_description
) ON dpg_app.blog_categories TO dpg_public_catalogue;

-- Only the four active Public roots and valid canonical paths are visible.
CREATE POLICY dpg_public_categories_select ON dpg_app.categories
  FOR SELECT TO dpg_public_catalogue
  USING (
    is_active = true
    AND slug IN ('thiet-bi-ve-sinh', 'thiet-bi-bep', 'vat-lieu-nuoc', 'gach-op-lat')
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

CREATE POLICY dpg_public_subcategories_select ON dpg_app.subcategories
  FOR SELECT TO dpg_public_catalogue
  USING (
    is_active = true
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND EXISTS (
      SELECT 1 FROM dpg_app.categories c
      WHERE c.id = subcategories.category_id
    )
  );

CREATE POLICY dpg_public_products_select ON dpg_app.products
  FOR SELECT TO dpg_public_catalogue
  USING (
    is_active = true
    AND publication_status = 'public'
    AND pdp_visibility = 'public'
    AND id > 0
    AND name <> '' AND char_length(name) <= 240
    AND sku <> '' AND char_length(sku) <= 120
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND EXISTS (
      SELECT 1
      FROM dpg_app.categories c
      JOIN dpg_app.subcategories s ON s.category_id = c.id
      WHERE c.id = products.category_id
        AND s.id = products.subcategory_id
        AND c.slug IN ('thiet-bi-ve-sinh', 'thiet-bi-bep', 'vat-lieu-nuoc', 'gach-op-lat')
        AND c.is_active = true
        AND s.is_active = true
        AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  );

CREATE POLICY dpg_public_brands_select ON dpg_app.brands
  FOR SELECT TO dpg_public_catalogue
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM dpg_app.products p
      WHERE p.brand_id = brands.id
    )
  );

CREATE POLICY dpg_public_product_images_select ON dpg_app.product_images
  FOR SELECT TO dpg_public_catalogue
  USING (EXISTS (SELECT 1 FROM dpg_app.products p WHERE p.id = product_id));

CREATE POLICY dpg_public_product_descriptions_select ON dpg_app.product_descriptions
  FOR SELECT TO dpg_public_catalogue
  USING (EXISTS (SELECT 1 FROM dpg_app.products p WHERE p.id = product_id));

CREATE POLICY dpg_public_product_spec_values_select ON dpg_app.product_spec_values
  FOR SELECT TO dpg_public_catalogue
  USING (
    EXISTS (SELECT 1 FROM dpg_app.products p WHERE p.id = product_id)
    AND EXISTS (
      SELECT 1 FROM dpg_app.spec_definitions sd
      WHERE sd.id = product_spec_values.spec_definition_id
    )
  );

CREATE POLICY dpg_public_spec_definitions_select ON dpg_app.spec_definitions
  FOR SELECT TO dpg_public_catalogue
  USING (is_pdp_visible = true);

CREATE POLICY dpg_public_spec_options_select ON dpg_app.spec_options
  FOR SELECT TO dpg_public_catalogue
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM dpg_app.spec_definitions sd
      WHERE sd.id = spec_options.spec_definition_id
    )
  );

CREATE POLICY dpg_public_product_documents_select ON dpg_app.product_documents
  FOR SELECT TO dpg_public_catalogue
  USING (EXISTS (SELECT 1 FROM dpg_app.products p WHERE p.id = product_id));

CREATE POLICY dpg_public_product_feature_values_select ON dpg_app.product_feature_values
  FOR SELECT TO dpg_public_catalogue
  USING (EXISTS (SELECT 1 FROM dpg_app.products p WHERE p.id = product_id));

CREATE POLICY dpg_public_product_features_select ON dpg_app.product_features
  FOR SELECT TO dpg_public_catalogue
  USING (
    EXISTS (
      SELECT 1 FROM dpg_app.product_feature_values fv
      WHERE fv.feature_id = product_features.id
    )
  );

CREATE POLICY dpg_public_blog_categories_select ON dpg_app.blog_categories
  FOR SELECT TO dpg_public_catalogue
  USING (
    is_active = true
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

CREATE POLICY dpg_public_blog_posts_select ON dpg_app.blog_posts
  FOR SELECT TO dpg_public_catalogue
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM dpg_app.blog_categories c
      WHERE c.id = blog_posts.category_id
    )
  );
