-- Provisioning artifact for the dedicated Publishing API v1 database runtime
-- role. Invoke through the owner/migration path with `runtime_role`; psql reads
-- a SCRAM password verifier from the owner-only
-- PUBLISHING_RUNTIME_PASSWORD_VERIFIER environment variable. Raw passwords
-- must never enter psql variables, command arguments, SQL text, or database
-- logs.
-- It creates a new non-owner login and never changes an existing role, owner,
-- DDL privilege, PUBLIC ACL, or the CMS-wide DATABASE_URL role.

\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \echo 'Publishing runtime role provisioning requires --set=runtime_role=<dedicated-login-role>'
  SELECT 1 / 0;
\endif
\getenv runtime_password_verifier PUBLISHING_RUNTIME_PASSWORD_VERIFIER
\if :{?runtime_password_verifier}
\else
  \echo 'Publishing runtime role provisioning requires PUBLISHING_RUNTIME_PASSWORD_VERIFIER=<SCRAM-verifier> in the owner-only environment'
  SELECT 1 / 0;
\endif

BEGIN;

SET LOCAL publishing.runtime_role TO :'runtime_role';
SET LOCAL publishing.runtime_password_verifier TO :'runtime_password_verifier';
SET LOCAL search_path = pg_catalog, public;

DO $$
DECLARE
  target_role name := current_setting('publishing.runtime_role')::name;
  target_password_verifier text := current_setting('publishing.runtime_password_verifier');
BEGIN
  IF target_role !~ '^[a-z][a-z0-9_]{2,62}$'
    OR target_password_verifier !~ '^SCRAM-SHA-256\$[0-9]+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'
  THEN
    RAISE EXCEPTION 'Publishing runtime role provisioning received an invalid role name or SCRAM verifier';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
    RAISE EXCEPTION 'Publishing runtime role must not already exist';
  END IF;

  EXECUTE format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
    target_role,
    target_password_verifier
  );
END $$;

GRANT USAGE ON SCHEMA public TO :"runtime_role";

-- Existing CMS objects: the complete surface used by Publishing v1 routes and
-- the one-shot scheduler. Publishing-table ACLs are granted separately by the
-- reviewed runtime-grants artifact.
GRANT SELECT ON TABLE public.blog_categories TO :"runtime_role";

GRANT SELECT ON TABLE public.blog_tags TO :"runtime_role";
GRANT UPDATE (post_count) ON TABLE public.blog_tags TO :"runtime_role";
GRANT SELECT, INSERT, DELETE ON TABLE public.blog_post_tags TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE ON TABLE public.blog_posts TO :"runtime_role";
GRANT USAGE ON SEQUENCE public.blog_posts_id_seq TO :"runtime_role";

