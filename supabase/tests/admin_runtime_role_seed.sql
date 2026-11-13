-- Local-test-only mirror of the already-reviewed dpg_app security baseline.
-- Never run this file against a hosted project; the local runner enforces loopback.
\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_runtime') THEN
    EXECUTE 'CREATE ROLE dpg_runtime NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_readonly') THEN
    EXECUTE 'CREATE ROLE dpg_readonly NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
END
$roles$;

GRANT USAGE ON SCHEMA dpg_app TO dpg_runtime, dpg_readonly, authenticated;

GRANT SELECT ON TABLE
  dpg_app.admin_users,
  dpg_app.blog_categories,
  dpg_app.blog_post_tags,
  dpg_app.blog_posts,
  dpg_app.blog_tags,
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
  dpg_app.product_images,
  dpg_app.product_relationships,
  dpg_app.product_spec_values,
  dpg_app.product_sub_types,
  dpg_app.product_taxon_assignments,
  dpg_app.product_types,
  dpg_app.products,
  dpg_app.publishing_machine_identities,
  dpg_app.publishing_managed_media,
  dpg_app.spec_definitions,
  dpg_app.spec_options,
  dpg_app.subcategories
TO dpg_runtime, dpg_readonly;
GRANT SELECT ON TABLE dpg_app.products TO authenticated;

DO $baseline$
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
    EXECUTE format('ALTER TABLE dpg_app.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE dpg_app.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format(
      'CREATE POLICY leo538_runtime_select ON dpg_app.%I FOR SELECT TO dpg_runtime, dpg_readonly USING (true)',
      v_table
    );
  END LOOP;
  EXECUTE 'CREATE POLICY leo541_products_select_public ON dpg_app.products FOR SELECT TO authenticated USING (true)';
END
$baseline$;
