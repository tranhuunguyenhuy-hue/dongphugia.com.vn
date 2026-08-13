-- Production-only forward deployment artifact for the Publishing API v1
-- runtime role. Invoke with psql -X -v runtime_role=<application-runtime-role>.
--
-- This is intentionally outside Prisma discovery. It grants only the DML used
-- by the Publishing API/control plane and the two owned identity sequences; it
-- never transfers ownership, grants DDL, or permits audit mutation.

\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \echo 'Publishing runtime grants require --set=runtime_role=<application-runtime-role>'
  SELECT 1 / 0;
\endif

BEGIN;

SET LOCAL publishing.runtime_role TO :'runtime_role';
SET LOCAL search_path = pg_catalog, public;

CREATE TEMP TABLE publishing_expected_table_privileges (
  table_name name NOT NULL,
  privilege_type text NOT NULL,
  PRIMARY KEY (table_name, privilege_type)
) ON COMMIT DROP;

INSERT INTO publishing_expected_table_privileges (table_name, privilege_type)
VALUES
  ('publishing_machine_identities', 'SELECT'),
  ('publishing_machine_identities', 'INSERT'),
  ('publishing_machine_identities', 'UPDATE'),
  ('publishing_identity_capabilities', 'SELECT'),
  ('publishing_identity_capabilities', 'INSERT'),
  ('publishing_identity_capabilities', 'UPDATE'),
  ('publishing_credentials', 'SELECT'),
  ('publishing_credentials', 'INSERT'),
  ('publishing_credentials', 'UPDATE'),
  ('publishing_identity_ip_allowlist', 'SELECT'),
  ('publishing_identity_ip_allowlist', 'INSERT'),
  ('publishing_identity_ip_allowlist', 'UPDATE'),
  ('publishing_identity_ip_allowlist', 'DELETE'),
  ('publishing_managed_media', 'SELECT'),
  ('publishing_managed_media', 'INSERT'),
  ('publishing_managed_media', 'UPDATE'),
  ('publishing_blog_post_media', 'SELECT'),
  ('publishing_blog_post_media', 'INSERT'),
  ('publishing_blog_post_media', 'DELETE'),
  ('publishing_idempotency_records', 'SELECT'),
  ('publishing_idempotency_records', 'INSERT'),
  ('publishing_idempotency_records', 'UPDATE'),
  ('publishing_idempotency_records', 'DELETE'),
  ('publishing_rate_limit_windows', 'SELECT'),
  ('publishing_rate_limit_windows', 'INSERT'),
  ('publishing_rate_limit_windows', 'UPDATE'),
  ('publishing_global_controls', 'SELECT'),
  ('publishing_global_controls', 'UPDATE'),
  ('publishing_scheduler_state', 'SELECT'),
  ('publishing_scheduler_state', 'INSERT'),
  ('publishing_scheduler_state', 'UPDATE'),
  ('publishing_audit_events', 'SELECT'),
  ('publishing_audit_events', 'INSERT');

CREATE TEMP TABLE publishing_expected_sequence_privileges (
  sequence_name name NOT NULL,
  privilege_type text NOT NULL,
  PRIMARY KEY (sequence_name, privilege_type)
) ON COMMIT DROP;

INSERT INTO publishing_expected_sequence_privileges (sequence_name, privilege_type)
VALUES
  ('publishing_identity_ip_allowlist_id_seq', 'USAGE'),
  ('publishing_identity_ip_allowlist_id_seq', 'SELECT'),
  ('publishing_audit_events_id_seq', 'USAGE'),
  ('publishing_audit_events_id_seq', 'SELECT');

-- Publishing v1 deliberately does not manage ACLs on the pre-existing CMS
-- objects. They remain owned and administered by the CMS migration path. The
-- runtime nevertheless needs this exact existing surface, so assert it before
-- touching Publishing ACLs rather than discovering a missing permission on a
-- live API or scheduler request.
CREATE TEMP TABLE publishing_required_legacy_table_privileges (
  table_name name NOT NULL,
  privilege_type text NOT NULL,
  PRIMARY KEY (table_name, privilege_type)
) ON COMMIT DROP;