-- Last-use telemetry is the sole credential mutation the data plane needs. A
-- fixed SECURITY DEFINER function is narrower than table UPDATE and cannot
-- revoke, issue, or extend a credential.
CREATE FUNCTION public.publishing_touch_credential_last_used(
  p_credential_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.publishing_credentials
  SET last_used_at = clock_timestamp()
  WHERE id = p_credential_id
    AND (last_used_at IS NULL OR last_used_at < clock_timestamp() - interval '5 minutes')
$$;

REVOKE ALL ON FUNCTION public.publishing_touch_credential_last_used(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publishing_touch_credential_last_used(uuid) TO :"runtime_role";

DO $$
DECLARE
  target_role name := current_setting('publishing.runtime_role')::name;
  target_role_oid oid;
  target_membership_count integer;
  unsafe_table_privilege_count integer;
  unsafe_effective_table_privilege_count integer;
  unsafe_effective_sequence_privilege_count integer;
  public_cms_privilege_count integer;
  public_cms_column_privilege_count integer;
  unexpected_direct_table_privilege_count integer;
  unexpected_direct_column_privilege_count integer;
  unexpected_direct_sequence_privilege_count integer;
  actual_table_privilege_count integer;
  actual_sequence_privilege_count integer;
  tag_post_count_column_grant_count integer;
  credential_function_execute_count integer;
BEGIN
  SELECT oid INTO target_role_oid FROM pg_roles WHERE rolname = target_role;

  SELECT count(*) INTO target_membership_count
  FROM pg_auth_members
  WHERE member = target_role_oid;

  IF target_membership_count <> 0
    OR has_schema_privilege(target_role, 'public', 'USAGE') IS DISTINCT FROM true
    OR has_schema_privilege(target_role, 'public', 'CREATE') IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'Publishing runtime role provisioning postcondition failed for role membership or schema access';
  END IF;

  SELECT count(*) INTO unsafe_table_privilege_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND table_class.relname IN ('blog_categories', 'blog_tags', 'blog_post_tags', 'blog_posts')
    AND has_table_privilege(target_role, table_class.oid, checked.privilege_type);

  SELECT count(*) INTO unsafe_effective_table_privilege_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) checked(privilege_type)
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND table_class.relname IN ('blog_categories', 'blog_tags', 'blog_post_tags', 'blog_posts')
    AND has_table_privilege(target_role, table_class.oid, checked.privilege_type)
    AND NOT (
      (table_class.relname, checked.privilege_type) IN (
        ('blog_categories', 'SELECT'),
        ('blog_tags', 'SELECT'),
        ('blog_post_tags', 'SELECT'),
        ('blog_post_tags', 'INSERT'),
        ('blog_post_tags', 'DELETE'),
        ('blog_posts', 'SELECT'),
        ('blog_posts', 'INSERT'),
        ('blog_posts', 'UPDATE')
      )
      OR (table_class.relname = 'blog_tags' AND checked.privilege_type = 'UPDATE')
    );

  SELECT count(*) INTO unsafe_effective_sequence_privilege_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) checked(privilege_type)
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND sequence_class.relname = 'blog_posts_id_seq'
    AND has_sequence_privilege(target_role, sequence_class.oid, checked.privilege_type)
    AND checked.privilege_type <> 'USAGE';

  SELECT count(*) INTO public_cms_privilege_count
  FROM (
    SELECT 1
    FROM pg_class table_class
    JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(table_class.relacl, acldefault('r', table_class.relowner))
    ) privilege
    WHERE table_namespace.nspname = 'public'
      AND table_class.relkind = 'r'
      AND table_class.relname IN ('blog_categories', 'blog_tags', 'blog_post_tags', 'blog_posts')
      AND privilege.grantee = 0
    UNION ALL
    SELECT 1
    FROM pg_class sequence_class
    JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))
    ) privilege
    WHERE sequence_namespace.nspname = 'public'
      AND sequence_class.relkind = 'S'
      AND sequence_class.relname = 'blog_posts_id_seq'
      AND privilege.grantee = 0
  ) public_privileges;

  SELECT count(*) INTO public_cms_column_privilege_count
  FROM pg_attribute attribute
  JOIN pg_class table_class ON table_class.oid = attribute.attrelid
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(attribute.attacl, acldefault('c', table_class.relowner))
  ) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relname = 'blog_tags'
    AND attribute.attname = 'post_count'
    AND privilege.grantee = 0;

  SELECT count(*) INTO unexpected_direct_table_privilege_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(table_class.relacl, acldefault('r', table_class.relowner))
  ) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND table_class.relname IN ('blog_categories', 'blog_tags', 'blog_post_tags', 'blog_posts')
    AND privilege.grantee = target_role_oid
    AND (privilege.is_grantable OR (table_class.relname, privilege.privilege_type) NOT IN (
      ('blog_categories', 'SELECT'),
      ('blog_tags', 'SELECT'),
      ('blog_post_tags', 'SELECT'),
      ('blog_post_tags', 'INSERT'),
      ('blog_post_tags', 'DELETE'),
      ('blog_posts', 'SELECT'),
      ('blog_posts', 'INSERT'),
      ('blog_posts', 'UPDATE')
    ));

  SELECT count(*) INTO unexpected_direct_column_privilege_count
  FROM pg_attribute attribute
  JOIN pg_class table_class ON table_class.oid = attribute.attrelid
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(attribute.attacl, acldefault('c', table_class.relowner))
  ) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relname = 'blog_tags'
    AND privilege.grantee = target_role_oid
    AND (attribute.attname <> 'post_count'
      OR privilege.privilege_type <> 'UPDATE'
      OR privilege.is_grantable);

  SELECT count(*) INTO unexpected_direct_sequence_privilege_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))
  ) privilege
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND sequence_class.relname = 'blog_posts_id_seq'
    AND privilege.grantee = target_role_oid
    AND (privilege.is_grantable OR privilege.privilege_type <> 'USAGE');

  SELECT count(*) INTO actual_table_privilege_count
  FROM pg_class table_class
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(table_class.relacl, acldefault('r', table_class.relowner))
  ) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relkind = 'r'
    AND privilege.grantee = target_role_oid
    AND NOT privilege.is_grantable
    AND (table_class.relname, privilege.privilege_type) IN (
      ('blog_categories', 'SELECT'),
      ('blog_tags', 'SELECT'),
      ('blog_tags', 'UPDATE'),
      ('blog_post_tags', 'SELECT'),
      ('blog_post_tags', 'INSERT'),
      ('blog_post_tags', 'DELETE'),
      ('blog_posts', 'SELECT'),
      ('blog_posts', 'INSERT'),
      ('blog_posts', 'UPDATE')
    );

  SELECT count(*) INTO actual_sequence_privilege_count
  FROM pg_class sequence_class
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(sequence_class.relacl, acldefault('s', sequence_class.relowner))
  ) privilege
  WHERE sequence_namespace.nspname = 'public'
    AND sequence_class.relkind = 'S'
    AND sequence_class.relname = 'blog_posts_id_seq'
    AND privilege.grantee = target_role_oid
    AND privilege.privilege_type = 'USAGE'
    AND NOT privilege.is_grantable;

  SELECT count(*) INTO tag_post_count_column_grant_count
  FROM pg_attribute attribute
  JOIN pg_class table_class ON table_class.oid = attribute.attrelid
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(attribute.attacl, acldefault('c', table_class.relowner))) privilege
  WHERE table_namespace.nspname = 'public'
    AND table_class.relname = 'blog_tags'
    AND attribute.attname = 'post_count'
    AND privilege.grantee = target_role_oid
    AND privilege.privilege_type = 'UPDATE'
    AND NOT privilege.is_grantable;

  SELECT count(*) INTO credential_function_execute_count
  FROM pg_proc routine
  JOIN pg_namespace routine_namespace ON routine_namespace.oid = routine.pronamespace
  WHERE routine_namespace.nspname = 'public'
    AND routine.proname = 'publishing_touch_credential_last_used'
    AND routine.oid = 'public.publishing_touch_credential_last_used(uuid)'::regprocedure
    AND has_function_privilege(target_role, routine.oid, 'EXECUTE');

  IF unsafe_table_privilege_count <> 0
    OR unsafe_effective_table_privilege_count <> 0
    OR unsafe_effective_sequence_privilege_count <> 0
    OR public_cms_privilege_count <> 0
    OR public_cms_column_privilege_count <> 0
    OR unexpected_direct_table_privilege_count <> 0
    OR unexpected_direct_column_privilege_count <> 0
    OR unexpected_direct_sequence_privilege_count <> 0
    OR actual_table_privilege_count <> 8
    OR actual_sequence_privilege_count <> 1
    OR tag_post_count_column_grant_count <> 1
    OR credential_function_execute_count <> 1
  THEN
    RAISE EXCEPTION 'Publishing runtime role provisioning postcondition failed for CMS privileges';
  END IF;
END $$;

COMMIT;
