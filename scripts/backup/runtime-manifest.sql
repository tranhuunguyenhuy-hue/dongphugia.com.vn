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
  WHERE n.nspname IN ('dpg_app', 'dpg_control') AND c.relkind IN ('r', 'p')
), index_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', schemaname || '.' || tablename || '.' || indexname,
    'definitionMd5', md5(indexdef)
  ) ORDER BY schemaname, tablename, indexname), '[]'::jsonb) AS value
  FROM pg_indexes
  WHERE schemaname IN ('dpg_app', 'dpg_control')
), constraint_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', ns.nspname || '.' || cls.relname || '.' || con.conname,
    'type', con.contype,
    'definitionMd5', md5(pg_get_constraintdef(con.oid))
  ) ORDER BY ns.nspname, cls.relname, con.conname), '[]'::jsonb) AS value
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname IN ('dpg_app', 'dpg_control')
), view_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', n.nspname || '.' || c.relname,
    'definitionMd5', md5(pg_get_viewdef(c.oid, true))
  ) ORDER BY n.nspname, c.relname), '[]'::jsonb) AS value
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('dpg_app', 'dpg_control') AND c.relkind IN ('v', 'm')
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
  WHERE n.nspname IN ('dpg_app', 'dpg_control')
), trigger_objects AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'identity', n.nspname || '.' || c.relname || '.' || t.tgname,
    'definitionMd5', md5(pg_get_triggerdef(t.oid)),
    'enabled', t.tgenabled
  ) ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb) AS value
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('dpg_app', 'dpg_control')
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
  WHERE n.nspname IN ('dpg_app', 'dpg_control')
)
SELECT jsonb_build_object(
  'formatVersion', 1,
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
    'schemas', ARRAY['dpg_app', 'dpg_control'],
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
    FROM dpg_control.leo538_restore_manifest
  ), '[]'::jsonb)
)::text;