INSERT INTO publishing_required_legacy_table_privileges (table_name, privilege_type)
VALUES
  ('admin_users', 'SELECT'),
  ('blog_categories', 'SELECT'),
  ('blog_tags', 'SELECT'),
  ('blog_tags', 'UPDATE'),
  ('blog_post_tags', 'SELECT'),
  ('blog_post_tags', 'INSERT'),
  ('blog_post_tags', 'DELETE'),
  ('blog_posts', 'SELECT'),
  ('blog_posts', 'INSERT'),
  ('blog_posts', 'UPDATE');

DO $$
DECLARE
  target_role name := current_setting('publishing.runtime_role')::name;
  target_role_oid oid;
  migration_role_oid oid;
  target_is_superuser boolean;
  target_can_create_role boolean;
  target_can_create_database boolean;
  target_can_replicate boolean;
  target_can_login boolean;
  role_membership_count integer;
  expected_table_count integer;
  publishing_table_count integer;
  unexpected_table_count integer;
  expected_table_owner_count integer;
  publishing_row_security_count integer;
  expected_sequence_count integer;
  publishing_sequence_count integer;
  unexpected_sequence_count integer;
  expected_sequence_owner_count integer;
  audit_function_count integer;
  audit_trigger_count integer;
  audit_trigger_total_count integer;
  public_table_grant_count integer;
  public_sequence_grant_count integer;
  target_table_acl_count integer;
  target_sequence_acl_count integer;
  table_acl_diff_count integer;
  sequence_acl_diff_count integer;
  table_effective_privilege_count integer;
  sequence_effective_privilege_count integer;
  table_effective_diff_count integer;
  sequence_effective_diff_count integer;
  missing_legacy_table_privilege_count integer;
  legacy_object_owner_count integer;
  public_legacy_table_privilege_count integer;
  grantable_legacy_table_privilege_count integer;
  unsafe_legacy_table_privilege_count integer;
  missing_legacy_sequence_privilege_count integer;
  public_legacy_sequence_privilege_count integer;
  grantable_legacy_sequence_privilege_count integer;
  unsafe_legacy_sequence_privilege_count integer;
