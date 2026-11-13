-- Functional local PostgreSQL test for the scoped runtime role. The companion
-- runner uses a schema-only dump from the loopback full-preview DB, applies the
-- reviewed RLS baseline and migration, and drops its temporary database.
\set ON_ERROR_STOP on
\set QUIET 1

BEGIN;

DO $local_only$
BEGIN
  IF current_database() !~ '^dpg_admin_role_test_[0-9]+_[a-f0-9]+$' THEN
    RAISE EXCEPTION 'Refusing to run the role acceptance outside its disposable local database';
  END IF;
END
$local_only$;

-- All fixtures are synthetic, created only inside this transaction, and rolled
-- back at the end. The test never reads or writes the hosted source database.
INSERT INTO dpg_app.admin_users (email, name, password_hash, role, is_active, username)
VALUES ('role-fixture@example.invalid', 'Role Fixture Admin', 'not-a-real-password-hash', 'admin', true, 'role-fixture')
RETURNING id AS fixture_admin_id \gset
SELECT set_config('dpg_admin_role_test.admin_id', :'fixture_admin_id', true);

INSERT INTO dpg_app.categories (name, slug) VALUES ('Role Fixture Category', 'role-fixture-category')
RETURNING id AS fixture_category_id \gset
SELECT set_config('dpg_admin_role_test.category_id', :'fixture_category_id', true);

INSERT INTO dpg_app.subcategories (category_id, name, slug)
VALUES (:'fixture_category_id', 'Role Fixture Subcategory', 'role-fixture-subcategory')
RETURNING id AS fixture_subcategory_id \gset
SELECT set_config('dpg_admin_role_test.subcategory_id', :'fixture_subcategory_id', true);

INSERT INTO dpg_app.brands (name, slug) VALUES ('Role Fixture Brand', 'role-fixture-brand')
RETURNING id AS fixture_brand_id \gset
SELECT set_config('dpg_admin_role_test.brand_id', :'fixture_brand_id', true);

INSERT INTO dpg_app.origins (name, slug) VALUES ('Role Fixture Origin', 'role-fixture-origin')
RETURNING id AS fixture_origin_id \gset
SELECT set_config('dpg_admin_role_test.origin_id', :'fixture_origin_id', true);

INSERT INTO dpg_app.colors (name, slug) VALUES ('Role Fixture Color', 'role-fixture-color')
RETURNING id AS fixture_color_id \gset
SELECT set_config('dpg_admin_role_test.color_id', :'fixture_color_id', true);

INSERT INTO dpg_app.materials (name, slug) VALUES ('Role Fixture Material', 'role-fixture-material')
RETURNING id AS fixture_material_id \gset
SELECT set_config('dpg_admin_role_test.material_id', :'fixture_material_id', true);

INSERT INTO dpg_app.product_types (subcategory_id, name, slug)
VALUES (:'fixture_subcategory_id', 'Role Fixture Type', 'role-fixture-type')
RETURNING id AS fixture_type_id \gset
SELECT set_config('dpg_admin_role_test.product_type_id', :'fixture_type_id', true);

INSERT INTO dpg_app.product_sub_types (product_type_id, name, slug)
VALUES (:'fixture_type_id', 'Role Fixture Subtype', 'role-fixture-subtype')
RETURNING id AS fixture_subtype_id \gset
SELECT set_config('dpg_admin_role_test.product_subtype_id', :'fixture_subtype_id', true);

INSERT INTO dpg_app.catalog_taxons (name, slug, canonical_path, is_active, is_listing_enabled)
VALUES ('Role Fixture Taxon', 'role-fixture-taxon', 'role-fixture-taxon', true, true)
RETURNING id AS fixture_taxon_id \gset
SELECT set_config('dpg_admin_role_test.taxon_id', :'fixture_taxon_id', true);

