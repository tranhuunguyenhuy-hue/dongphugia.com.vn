-- LEO-540 sanitized runtime manifest. This query returns metadata only:
-- schema definitions, row counts, and row hashes. It must never select row data.
WITH table_objects AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'identity', n.nspname || '.' || c.relname,
      'rls', c.relrowsecurity,
      'forceRls', c.relforcerowsecurity,
      'columns', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'nullable', NOT a.attnotnull,
          'defaultMd5', CASE WHEN ad.adbin IS NULL THEN NULL ELSE md5(pg_get_expr(ad.adbin, ad.adrelid)) END
        ) ORDER BY a.attnum)
        FROM pg_attribute a
        LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      ), '[]'::jsonb)
    ) ORDER BY n.nspname, c.relname
  ), '[]'::jsonb) AS value
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('dpg_app', 'dpg_v1', 'dpg_control') AND c.relkind IN ('r', 'p')
), index_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', schemaname || '.' || tablename || '.' || indexname,
    'definitionMd5', md5(indexdef)
  ) ORDER BY schemaname, tablename, indexname), '[]'::jsonb) AS value
  FROM pg_indexes
  WHERE schemaname IN ('dpg_app', 'dpg_v1', 'dpg_control')
), constraint_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', ns.nspname || '.' || cls.relname || '.' || con.conname,
    'type', con.contype,
    'definitionMd5', md5(pg_get_constraintdef(con.oid))
  ) ORDER BY ns.nspname, cls.relname, con.conname), '[]'::jsonb) AS value
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname IN ('dpg_app', 'dpg_v1', 'dpg_control')
), view_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', n.nspname || '.' || c.relname,
    'definitionMd5', md5(pg_get_viewdef(c.oid, true))
  ) ORDER BY n.nspname, c.relname), '[]'::jsonb) AS value
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('dpg_app', 'dpg_v1', 'dpg_control') AND c.relkind IN ('v', 'm')
), function_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    'definitionMd5', md5(pg_get_functiondef(p.oid)),
    'language', l.lanname,
    'volatility', p.provolatile,
    'securityDefiner', p.prosecdef,
    'configMd5', md5(COALESCE(array_to_string(p.proconfig, E'\n'), ''))
  ) ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb) AS value
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname IN ('dpg_app', 'dpg_v1', 'dpg_control')
), trigger_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', n.nspname || '.' || c.relname || '.' || t.tgname,
    'definitionMd5', md5(pg_get_triggerdef(t.oid)),
    'enabled', t.tgenabled
  ) ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb) AS value
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('dpg_app', 'dpg_v1', 'dpg_control')
), policy_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', n.nspname || '.' || c.relname || '.' || p.polname,
    'permissive', CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
    'roles', ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles) ORDER BY rolname),
    'command', p.polcmd,
    'usingMd5', CASE WHEN p.polqual IS NULL THEN NULL ELSE md5(pg_get_expr(p.polqual, p.polrelid)) END,
    'checkMd5', CASE WHEN p.polwithcheck IS NULL THEN NULL ELSE md5(pg_get_expr(p.polwithcheck, p.polrelid)) END
  ) ORDER BY n.nspname, c.relname, p.polname), '[]'::jsonb) AS value
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('dpg_app', 'dpg_v1', 'dpg_control')
), restore_count_objects AS (
  SELECT jsonb_build_array(
    jsonb_build_object(
      'tableName', 'blog_categories',
      'rowCount', (SELECT count(*) FROM dpg_app.blog_categories)
    ),
    jsonb_build_object(
      'tableName', 'blog_post_tags',
      'rowCount', (SELECT count(*) FROM dpg_app.blog_post_tags)
    ),
    jsonb_build_object(
      'tableName', 'blog_posts',
      'rowCount', (SELECT count(*) FROM dpg_app.blog_posts)
    ),
    jsonb_build_object(
      'tableName', 'blog_tags',
      'rowCount', (SELECT count(*) FROM dpg_app.blog_tags)
    ),
    jsonb_build_object(
      'tableName', 'product_images',
      'rowCount', (SELECT count(*) FROM dpg_app.product_images)
    ),
    jsonb_build_object(
      'tableName', 'products',
      'rowCount', (SELECT count(*) FROM dpg_app.products)
    ),
    jsonb_build_object(
      'tableName', 'publishing_blog_post_media',
      'rowCount', (SELECT count(*) FROM dpg_app.publishing_blog_post_media)
    )
  ) AS value
), canonical_v1_data AS (
  SELECT 'dpg_v1.staff_users' AS table_name, count(*) AS row_count,
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex') AS sha256,
    'canonical_dpg_v1' AS source_authority
  FROM dpg_v1.staff_users item
  UNION ALL SELECT 'dpg_v1.staff_user_roles', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.staff_user_roles item
  UNION ALL SELECT 'dpg_v1.role_capabilities', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.role_capabilities item
  UNION ALL SELECT 'dpg_v1.media_assets', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.media_assets item
  UNION ALL SELECT 'dpg_v1.media_variants', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.media_variants item
  UNION ALL SELECT 'dpg_v1.brands', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.brands item
  UNION ALL SELECT 'dpg_v1.categories', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.categories item
  UNION ALL SELECT 'dpg_v1.product_families', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_families item
  UNION ALL SELECT 'dpg_v1.product_family_configuration_groups', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_family_configuration_groups item
  UNION ALL SELECT 'dpg_v1.products', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.products item
  UNION ALL SELECT 'dpg_v1.product_family_memberships', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_family_memberships item
  UNION ALL SELECT 'dpg_v1.product_source_provenance', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_source_provenance item
  UNION ALL SELECT 'dpg_v1.collections', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.collections item
  UNION ALL SELECT 'dpg_v1.collection_products', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.collection_products item
  UNION ALL SELECT 'dpg_v1.attribute_definitions', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.attribute_definitions item
  UNION ALL SELECT 'dpg_v1.attribute_options', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.attribute_options item
  UNION ALL SELECT 'dpg_v1.category_attribute_policies', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.category_attribute_policies item
  UNION ALL SELECT 'dpg_v1.product_attribute_values', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_attribute_values item
  UNION ALL SELECT 'dpg_v1.product_attribute_multi_options', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_attribute_multi_options item
  UNION ALL SELECT 'dpg_v1.product_media', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_media item
  UNION ALL SELECT 'dpg_v1.product_documents', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.product_documents item
  UNION ALL SELECT 'dpg_v1.content_entries', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.content_entries item
  UNION ALL SELECT 'dpg_v1.content_blocks', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.content_blocks item
  UNION ALL SELECT 'dpg_v1.content_product_references', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.content_product_references item
  UNION ALL SELECT 'dpg_v1.content_category_references', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.content_category_references item
  UNION ALL SELECT 'dpg_v1.content_brand_references', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.content_brand_references item
  UNION ALL SELECT 'dpg_v1.quote_requests', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.quote_requests item
  UNION ALL SELECT 'dpg_v1.quote_request_lines', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.quote_request_lines item
  UNION ALL SELECT 'dpg_v1.quotes', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.quotes item
  UNION ALL SELECT 'dpg_v1.quote_lines', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.quote_lines item
  UNION ALL SELECT 'dpg_v1.quote_shares', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.quote_shares item
  UNION ALL SELECT 'dpg_v1.orders', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.orders item
  UNION ALL SELECT 'dpg_v1.order_lines', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.order_lines item
  UNION ALL SELECT 'dpg_v1.payment_transactions', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.payment_transactions item
  UNION ALL SELECT 'dpg_v1.commerce_idempotency_records', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.commerce_idempotency_records item
  UNION ALL SELECT 'dpg_v1.service_idempotency_records', count(*),
    encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(item) ORDER BY to_jsonb(item)), '[]'::jsonb)::text, 'UTF8')), 'hex'),
    'canonical_dpg_v1' FROM dpg_v1.service_idempotency_records item
), canonical_v1_restore_counts AS (
  SELECT jsonb_agg(jsonb_build_object(
    'tableName', table_name,
    'rowCount', row_count
  ) ORDER BY table_name) AS value
  FROM canonical_v1_data
)
SELECT jsonb_build_object(
  'formatVersion', 2,
  'target', (
    SELECT jsonb_build_object(
      'projectName', project_name,
      'region', region,
      'environment', environment,
      'dataClass', data_class,
      'productionDataAllowed', production_data_allowed,
      'productionCredentialsAllowed', production_credentials_allowed,
      'productionWritesAllowed', production_writes_allowed,
      'hardDatabaseCeilingBytes', hard_database_ceiling_bytes
    )
    FROM dpg_control.target_contract
    WHERE singleton
  ),
  'databaseSizeBytes', pg_database_size(current_database()),
  'schema', jsonb_build_object(
    'schemas', ARRAY['dpg_app', 'dpg_v1', 'dpg_control'],
    'tables', table_objects.value,
    'indexes', index_objects.value,
    'constraints', constraint_objects.value,
    'views', view_objects.value,
    'functions', function_objects.value,
    'triggers', trigger_objects.value,
    'policies', policy_objects.value
  ),
  'data', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tableName', table_name,
      'rowCount', row_count,
      'sha256', sha256,
      'sourceAuthority', source_authority
    ) ORDER BY table_name)
    FROM (
      SELECT table_name, row_count, sha256, source_authority
      FROM dpg_control.leo538_restore_manifest
      UNION ALL
      SELECT table_name, row_count, sha256, source_authority
      FROM canonical_v1_data
    ) all_data
  ), '[]'::jsonb),
  'restoreCounts', restore_count_objects.value,
  'canonicalV1RestoreCounts', canonical_v1_restore_counts.value
  )::text
  FROM table_objects, index_objects, constraint_objects, view_objects,
       function_objects, trigger_objects, policy_objects, restore_count_objects,
       canonical_v1_restore_counts;