BEGIN
  SELECT oid INTO migration_role_oid
  FROM pg_roles
  WHERE rolname = current_user;

  SELECT oid, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolcanlogin
  INTO target_role_oid, target_is_superuser, target_can_create_role,
    target_can_create_database, target_can_replicate, target_can_login
  FROM pg_roles
  WHERE rolname = target_role;

  IF target_role_oid IS NULL
    OR target_role = current_user
    OR target_is_superuser
    OR target_can_create_role
    OR target_can_create_database
    OR target_can_replicate
    OR NOT target_can_login
  THEN
    RAISE EXCEPTION 'Publishing runtime role must exist, be a non-owner application login role, and differ from the migration role';
  END IF;

  SELECT count(*) INTO missing_legacy_table_privilege_count
  FROM publishing_required_legacy_table_privileges required
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_class legacy_table
    JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_table.relnamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(legacy_table.relacl, acldefault('r', legacy_table.relowner))
    ) privilege
    WHERE legacy_namespace.nspname = 'public'
      AND legacy_table.relkind = 'r'
      AND legacy_table.relname = required.table_name
      AND privilege.grantee = target_role_oid
      AND privilege.privilege_type = required.privilege_type
      AND NOT privilege.is_grantable
  );

  SELECT count(*) INTO legacy_object_owner_count
  FROM (
    SELECT legacy_table.oid
    FROM pg_class legacy_table
    JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_table.relnamespace
    WHERE legacy_namespace.nspname = 'public'
      AND legacy_table.relkind = 'r'
      AND legacy_table.relname IN (
        SELECT table_name FROM publishing_required_legacy_table_privileges
      )
      AND legacy_table.relowner = target_role_oid
    UNION ALL
    SELECT legacy_sequence.oid
    FROM pg_class legacy_sequence
    JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_sequence.relnamespace
    WHERE legacy_namespace.nspname = 'public'
      AND legacy_sequence.relkind = 'S'
      AND legacy_sequence.relname = 'blog_posts_id_seq'
      AND legacy_sequence.relowner = target_role_oid
  ) owned_legacy_objects;

  SELECT count(*) INTO public_legacy_table_privilege_count
  FROM publishing_required_legacy_table_privileges required
  WHERE EXISTS (
    SELECT 1
    FROM pg_class legacy_table
    JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_table.relnamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(legacy_table.relacl, acldefault('r', legacy_table.relowner))
    ) privilege
    WHERE legacy_namespace.nspname = 'public'
      AND legacy_table.relkind = 'r'
      AND legacy_table.relname = required.table_name
      AND privilege.grantee = 0
      AND privilege.privilege_type = required.privilege_type
  );

  SELECT count(*) INTO grantable_legacy_table_privilege_count
  FROM pg_class legacy_table
  JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_table.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(legacy_table.relacl, acldefault('r', legacy_table.relowner))
  ) privilege
  WHERE legacy_namespace.nspname = 'public'
    AND legacy_table.relkind = 'r'
    AND legacy_table.relname IN (
      SELECT table_name FROM publishing_required_legacy_table_privileges
    )
    AND privilege.grantee = target_role_oid
    AND privilege.is_grantable;

  SELECT count(*) INTO unsafe_legacy_table_privilege_count
  FROM pg_class legacy_table
  JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_table.relnamespace
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
  WHERE legacy_namespace.nspname = 'public'
    AND legacy_table.relkind = 'r'
    AND legacy_table.relname IN (
      SELECT table_name FROM publishing_required_legacy_table_privileges
    )
    AND has_table_privilege(target_role, legacy_table.oid, checked.privilege_type);

  SELECT count(*) INTO missing_legacy_sequence_privilege_count
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_class legacy_sequence
    JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_sequence.relnamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(legacy_sequence.relacl, acldefault('s', legacy_sequence.relowner))
    ) privilege
    WHERE legacy_namespace.nspname = 'public'
      AND legacy_sequence.relkind = 'S'
      AND legacy_sequence.relname = 'blog_posts_id_seq'
      AND privilege.grantee = target_role_oid
      AND privilege.privilege_type = 'USAGE'
      AND NOT privilege.is_grantable
  );

  SELECT count(*) INTO public_legacy_sequence_privilege_count
  WHERE EXISTS (
    SELECT 1
    FROM pg_class legacy_sequence
    JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_sequence.relnamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(legacy_sequence.relacl, acldefault('s', legacy_sequence.relowner))
    ) privilege
    WHERE legacy_namespace.nspname = 'public'
      AND legacy_sequence.relkind = 'S'
      AND legacy_sequence.relname = 'blog_posts_id_seq'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'USAGE'
  );

  SELECT count(*) INTO grantable_legacy_sequence_privilege_count
  FROM pg_class legacy_sequence
  JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_sequence.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(legacy_sequence.relacl, acldefault('s', legacy_sequence.relowner))
  ) privilege
  WHERE legacy_namespace.nspname = 'public'
    AND legacy_sequence.relkind = 'S'
    AND legacy_sequence.relname = 'blog_posts_id_seq'
    AND privilege.grantee = target_role_oid
    AND privilege.is_grantable;

  SELECT count(*) INTO unsafe_legacy_sequence_privilege_count
  FROM pg_class legacy_sequence
  JOIN pg_namespace legacy_namespace ON legacy_namespace.oid = legacy_sequence.relnamespace
  CROSS JOIN (VALUES ('UPDATE')) checked(privilege_type)
  WHERE legacy_namespace.nspname = 'public'
    AND legacy_sequence.relkind = 'S'
    AND legacy_sequence.relname = 'blog_posts_id_seq'
    AND has_sequence_privilege(target_role, legacy_sequence.oid, checked.privilege_type);

  IF missing_legacy_table_privilege_count <> 0
    OR missing_legacy_sequence_privilege_count <> 0
    OR legacy_object_owner_count <> 0
    OR public_legacy_table_privilege_count <> 0
    OR public_legacy_sequence_privilege_count <> 0
    OR grantable_legacy_table_privilege_count <> 0
    OR grantable_legacy_sequence_privilege_count <> 0
    OR unsafe_legacy_table_privilege_count <> 0
    OR unsafe_legacy_sequence_privilege_count <> 0
  THEN
    RAISE EXCEPTION 'Publishing runtime role requires safe direct existing CMS privileges without ownership, PUBLIC access, grant option, or DDL access';
  END IF;

  WITH RECURSIVE reachable_roles(roleid) AS (
    SELECT roleid FROM pg_auth_members WHERE member = target_role_oid
    UNION
    SELECT membership.roleid
    FROM pg_auth_members membership
    JOIN reachable_roles reachable ON membership.member = reachable.roleid
  )
  SELECT count(*) INTO role_membership_count FROM reachable_roles;

  IF role_membership_count <> 0 THEN
    RAISE EXCEPTION 'Publishing runtime role must have no inherited or SET ROLE membership path';
  END IF;

  IF has_schema_privilege(target_role, 'public', 'USAGE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Publishing runtime role requires its existing public schema USAGE privilege';
  END IF;

  IF has_schema_privilege(target_role, 'public', 'CREATE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Publishing runtime role must not have CREATE on the public schema';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute column_definition
    JOIN pg_class table_class ON table_class.oid = column_definition.attrelid
    JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_class.relkind = 'r'
      AND table_class.relname LIKE 'publishing!_%' ESCAPE '!'
      AND column_definition.attnum > 0
      AND NOT column_definition.attisdropped
      AND column_definition.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Publishing runtime grants require no column-level Publishing ACLs';
  END IF;

  SELECT count(DISTINCT table_name) INTO expected_table_count
  FROM publishing_expected_table_privileges;

  SELECT count(*) INTO publishing_table_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND table_class.relname LIKE 'publishing!_%' ESCAPE '!';

  IF expected_table_count <> 11 OR publishing_table_count <> expected_table_count THEN
    RAISE EXCEPTION 'Publishing runtime grants require exactly 11 Publishing tables; found %', publishing_table_count;
  END IF;

  SELECT count(*) INTO unexpected_table_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND table_class.relname LIKE 'publishing!_%' ESCAPE '!'
    AND NOT EXISTS (
      SELECT 1 FROM publishing_expected_table_privileges expected
      WHERE expected.table_name = table_class.relname
    );

  IF unexpected_table_count <> 0 THEN
    RAISE EXCEPTION 'Publishing runtime grants found an unexpected Publishing table';
  END IF;

  SELECT count(*) INTO expected_table_owner_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND table_class.relowner = migration_role_oid
    AND EXISTS (
      SELECT 1 FROM publishing_expected_table_privileges expected
      WHERE expected.table_name = table_class.relname
    );

  IF expected_table_owner_count <> expected_table_count THEN
    RAISE EXCEPTION 'Publishing runtime grants require the migration role to own every Publishing table';
  END IF;

  SELECT count(*) INTO publishing_row_security_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND (table_class.relrowsecurity OR table_class.relforcerowsecurity)
    AND EXISTS (
      SELECT 1 FROM publishing_expected_table_privileges expected
      WHERE expected.table_name = table_class.relname
    );

  IF publishing_row_security_count <> 0 THEN
    RAISE EXCEPTION 'Publishing runtime grants require no row security on Publishing tables';
  END IF;

  SELECT count(DISTINCT sequence_name) INTO expected_sequence_count
  FROM publishing_expected_sequence_privileges;

  SELECT count(*) INTO publishing_sequence_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND sequence_class.relname LIKE 'publishing!_%' ESCAPE '!';

  IF expected_sequence_count <> 2 OR publishing_sequence_count <> expected_sequence_count THEN
    RAISE EXCEPTION 'Publishing runtime grants require exactly two Publishing identity sequences';
  END IF;

  SELECT count(*) INTO unexpected_sequence_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND sequence_class.relname LIKE 'publishing!_%' ESCAPE '!'
    AND NOT EXISTS (
      SELECT 1 FROM publishing_expected_sequence_privileges expected
      WHERE expected.sequence_name = sequence_class.relname
    );

  IF unexpected_sequence_count <> 0 THEN
    RAISE EXCEPTION 'Publishing runtime grants found an unexpected Publishing sequence';
  END IF;

  SELECT count(*) INTO expected_sequence_owner_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND sequence_class.relowner = migration_role_oid
    AND EXISTS (
      SELECT 1 FROM publishing_expected_sequence_privileges expected
      WHERE expected.sequence_name = sequence_class.relname
    );

  IF expected_sequence_owner_count <> expected_sequence_count THEN
    RAISE EXCEPTION 'Publishing runtime grants require the migration role to own every Publishing sequence';
  END IF;

  SELECT count(*) INTO audit_function_count
  FROM pg_proc function_definition
  JOIN pg_namespace function_namespace ON function_namespace.oid = function_definition.pronamespace
  WHERE function_namespace.nspname = 'public'
    AND function_definition.proname = 'publishing_audit_events_append_only'
    AND function_definition.pronargs = 0
    AND function_definition.prorettype = 'trigger'::regtype
    AND function_definition.proowner = migration_role_oid
    AND function_definition.prosecdef = false
    AND regexp_replace(lower(function_definition.prosrc), '[[:space:]]+', '', 'g') =
      regexp_replace(lower($body$
        BEGIN
          IF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION 'publishing_audit_events are append-only';
          END IF;
          IF OLD.created_at >= now() - interval '365 days' THEN
            RAISE EXCEPTION 'publishing_audit_events must be retained for at least 365 days';
          END IF;
          RETURN OLD;
        END;
      $body$), '[[:space:]]+', '', 'g');

  IF audit_function_count <> 1 THEN
    RAISE EXCEPTION 'Publishing runtime grants require the reviewed immutable audit function';
  END IF;

  SELECT count(*) INTO audit_trigger_total_count
  FROM pg_trigger
  WHERE tgrelid = 'public.publishing_audit_events'::regclass
    AND NOT tgisinternal;

  SELECT count(*) INTO audit_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.publishing_audit_events'::regclass
    AND tgname = 'publishing_audit_events_append_only_trigger'
    AND NOT tgisinternal
    AND tgenabled = 'O'
    AND tgtype = 27
    AND tgfoid = 'public.publishing_audit_events_append_only()'::regprocedure;

  IF audit_trigger_total_count <> 1 OR audit_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Publishing runtime grants require the reviewed enabled append-only audit trigger';
  END IF;

  SELECT count(*) INTO public_table_grant_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(table_class.relacl, acldefault('r', table_class.relowner))) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND privilege.grantee = 0
    AND EXISTS (
      SELECT 1 FROM publishing_expected_table_privileges expected
      WHERE expected.table_name = table_class.relname
    );

  SELECT count(*) INTO public_sequence_grant_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))) privilege
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND privilege.grantee = 0
    AND EXISTS (
      SELECT 1 FROM publishing_expected_sequence_privileges expected
      WHERE expected.sequence_name = sequence_class.relname
    );

  IF public_table_grant_count <> 0 OR public_sequence_grant_count <> 0 THEN
    RAISE EXCEPTION 'Publishing runtime grants require no PUBLIC table or sequence grants';
  END IF;

  SELECT count(*) INTO target_table_acl_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(table_class.relacl, acldefault('r', table_class.relowner))) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND privilege.grantee = target_role_oid
    AND EXISTS (
      SELECT 1 FROM publishing_expected_table_privileges expected
      WHERE expected.table_name = table_class.relname
    );

  SELECT count(*) INTO target_sequence_acl_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))) privilege
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND privilege.grantee = target_role_oid
    AND EXISTS (
      SELECT 1 FROM publishing_expected_sequence_privileges expected
      WHERE expected.sequence_name = sequence_class.relname
    );

  SELECT count(*) INTO table_acl_diff_count
  FROM (
    (
      SELECT table_class.relname::text AS object_name,
        privilege.privilege_type::text, privilege.is_grantable, privilege.grantor
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(table_class.relacl, acldefault('r', table_class.relowner))) privilege
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
      EXCEPT
      SELECT expected.table_name::text, expected.privilege_type, false, migration_role_oid
      FROM publishing_expected_table_privileges expected
    )
    UNION ALL
    (
      SELECT expected.table_name::text, expected.privilege_type, false, migration_role_oid
      FROM publishing_expected_table_privileges expected
      EXCEPT
      SELECT table_class.relname::text, privilege.privilege_type::text,
        privilege.is_grantable, privilege.grantor
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(table_class.relacl, acldefault('r', table_class.relowner))) privilege
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
    )
  ) differences;

  SELECT count(*) INTO sequence_acl_diff_count
  FROM (
    (
      SELECT sequence_class.relname::text AS object_name,
        privilege.privilege_type::text, privilege.is_grantable, privilege.grantor
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))) privilege
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
      EXCEPT
      SELECT expected.sequence_name::text, expected.privilege_type, false, migration_role_oid
      FROM publishing_expected_sequence_privileges expected
    )
    UNION ALL
    (
      SELECT expected.sequence_name::text, expected.privilege_type, false, migration_role_oid
      FROM publishing_expected_sequence_privileges expected
      EXCEPT
      SELECT sequence_class.relname::text, privilege.privilege_type::text,
        privilege.is_grantable, privilege.grantor
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))) privilege
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
    )
  ) differences;

  SELECT count(*) INTO table_effective_privilege_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND EXISTS (
      SELECT 1 FROM publishing_expected_table_privileges expected
      WHERE expected.table_name = table_class.relname
    )
    AND has_table_privilege(target_role, table_class.oid, checked.privilege_type);

  SELECT count(*) INTO sequence_effective_privilege_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) checked(privilege_type)
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND EXISTS (
      SELECT 1 FROM publishing_expected_sequence_privileges expected
      WHERE expected.sequence_name = sequence_class.relname
    )
    AND has_sequence_privilege(target_role, sequence_class.oid, checked.privilege_type);

  SELECT count(*) INTO table_effective_diff_count
  FROM (
    (
      SELECT table_class.relname::text, checked.privilege_type
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
        AND has_table_privilege(target_role, table_class.oid, checked.privilege_type)
      EXCEPT
      SELECT table_name::text, privilege_type FROM publishing_expected_table_privileges
    )
    UNION ALL
    (
      SELECT table_name::text, privilege_type FROM publishing_expected_table_privileges
      EXCEPT
      SELECT table_class.relname::text, checked.privilege_type
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
        AND has_table_privilege(target_role, table_class.oid, checked.privilege_type)
    )
  ) differences;

  SELECT count(*) INTO sequence_effective_diff_count
  FROM (
    (
      SELECT sequence_class.relname::text, checked.privilege_type
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) checked(privilege_type)
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
        AND has_sequence_privilege(target_role, sequence_class.oid, checked.privilege_type)
      EXCEPT
      SELECT sequence_name::text, privilege_type FROM publishing_expected_sequence_privileges
    )
    UNION ALL
    (
      SELECT sequence_name::text, privilege_type FROM publishing_expected_sequence_privileges
      EXCEPT
      SELECT sequence_class.relname::text, checked.privilege_type
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) checked(privilege_type)
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
        AND has_sequence_privilege(target_role, sequence_class.oid, checked.privilege_type)
    )
  ) differences;

  IF target_table_acl_count = 0 AND target_sequence_acl_count = 0 THEN
    IF table_effective_privilege_count <> 0 OR sequence_effective_privilege_count <> 0 THEN
      RAISE EXCEPTION 'Publishing runtime grants found unexpected effective privileges';
    END IF;
  ELSIF table_acl_diff_count = 0
    AND sequence_acl_diff_count = 0
    AND table_effective_diff_count = 0
    AND sequence_effective_diff_count = 0
  THEN
    NULL; -- Exact desired state: safe idempotent rerun.
  ELSE
    RAISE EXCEPTION 'Publishing runtime grants require either zero privileges or the exact desired ACL state';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.publishing_machine_identities,
  public.publishing_identity_capabilities,
  public.publishing_credentials,
  public.publishing_managed_media,
  public.publishing_rate_limit_windows