INSERT INTO dpg_app.products (
  sku, name, slug, category_id, price, price_source, price_confidence,
  source_system, source_confidence, price_updated_at, component_skus
)
VALUES (
  'ROLE-FIXTURE-SENTINEL', 'Role Fixture Sentinel', 'role-fixture-sentinel',
  :'fixture_category_id', 100, 'capture-source', 'high', 'legacy-test',
  'verified', '2025-01-02T03:04:05Z', NULL
)
RETURNING id AS fixture_sentinel_id \gset
SELECT set_config('dpg_admin_role_test.sentinel_id', :'fixture_sentinel_id', true);

INSERT INTO dpg_app.products (sku, name, slug, category_id)
VALUES ('ROLE-FIXTURE-CHILD', 'Role Fixture Child', 'role-fixture-child', :'fixture_category_id')
RETURNING id AS fixture_child_id \gset
SELECT set_config('dpg_admin_role_test.child_id', :'fixture_child_id', true);

INSERT INTO dpg_app.blog_categories (name, slug)
VALUES ('Role Fixture Blog Category', 'role-fixture-blog-category')
RETURNING id AS fixture_blog_category_id \gset
SELECT set_config('dpg_admin_role_test.blog_category_id', :'fixture_blog_category_id', true);

INSERT INTO dpg_app.blog_tags (name, slug)
VALUES ('Role Fixture Blog Tag', 'role-fixture-blog-tag')
RETURNING id AS fixture_blog_tag_id \gset
SELECT set_config('dpg_admin_role_test.blog_tag_id', :'fixture_blog_tag_id', true);

INSERT INTO dpg_app.publishing_machine_identities (id, name, sponsor_user_id, is_active)
VALUES ('00000000-0000-4000-8000-000000000041', 'Role Fixture Publisher', :'fixture_admin_id', true);
SELECT set_config('dpg_admin_role_test.identity_id', '00000000-0000-4000-8000-000000000041', true);

INSERT INTO dpg_app.publishing_managed_media (
  id, identity_id, purpose, status, source_mime, source_bytes, source_sha256,
  storage_path, primary_url
)
VALUES (
  '00000000-0000-4000-8000-000000000042',
  '00000000-0000-4000-8000-000000000041', 'thumbnail', 'ready',
  'image/webp', 13, repeat('a', 64), 'role-fixture/media.webp',
  'https://media.example.invalid/role-fixture.webp'
);

INSERT INTO dpg_app.blog_posts (
  title, slug, content, category_id, publishing_identity_id, external_id, status
)
VALUES (
  'Role Fixture Linked Post', 'role-fixture-linked-post', 'Synthetic content',
  :'fixture_blog_category_id', '00000000-0000-4000-8000-000000000041',
  'role-fixture-external', 'draft'
)
RETURNING id AS fixture_linked_post_id \gset
SELECT set_config('dpg_admin_role_test.linked_post_id', :'fixture_linked_post_id', true);

SET LOCAL ROLE dpg_admin_runtime_login;

DO $role_contract$
DECLARE
  v_user_id integer := current_setting('dpg_admin_role_test.admin_id')::integer;
  v_category_id integer := current_setting('dpg_admin_role_test.category_id')::integer;
  v_subcategory_id integer := current_setting('dpg_admin_role_test.subcategory_id')::integer;
  v_brand_id integer := current_setting('dpg_admin_role_test.brand_id')::integer;
  v_origin_id integer := current_setting('dpg_admin_role_test.origin_id')::integer;
  v_color_id integer := current_setting('dpg_admin_role_test.color_id')::integer;
  v_material_id integer := current_setting('dpg_admin_role_test.material_id')::integer;
  v_type_id integer := current_setting('dpg_admin_role_test.product_type_id')::integer;
  v_subtype_id integer := current_setting('dpg_admin_role_test.product_subtype_id')::integer;
  v_taxon_id integer := current_setting('dpg_admin_role_test.taxon_id')::integer;
  v_sentinel_id integer := current_setting('dpg_admin_role_test.sentinel_id')::integer;
  v_child_id integer := current_setting('dpg_admin_role_test.child_id')::integer;
  v_blog_category_id integer := current_setting('dpg_admin_role_test.blog_category_id')::integer;
  v_blog_tag_id integer := current_setting('dpg_admin_role_test.blog_tag_id')::integer;
  v_identity_id uuid := current_setting('dpg_admin_role_test.identity_id')::uuid;
  v_linked_post_id integer := current_setting('dpg_admin_role_test.linked_post_id')::integer;
  v_returned_id bigint;
  v_count integer;
  v_hash text := repeat('b', 64);
  v_value text;
  v_price numeric(15,2);
  v_components text[];
  v_price_source text;
  v_price_confidence text;
  v_source_system text;
  v_source_confidence text;
  v_role text;
