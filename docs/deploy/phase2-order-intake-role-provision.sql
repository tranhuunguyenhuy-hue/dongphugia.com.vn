-- Source-only bootstrap for Phase 2's least-privilege database caller.
-- Execute only as the approved database owner on the exact Preview target.
-- The credential input is a SCRAM verifier in an owner-only environment
-- variable; raw passwords never enter the SQL, command line, logs, or PR.

\set ON_ERROR_STOP on
\getenv intake_password_verifier PHASE2_ORDER_INTAKE_PASSWORD_VERIFIER
\if :{?intake_password_verifier}
\else
  \echo 'Set PHASE2_ORDER_INTAKE_PASSWORD_VERIFIER in the owner-only environment to a SCRAM-SHA-256 verifier'
  SELECT 1 / 0;
\endif

BEGIN;

SET LOCAL phase2.order_intake_password_verifier TO :'intake_password_verifier';
SET LOCAL search_path = pg_catalog, public, dpg_control;

DO $$
DECLARE
  verifier text := current_setting('phase2.order_intake_password_verifier');
BEGIN
  IF verifier !~ '^SCRAM-SHA-256\$[0-9]+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$' THEN
    RAISE EXCEPTION 'Phase 2 order-intake role requires a SCRAM-SHA-256 verifier';
  END IF;

  IF to_regclass('dpg_control.target_contract') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM dpg_control.target_contract
       WHERE singleton
         AND project_name = 'dongphugia-runtime'
         AND region = 'ap-southeast-1'
         AND environment = 'preview'
         AND data_class = 'production-derived-reduced-runtime'
         AND production_data_allowed
         AND NOT production_credentials_allowed
         AND NOT production_writes_allowed
         AND hard_database_ceiling_bytes = 367001600
         AND pg_database_size(current_database()) <= hard_database_ceiling_bytes
     ) THEN
    RAISE EXCEPTION 'DPG_PHASE2_TARGET_CONTRACT_FAILED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname IN (
      'dpg_order_intake_function_owner',
      'dpg_order_intake',
      'dpg_order_intake_login'
    )
  ) THEN
    RAISE EXCEPTION 'Phase 2 order-intake roles must be absent before bootstrap';
  END IF;

  EXECUTE 'CREATE ROLE dpg_order_intake_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0';
  EXECUTE 'CREATE ROLE dpg_order_intake NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0';
  EXECUTE format(
    'CREATE ROLE dpg_order_intake_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD %L',
    verifier
  );
  GRANT dpg_order_intake TO dpg_order_intake_login;
  ALTER ROLE dpg_order_intake_login SET application_name = 'dpg-order-intake';
  ALTER ROLE dpg_order_intake_login SET statement_timeout = '15s';
  ALTER ROLE dpg_order_intake_login SET lock_timeout = '3s';
  ALTER ROLE dpg_order_intake_login SET idle_in_transaction_session_timeout = '15s';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = 'dpg_order_intake_function_owner'
         AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
         AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
         AND rolconnlimit = 0
     )
     OR EXISTS (
       SELECT 1 FROM pg_auth_members membership
       WHERE membership.roleid = (SELECT oid FROM pg_roles WHERE rolname = 'dpg_order_intake_function_owner')
          OR membership.member = (SELECT oid FROM pg_roles WHERE rolname = 'dpg_order_intake_function_owner')
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = 'dpg_order_intake'
         AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
         AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
         AND rolconnlimit = 0
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = 'dpg_order_intake_login'
         AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
         AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
         AND rolconnlimit = 5
     )
     OR (SELECT count(*) FROM pg_auth_members
         WHERE member = (SELECT oid FROM pg_roles WHERE rolname = 'dpg_order_intake_login')) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_auth_members membership
       JOIN pg_roles capability ON capability.oid = membership.roleid
       JOIN pg_roles login ON login.oid = membership.member
       WHERE capability.rolname = 'dpg_order_intake'
         AND login.rolname = 'dpg_order_intake_login'
     ) THEN
    RAISE EXCEPTION 'DPG_PHASE2_INTAKE_ROLE_BOOTSTRAP_POSTFLIGHT_FAILED';
  END IF;
END $$;

COMMIT;