TO :"runtime_role";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.publishing_identity_ip_allowlist,
  public.publishing_idempotency_records
TO :"runtime_role";

GRANT SELECT, INSERT, DELETE ON TABLE
  public.publishing_blog_post_media
TO :"runtime_role";

GRANT SELECT, UPDATE ON TABLE
  public.publishing_global_controls
TO :"runtime_role";

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.publishing_scheduler_state
TO :"runtime_role";

GRANT SELECT, INSERT ON TABLE
  public.publishing_audit_events
TO :"runtime_role";

GRANT USAGE, SELECT ON SEQUENCE
  public.publishing_identity_ip_allowlist_id_seq,
  public.publishing_audit_events_id_seq
TO :"runtime_role";

DO $$
DECLARE
  target_role name := current_setting('publishing.runtime_role')::name;
  target_role_oid oid;
  migration_role_oid oid;
  table_acl_diff_count integer;
  sequence_acl_diff_count integer;
  table_effective_diff_count integer;
  sequence_effective_diff_count integer;
BEGIN
  SELECT oid INTO target_role_oid FROM pg_roles WHERE rolname = target_role;
  SELECT oid INTO migration_role_oid FROM pg_roles WHERE rolname = current_user;

  SELECT count(*) INTO table_acl_diff_count
  FROM (
    (
      SELECT table_class.relname::text, privilege.privilege_type::text,
        privilege.is_grantable, privilege.grantor
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(table_class.relacl, acldefault('r', table_class.relowner))) privilege
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
      EXCEPT
      SELECT table_name::text, privilege_type, false, migration_role_oid
      FROM publishing_expected_table_privileges
    )
    UNION ALL
    (
      SELECT table_name::text, privilege_type, false, migration_role_oid
      FROM publishing_expected_table_privileges
      EXCEPT
      SELECT table_class.relname::text, privilege.privilege_type::text,
        privilege.is_grantable, privilege.grantor
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(table_class.relacl, acldefault('r', table_class.relowner))) privilege
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
    )
  ) differences;

  SELECT count(*) INTO sequence_acl_diff_count
  FROM (
    (
      SELECT sequence_class.relname::text, privilege.privilege_type::text,
        privilege.is_grantable, privilege.grantor
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))) privilege
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
      EXCEPT
      SELECT sequence_name::text, privilege_type, false, migration_role_oid
      FROM publishing_expected_sequence_privileges
    )
    UNION ALL
    (
      SELECT sequence_name::text, privilege_type, false, migration_role_oid
      FROM publishing_expected_sequence_privileges
      EXCEPT
      SELECT sequence_class.relname::text, privilege.privilege_type::text,
        privilege.is_grantable, privilege.grantor
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))) privilege
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND privilege.grantee = target_role_oid
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
    )
  ) differences;

  SELECT count(*) INTO table_effective_diff_count
  FROM (
    (
      SELECT table_class.relname::text, checked.privilege_type
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
        AND has_table_privilege(target_role, table_class.oid, checked.privilege_type)
      EXCEPT
      SELECT table_name::text, privilege_type FROM publishing_expected_table_privileges
    )
    UNION ALL
    (
      SELECT table_name::text, privilege_type FROM publishing_expected_table_privileges
      EXCEPT
      SELECT table_class.relname::text, checked.privilege_type
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_table_privileges expected
          WHERE expected.table_name = table_class.relname
        )
        AND has_table_privilege(target_role, table_class.oid, checked.privilege_type)
    )
  ) differences;

  SELECT count(*) INTO sequence_effective_diff_count
  FROM (
    (
      SELECT sequence_class.relname::text, checked.privilege_type
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) checked(privilege_type)
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
        AND has_sequence_privilege(target_role, sequence_class.oid, checked.privilege_type)
      EXCEPT
      SELECT sequence_name::text, privilege_type FROM publishing_expected_sequence_privileges
    )
    UNION ALL
    (
      SELECT sequence_name::text, privilege_type FROM publishing_expected_sequence_privileges
      EXCEPT
      SELECT sequence_class.relname::text, checked.privilege_type
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) checked(privilege_type)
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
        AND EXISTS (
          SELECT 1 FROM publishing_expected_sequence_privileges expected
          WHERE expected.sequence_name = sequence_class.relname
        )
        AND has_sequence_privilege(target_role, sequence_class.oid, checked.privilege_type)
    )
  ) differences;

  IF table_acl_diff_count <> 0
    OR sequence_acl_diff_count <> 0
    OR table_effective_diff_count <> 0
    OR sequence_effective_diff_count <> 0
  THEN
    RAISE EXCEPTION 'Publishing runtime grants postcondition failed';
  END IF;
END $$;

COMMIT;