BEGIN
  IF current_user <> 'dpg_admin_runtime_login' THEN
    RAISE EXCEPTION 'Test is not running as dpg_admin_runtime_login';
  END IF;
  SELECT rolname INTO v_role FROM pg_roles WHERE rolname = current_user AND rolcanlogin
    AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Role attributes are not least privilege'; END IF;

  -- Login selects the password hash only for the identifier being checked.
  SELECT id INTO v_returned_id FROM dpg_app.admin_users
  WHERE email = 'role-fixture@example.invalid' OR username = 'role-fixture';
  IF v_returned_id <> v_user_id THEN RAISE EXCEPTION 'Admin login lookup failed'; END IF;
  SELECT password_hash INTO v_value FROM dpg_app.admin_users WHERE id = v_user_id;
  IF v_value <> 'not-a-real-password-hash' THEN RAISE EXCEPTION 'Admin login password_hash read failed'; END IF;

  UPDATE dpg_app.admin_users SET last_login_at = now() WHERE id = v_user_id RETURNING id INTO v_returned_id;
  IF v_returned_id <> v_user_id THEN RAISE EXCEPTION 'last_login_at update failed'; END IF;
  BEGIN
    UPDATE dpg_app.admin_users SET role = 'superadmin' WHERE id = v_user_id;
    RAISE EXCEPTION 'Role unexpectedly updated admin_users.role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    SELECT updated_at INTO v_value FROM dpg_app.admin_users WHERE id = v_user_id;
    RAISE EXCEPTION 'Role unexpectedly read admin_users.updated_at';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Session create, verify join, expiry cleanup, and logout/delete paths use
  -- only token hash, user id, expiry, and id RETURNING.
  INSERT INTO dpg_app.admin_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
  VALUES (v_user_id, v_hash, '127.0.0.1', 'synthetic-test-agent', now() + interval '1 hour')
  RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Session create did not return its id'; END IF;
  PERFORM s.expires_at, u.id, u.email, u.name, u.role, u.avatar_url, u.is_active
  FROM dpg_app.admin_sessions s JOIN dpg_app.admin_users u ON u.id = s.user_id
  WHERE s.token_hash = v_hash;
  BEGIN
    SELECT ip_address INTO v_value FROM dpg_app.admin_sessions WHERE token_hash = v_hash;
    RAISE EXCEPTION 'Role unexpectedly read admin_sessions.ip_address';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    SELECT user_agent INTO v_value FROM dpg_app.admin_sessions WHERE token_hash = v_hash;
    RAISE EXCEPTION 'Role unexpectedly read admin_sessions.user_agent';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM dpg_app.admin_sessions WHERE token_hash = v_hash RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Logout delete failed'; END IF;
  INSERT INTO dpg_app.admin_sessions (user_id, token_hash, expires_at)
  VALUES (v_user_id, repeat('c', 64), now() - interval '1 minute');
  DELETE FROM dpg_app.admin_sessions WHERE user_id = v_user_id AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expired-session cleanup failed'; END IF;
  INSERT INTO dpg_app.admin_sessions (user_id, token_hash, expires_at)
  VALUES (v_user_id, repeat('d', 64), now() + interval '1 hour');
  DELETE FROM dpg_app.admin_sessions WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Delete-all-sessions path failed'; END IF;

  -- Product editor reads and references, and Product create/update/taxonomy,
  -- image, relation, delete, and audit writes through the real role.
  PERFORM p.* FROM dpg_app.products p WHERE p.id = v_sentinel_id;
  PERFORM 1 FROM dpg_app.categories WHERE id = v_category_id;
  PERFORM 1 FROM dpg_app.subcategories WHERE id = v_subcategory_id;
  PERFORM 1 FROM dpg_app.brands WHERE id = v_brand_id;
  PERFORM 1 FROM dpg_app.origins WHERE id = v_origin_id;
  PERFORM 1 FROM dpg_app.colors WHERE id = v_color_id;
  PERFORM 1 FROM dpg_app.materials WHERE id = v_material_id;
  PERFORM 1 FROM dpg_app.filter_definitions;
  PERFORM 1 FROM dpg_app.product_types WHERE id = v_type_id;
  PERFORM 1 FROM dpg_app.product_sub_types WHERE id = v_subtype_id;
  PERFORM 1 FROM dpg_app.catalog_taxons WHERE id = v_taxon_id;
  PERFORM 1 FROM dpg_app.product_taxon_assignments;
  PERFORM 1 FROM dpg_app.product_spec_values;
  PERFORM 1 FROM dpg_app.spec_definitions;
  PERFORM 1 FROM dpg_app.spec_options;
  PERFORM 1 FROM dpg_app.product_documents;
  PERFORM 1 FROM dpg_app.product_feature_values;
  PERFORM 1 FROM dpg_app.product_features;

  UPDATE dpg_app.products SET
    sku='ROLE-FIXTURE-SENTINEL-EDITED', name='Role Fixture Sentinel Edited',
    display_name='Role Fixture Display', slug='role-fixture-sentinel-edited',
    category_id=v_category_id, subcategory_id=v_subcategory_id, brand_id=v_brand_id,
    origin_id=v_origin_id, color_id=v_color_id, material_id=v_material_id,
    price=125, original_price=150, list_price=150, sale_price=125,
    online_discount_amount=2, price_display='Role fixture price',
    description='Synthetic edit', features='Synthetic feature', specs='{"fixture":true}'::jsonb,
    warranty_months=12, image_main_url='https://media.example.invalid/role-fixture.webp',
    stock_status='in_stock', is_active=true, is_featured=true, is_home_featured=false,
    is_promotion=false, is_combo=false, is_master=true, sort_order=4,
    product_type='Role Type', product_sub_type='Role Subtype', product_type_id=v_type_id,
    product_sub_type_id=v_subtype_id, source_url='https://source.example.invalid/product',
    hita_product_id='role-fixture-source-id', seo_title='Role Fixture SEO',
    seo_description='Synthetic SEO', publication_status='public', pdp_visibility='public',
    listing_visibility='default', search_visibility='visible', sellable_status='sellable',
    seo_indexing='index', sitemap_include=true, variant_group='ROLE-FIXTURE-GROUP',
    updated_at=now()
  WHERE id=v_sentinel_id RETURNING id INTO v_returned_id;
  IF v_returned_id <> v_sentinel_id THEN RAISE EXCEPTION 'Product editor update failed'; END IF;
  SELECT price, component_skus, price_source, price_confidence, source_system, source_confidence
    INTO v_price, v_components, v_price_source, v_price_confidence, v_source_system, v_source_confidence
  FROM dpg_app.products WHERE id=v_sentinel_id;
  IF v_price <> 125 OR v_components IS NOT NULL OR v_price_source <> 'capture-source'
     OR v_price_confidence <> 'high' OR v_source_system <> 'legacy-test'
     OR v_source_confidence <> 'verified' THEN
    RAISE EXCEPTION 'Product edit changed the nullable component or protected price/source provenance';
  END IF;
  BEGIN
    UPDATE dpg_app.products SET component_skus = ARRAY['must-not-write'] WHERE id=v_sentinel_id;
    RAISE EXCEPTION 'Role unexpectedly updated nullable component_skus';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE dpg_app.products SET price_source = 'manual' WHERE id=v_sentinel_id;
    RAISE EXCEPTION 'Role unexpectedly updated price_source';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE dpg_app.products SET price_confidence = 'low' WHERE id=v_sentinel_id;
    RAISE EXCEPTION 'Role unexpectedly updated price_confidence';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE dpg_app.products SET source_system = 'manual' WHERE id=v_sentinel_id;
    RAISE EXCEPTION 'Role unexpectedly updated source_system';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  INSERT INTO dpg_app.products (
    sku, name, display_name, slug, category_id, subcategory_id, brand_id,
    origin_id, color_id, material_id, price, original_price, list_price,
    sale_price, online_discount_amount, price_display, description, features,
    specs, warranty_months, image_main_url, stock_status, is_active,
    is_featured, is_home_featured, is_promotion, is_combo, is_master, sort_order,
    product_type, product_sub_type, source_url, hita_product_id, seo_title,
    seo_description
  ) VALUES (
    'ROLE-FIXTURE-CREATED', 'Role-created Product', 'Role-created display',
    'role-fixture-created', v_category_id, v_subcategory_id, v_brand_id,
    v_origin_id, v_color_id, v_material_id, 100, 120, 120, 100, 0,
    'Role fixture', 'Synthetic description', 'Synthetic feature', '{"fixture":true}',
    12, 'https://media.example.invalid/created.webp', 'in_stock', true,
    false, false, false, false, true, 5, 'Role Type', 'Role Subtype',
    'https://source.example.invalid/created', 'role-created-source-id',
    'Role-created SEO', 'Synthetic SEO'
  ) RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Product create did not return its id'; END IF;

  DELETE FROM dpg_app.product_taxon_assignments WHERE product_id=v_returned_id;
  INSERT INTO dpg_app.product_taxon_assignments
    (product_id, taxon_id, is_primary, role, sort_order, source, confidence)
  VALUES (v_returned_id, v_taxon_id, true, 'primary', 0, 'manual', 100);

  INSERT INTO dpg_app.product_images (product_id, image_url, alt_text, image_type, sort_order)
  VALUES (v_returned_id, 'https://media.example.invalid/gallery.webp', 'fixture', 'gallery', 0)
  RETURNING id INTO v_returned_id;
  UPDATE dpg_app.product_images SET sort_order=1 WHERE id=v_returned_id RETURNING id INTO v_returned_id;
  DELETE FROM dpg_app.product_images WHERE id=v_returned_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Product image insert/update/delete failed'; END IF;

  INSERT INTO dpg_app.product_relationships
    (parent_id, child_id, child_sku, relationship_type, sort_order)
  VALUES (current_setting('dpg_admin_role_test.sentinel_id')::integer, v_child_id,
    'ROLE-FIXTURE-CHILD', 'component', 0)
  RETURNING id INTO v_returned_id;
  DELETE FROM dpg_app.product_relationships WHERE id=v_returned_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Product relationship insert/delete failed'; END IF;

  INSERT INTO dpg_app.audit_logs (user_id, action, entity_type, entity_id, new_value)
  VALUES (v_user_id, 'role-fixture.product.updated', 'product', v_sentinel_id, '{"changed_fields":["name"]}'::jsonb)
  RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'PIM audit append failed'; END IF;
  BEGIN
    SELECT action INTO v_value FROM dpg_app.audit_logs WHERE id=v_returned_id;
    RAISE EXCEPTION 'Role unexpectedly read PIM audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE dpg_app.audit_logs SET action='rewritten' WHERE id=v_returned_id;
    RAISE EXCEPTION 'Role unexpectedly updated PIM audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM dpg_app.audit_logs WHERE id=v_returned_id;
    RAISE EXCEPTION 'Role unexpectedly deleted PIM audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Blog post create/update/delete, tag association/count SQL, media lookup,
  -- and linked-agent audit append use only the reviewed Blog contract.
  PERFORM 1 FROM dpg_app.blog_categories WHERE id=v_blog_category_id;
  PERFORM 1 FROM dpg_app.blog_tags WHERE id=v_blog_tag_id;
  PERFORM m.id FROM dpg_app.publishing_managed_media m
    JOIN dpg_app.publishing_machine_identities i ON i.id=m.identity_id
    WHERE m.id='00000000-0000-4000-8000-000000000042' AND m.status='ready' AND i.is_active;
  IF NOT EXISTS (
    SELECT 1 FROM dpg_app.blog_posts bp
    JOIN dpg_app.publishing_machine_identities i ON i.id=bp.publishing_identity_id
    WHERE bp.id=v_linked_post_id AND i.sponsor_user_id=v_user_id
  ) THEN RAISE EXCEPTION 'Linked Blog post identity read failed'; END IF;

  INSERT INTO dpg_app.blog_posts (
    title, slug, excerpt, content, category_id, thumbnail_url, cover_image_url,
    seo_title, seo_description, seo_keywords, reading_time, status, published_at,
    first_published_at, author_name, author_avatar, is_featured, is_pinned
  ) VALUES (
    'Role-created Blog Post', 'role-fixture-created-post', 'Synthetic excerpt',
    '<p>Synthetic blog content</p>', v_blog_category_id,
    'https://media.example.invalid/role-fixture.webp',
    'https://media.example.invalid/role-fixture.webp', 'Fixture SEO', 'Synthetic SEO',
    'role fixture', 3, 'draft', NULL, NULL, 'Role Fixture Editor', NULL, false, false
  ) RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Blog post create did not return its id'; END IF;
  UPDATE dpg_app.blog_posts SET
    title='Role-updated Blog Post', slug='role-fixture-created-post', excerpt='Updated excerpt',
    content='<p>Updated synthetic content</p>', category_id=v_blog_category_id,
    thumbnail_url=NULL, cover_image_url=NULL, seo_title='Updated SEO',
    seo_description='Updated description', seo_keywords='fixture', reading_time=4,
    status='published', published_at=now(), first_published_at=now(),
    scheduled_for=NULL, scheduled_timezone=NULL, scheduled_version=NULL,
    schedule_blocked_code=NULL, schedule_blocked_at=NULL, schedule_last_attempt_at=NULL,
    author_name='Role Fixture Editor', author_avatar=NULL, is_featured=true,
    is_pinned=false, version=version+1, updated_at=now()
  WHERE id=v_returned_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Blog post update failed'; END IF;
  INSERT INTO dpg_app.blog_post_tags (post_id, tag_id) VALUES (v_returned_id, v_blog_tag_id);
  UPDATE dpg_app.blog_tags SET post_count=(
    SELECT count(*) FROM dpg_app.blog_post_tags WHERE blog_post_tags.tag_id=blog_tags.id
  );
  SELECT post_count INTO v_count FROM dpg_app.blog_tags WHERE id=v_blog_tag_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Blog post tag count update failed'; END IF;
  BEGIN
    UPDATE dpg_app.blog_tags SET name='Role must not rename tags' WHERE id=v_blog_tag_id;
    RAISE EXCEPTION 'Role unexpectedly edited blog tag metadata';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE dpg_app.blog_posts SET status='published', version=version+1, updated_at=now()
  WHERE id=v_linked_post_id RETURNING id INTO v_returned_id;
  INSERT INTO dpg_app.publishing_audit_events (
    actor_kind, identity_id, admin_actor_id, sponsor_user_id, action, post_id,
    external_id, from_version, to_version, from_state, to_state, changed_fields
  ) VALUES (
    'admin', v_identity_id, v_user_id, v_user_id, 'post.cms_updated', v_linked_post_id,
    'role-fixture-external', 1, 2, 'draft', 'published', ARRAY['cms_form']
  ) RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Linked Blog audit append failed'; END IF;
  BEGIN
    SELECT action INTO v_value FROM dpg_app.publishing_audit_events WHERE id=v_returned_id;
    RAISE EXCEPTION 'Role unexpectedly read Publishing audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE dpg_app.publishing_audit_events SET action='rewritten' WHERE id=v_returned_id;
    RAISE EXCEPTION 'Role unexpectedly updated Publishing audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM dpg_app.publishing_audit_events WHERE id=v_returned_id;
    RAISE EXCEPTION 'Role unexpectedly deleted Publishing audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM dpg_app.blog_posts WHERE slug='role-fixture-created-post' RETURNING id INTO v_returned_id;
  IF v_returned_id IS NULL THEN RAISE EXCEPTION 'Blog post delete failed'; END IF;
  UPDATE dpg_app.blog_tags SET post_count=(
    SELECT count(*) FROM dpg_app.blog_post_tags WHERE blog_post_tags.tag_id=blog_tags.id
  );
  SELECT post_count INTO v_count FROM dpg_app.blog_tags WHERE id=v_blog_tag_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Blog tag count failed to settle after delete'; END IF;

  -- Deferred modules and privileged actions are unavailable at the DB role.
  FOREACH v_value IN ARRAY ARRAY[
    'orders','order_items','customers','quote_requests','quote_items','partners',
    'projects','banners','publishing_credentials','product_source_mappings'
  ] LOOP
    IF to_regclass(format('%I.%I','dpg_app',v_value)) IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT 1 FROM dpg_app.%I LIMIT 1', v_value);
        RAISE EXCEPTION 'Role unexpectedly read deferred table dpg_app.%', v_value;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END IF;
  END LOOP;

  FOREACH v_value IN ARRAY ARRAY[
    'product_spec_values','product_documents','product_feature_values','product_features',
    'filter_definitions','spec_definitions','spec_options','product_types','product_sub_types',
    'blog_categories','brands','catalog_taxons','categories','subcategories','colors','origins','materials'
  ] LOOP
    IF has_table_privilege(current_user, format('%I.%I','dpg_app',v_value), 'INSERT')
       OR has_table_privilege(current_user, format('%I.%I','dpg_app',v_value), 'UPDATE')
       OR has_table_privilege(current_user, format('%I.%I','dpg_app',v_value), 'DELETE') THEN
      RAISE EXCEPTION 'Role unexpectedly wrote read-only route table dpg_app.%', v_value;
    END IF;
  END LOOP;
