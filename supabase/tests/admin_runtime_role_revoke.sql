-- Local-only rollback test for the disposable role-acceptance database.
-- The database-name guard makes accidental use against any hosted target fail.
\set ON_ERROR_STOP on

DO $preflight$
BEGIN
  IF current_database() !~ '^dpg_admin_role_test_[0-9]+_[0-9a-f]+$' THEN
    RAISE EXCEPTION 'This rollback test only runs in a disposable dpg_admin_role_test database';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_admin_runtime_login') THEN
    RAISE EXCEPTION 'Expected dpg_admin_runtime_login before local rollback';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_stat_activity
    WHERE usename = 'dpg_admin_runtime_login' AND pid <> pg_backend_pid()
  ) THEN
    RAISE EXCEPTION 'Stop: the runtime role still has an active session';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE r.rolname = 'dpg_admin_runtime_login'
  ) OR EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.roleid OR r.oid = m.member
    WHERE r.rolname = 'dpg_admin_runtime_login'
  ) THEN
    RAISE EXCEPTION 'Stop: role ownership or membership must be reviewed before rollback';
  END IF;
END
$preflight$;

BEGIN;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.admin_users;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.blog_categories;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.blog_post_tags;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.blog_posts;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.blog_tags;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.brands;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.catalog_taxons;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.categories;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.colors;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.filter_definitions;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.materials;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.origins;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_documents;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_feature_values;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_features;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_images;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_relationships;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_spec_values;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_sub_types;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_taxon_assignments;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.product_types;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.publishing_machine_identities;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.publishing_managed_media;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.spec_definitions;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.spec_options;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.subcategories;
DROP POLICY IF EXISTS dpg_admin_runtime_select ON dpg_app.products;
DROP POLICY IF EXISTS dpg_admin_runtime_update ON dpg_app.admin_users;
DROP POLICY IF EXISTS dpg_admin_runtime_products_insert ON dpg_app.products;
DROP POLICY IF EXISTS dpg_admin_runtime_products_update ON dpg_app.products;
DROP POLICY IF EXISTS dpg_admin_runtime_products_delete ON dpg_app.products;
DROP POLICY IF EXISTS dpg_admin_runtime_product_images_insert ON dpg_app.product_images;
DROP POLICY IF EXISTS dpg_admin_runtime_product_images_update ON dpg_app.product_images;
DROP POLICY IF EXISTS dpg_admin_runtime_product_images_delete ON dpg_app.product_images;
DROP POLICY IF EXISTS dpg_admin_runtime_product_relationships_insert ON dpg_app.product_relationships;
DROP POLICY IF EXISTS dpg_admin_runtime_product_relationships_delete ON dpg_app.product_relationships;
DROP POLICY IF EXISTS dpg_admin_runtime_product_taxon_assignments_insert ON dpg_app.product_taxon_assignments;
DROP POLICY IF EXISTS dpg_admin_runtime_product_taxon_assignments_delete ON dpg_app.product_taxon_assignments;
DROP POLICY IF EXISTS dpg_admin_runtime_blog_posts_insert ON dpg_app.blog_posts;
DROP POLICY IF EXISTS dpg_admin_runtime_blog_posts_update ON dpg_app.blog_posts;
DROP POLICY IF EXISTS dpg_admin_runtime_blog_posts_delete ON dpg_app.blog_posts;
DROP POLICY IF EXISTS dpg_admin_runtime_blog_post_tags_insert ON dpg_app.blog_post_tags;
DROP POLICY IF EXISTS dpg_admin_runtime_blog_post_tags_delete ON dpg_app.blog_post_tags;
DROP POLICY IF EXISTS dpg_admin_runtime_blog_tags_update ON dpg_app.blog_tags;

REVOKE ALL PRIVILEGES ON TABLE
  dpg_app.admin_users, dpg_app.admin_sessions, dpg_app.audit_logs,
  dpg_app.blog_categories, dpg_app.blog_post_tags, dpg_app.blog_posts,
  dpg_app.blog_tags, dpg_app.brands, dpg_app.catalog_taxons, dpg_app.categories,
  dpg_app.colors, dpg_app.filter_definitions, dpg_app.materials, dpg_app.origins,
  dpg_app.product_documents, dpg_app.product_feature_values, dpg_app.product_features,
  dpg_app.product_images, dpg_app.product_relationships, dpg_app.product_spec_values,
  dpg_app.product_sub_types, dpg_app.product_taxon_assignments, dpg_app.product_types,
  dpg_app.products, dpg_app.publishing_audit_events, dpg_app.publishing_machine_identities,
  dpg_app.publishing_managed_media, dpg_app.spec_definitions, dpg_app.spec_options,
  dpg_app.subcategories
FROM dpg_admin_runtime_login;
REVOKE ALL PRIVILEGES ON SEQUENCE
  dpg_app.admin_sessions_id_seq, dpg_app.audit_logs_id_seq, dpg_app.blog_posts_id_seq,
  dpg_app.product_images_id_seq, dpg_app.product_relationships_id_seq,
  dpg_app.product_taxon_assignments_id_seq, dpg_app.products_id_seq,
  dpg_app.publishing_audit_events_id_seq
FROM dpg_admin_runtime_login;
REVOKE ALL PRIVILEGES ON SCHEMA dpg_app FROM dpg_admin_runtime_login;
DROP ROLE dpg_admin_runtime_login;
COMMIT;

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_admin_runtime_login') THEN
    RAISE EXCEPTION 'Local rollback left dpg_admin_runtime_login behind';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'dpg_app' AND policyname LIKE 'dpg_admin_runtime_%'
  ) THEN
    RAISE EXCEPTION 'Local rollback left a runtime policy behind';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'dpg_app'
      AND tablename = 'products' AND policyname = 'leo538_runtime_select'
      AND cmd = 'SELECT' AND 'dpg_runtime' = ANY(roles) AND 'dpg_readonly' = ANY(roles)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'dpg_app'
      AND tablename = 'products' AND policyname = 'leo541_products_select_public'
      AND cmd = 'SELECT' AND 'authenticated' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'Local rollback changed existing Public/runtime read policies';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'dpg_app' AND c.relname = 'products'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'dpg_app' AND c.relname = 'admin_sessions'
      AND (c.relrowsecurity OR c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'Local rollback changed pre-existing RLS state';
  END IF;
END
$postflight$;