END
$role_contract$;

RESET ROLE;

DO $provenance_check$
DECLARE
  v_components text[];
  v_price_source text;
  v_price_confidence text;
  v_source_system text;
  v_source_confidence text;
  v_price numeric(15,2);
BEGIN
  SELECT component_skus, price_source, price_confidence, source_system,
    source_confidence, price
  INTO v_components, v_price_source, v_price_confidence, v_source_system,
    v_source_confidence, v_price
  FROM dpg_app.products WHERE id=current_setting('dpg_admin_role_test.sentinel_id')::integer;
  IF v_components IS NOT NULL OR v_price_source <> 'capture-source'
     OR v_price_confidence <> 'high' OR v_source_system <> 'legacy-test'
     OR v_source_confidence <> 'verified' OR v_price <> 125 THEN
    RAISE EXCEPTION 'Null component_skus or protected product provenance changed';
  END IF;
END
$provenance_check$;

SET LOCAL ROLE dpg_runtime;
DO $public_read_preserved$
BEGIN
  PERFORM 1 FROM dpg_app.products LIMIT 1;
  PERFORM 1 FROM dpg_app.categories LIMIT 1;
  BEGIN
    UPDATE dpg_app.products SET name='not-a-public-write'
    WHERE id = (SELECT min(id) FROM dpg_app.products);
    RAISE EXCEPTION 'Existing dpg_runtime unexpectedly gained a Product write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$public_read_preserved$;

RESET ROLE;
ROLLBACK;
\set QUIET 0
\echo 'PASS: role grants, RLS, auth/session, Product/Blog mutations, provenance, deferred denials, and audit append-only behavior'
