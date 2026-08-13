-- Publishing API v1 production recovery.
--
-- Immutable recovery snapshot derived from commit
-- 3f894787910eaf67ca12e89aa4e202ccbcdca704, after the root migration stopped
-- at its legacy lifecycle guard. This is deliberately outside prisma/migrations:
-- execute only with psql as described in the Publishing API v1 runbook.
--
-- Scope: exactly the observed production partial state. No ownership, role, or
-- application-runtime permission change is permitted. Any different state
-- fails before the schema transition. The transaction and exclusive locks keep
-- the preflight and DDL transition indivisible.

BEGIN;

LOCK TABLE blog_posts, blog_tags IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  publishing_table_count integer;
  publishing_function_count integer;
  publishing_trigger_count integer;
  named_index_count integer;
  named_constraint_count integer;
  partial_post_column_count integer;
  unexpected_post_publishing_column_count integer;
  partial_tag_column_count integer;
  unexpected_tag_publishing_column_count integer;
  status_constraint_count integer;
  legacy_definition text;
  author_default_is_expected boolean;
BEGIN
  SELECT count(*) INTO publishing_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'publishing_%';
  IF publishing_table_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery requires no existing Publishing tables; found %', publishing_table_count;
  END IF;

  SELECT count(*) INTO publishing_function_count
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'publishing_audit_events_append_only';
  IF publishing_function_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery requires no existing Publishing audit function';
  END IF;

  SELECT count(*) INTO publishing_trigger_count
  FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgname = 'publishing_audit_events_append_only_trigger';
  IF publishing_trigger_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery requires no existing Publishing audit trigger';
  END IF;

  SELECT count(*) INTO named_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'uq_blog_posts_publishing_external',
      'idx_blog_posts_publishing_list',
      'idx_blog_posts_publishing_status',
      'idx_blog_posts_scheduler',
      'idx_blog_tags_active_name'
    )
    OR (schemaname = 'public' AND indexname LIKE 'idx_publishing_%');
  IF named_index_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery requires no existing Publishing indexes; found %', named_index_count;
  END IF;

  SELECT count(*) INTO named_constraint_count
  FROM pg_constraint
  WHERE conrelid = 'blog_posts'::regclass
    AND conname IN ('blog_posts_publishing_identity_fkey', 'blog_posts_version_check');
  IF named_constraint_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery requires no existing Publishing blog_posts constraints';
  END IF;

  SELECT count(*) INTO partial_post_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'blog_posts'
    AND (
      (column_name = 'publishing_identity_id' AND data_type = 'uuid' AND is_nullable = 'YES' AND character_maximum_length IS NULL AND column_default IS NULL)
      OR (column_name = 'external_id' AND data_type = 'character varying' AND is_nullable = 'YES' AND character_maximum_length = 200 AND column_default IS NULL)
      OR (column_name = 'version' AND data_type = 'integer' AND is_nullable = 'NO' AND character_maximum_length IS NULL AND column_default = '1')
      OR (column_name = 'first_published_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'YES' AND column_default IS NULL)
      OR (column_name = 'scheduled_for' AND data_type = 'timestamp with time zone' AND is_nullable = 'YES' AND column_default IS NULL)
      OR (column_name = 'scheduled_timezone' AND data_type = 'character varying' AND is_nullable = 'YES' AND character_maximum_length = 100 AND column_default IS NULL)
      OR (column_name = 'scheduled_version' AND data_type = 'integer' AND is_nullable = 'YES' AND character_maximum_length IS NULL AND column_default IS NULL)
      OR (column_name = 'schedule_blocked_code' AND data_type = 'character varying' AND is_nullable = 'YES' AND character_maximum_length = 100 AND column_default IS NULL)
      OR (column_name = 'schedule_blocked_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'YES' AND column_default IS NULL)
      OR (column_name = 'schedule_last_attempt_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'YES' AND column_default IS NULL)
    );
  IF partial_post_column_count <> 10 THEN
    RAISE EXCEPTION 'Publishing recovery requires exactly the known partial blog_posts column definitions; found %', partial_post_column_count;
  END IF;

  SELECT count(*) INTO unexpected_post_publishing_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'blog_posts'
    AND column_name LIKE 'publishing_%'
    AND column_name <> 'publishing_identity_id';
  IF unexpected_post_publishing_column_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery found unexpected publishing-related blog_posts columns';
  END IF;

  SELECT count(*) INTO partial_tag_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'blog_tags'
    AND (
      (column_name = 'is_active' AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'true')
      OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND column_default = 'now()')
    );
  IF partial_tag_column_count <> 2 THEN
    RAISE EXCEPTION 'Publishing recovery requires exactly the known partial blog_tags column definitions; found %', partial_tag_column_count;
  END IF;

  SELECT count(*) INTO unexpected_tag_publishing_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'blog_tags'
    AND column_name IN ('is_active', 'updated_at')
    AND (
      (column_name = 'is_active' AND NOT (data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'true'))
      OR (column_name = 'updated_at' AND NOT (data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND column_default = 'now()'))
    );
  IF unexpected_tag_publishing_column_count <> 0 THEN
    RAISE EXCEPTION 'Publishing recovery found unexpected partial blog_tags column definitions';
  END IF;

  SELECT column_default = quote_literal('Ban Biên Tập Đông Phú Gia')
    || '::character varying'
  INTO author_default_is_expected
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'blog_posts'
    AND column_name = 'author_name';
  IF author_default_is_expected IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Publishing recovery requires the reviewed editorial byline default';
  END IF;

  SELECT count(*) INTO status_constraint_count
  FROM pg_constraint
  WHERE conrelid = 'blog_posts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF status_constraint_count <> 1 THEN
    RAISE EXCEPTION 'Publishing recovery requires exactly one blog_posts status constraint; found %', status_constraint_count;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO legacy_definition
  FROM pg_constraint
  WHERE conrelid = 'blog_posts'::regclass
    AND contype = 'c'
    AND conname = 'blog_posts_status_check';
  IF regexp_replace(lower(legacy_definition), '[[:space:]]+', '', 'g')
    IS DISTINCT FROM 'check(((status)::text=any(array[(''draft''::charactervarying)::text,(''published''::charactervarying)::text,(''scheduled''::charactervarying)::text])))'
  THEN
    RAISE EXCEPTION 'Publishing recovery requires the known legacy blog_posts lifecycle constraint';
  END IF;
END $$;

ALTER TABLE blog_posts
  DROP CONSTRAINT blog_posts_status_check,
  ADD CONSTRAINT blog_posts_status_check
    CHECK (status IN ('draft', 'scheduled', 'published', 'schedule_blocked')),
  ADD CONSTRAINT blog_posts_version_check CHECK (version >= 1);

CREATE TABLE publishing_machine_identities (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE,
  sponsor_user_id integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  disabled_at timestamptz(6),
  disabled_reason varchar(300),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT publishing_machine_identities_sponsor_fkey
    FOREIGN KEY (sponsor_user_id) REFERENCES admin_users(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE TABLE publishing_identity_capabilities (
  identity_id uuid NOT NULL,
  capability varchar(40) NOT NULL,
  granted_at timestamptz(6) NOT NULL DEFAULT now(),
  revoked_at timestamptz(6),
  PRIMARY KEY (identity_id, capability),
  CONSTRAINT publishing_identity_capabilities_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT publishing_identity_capabilities_known_check
    CHECK (capability IN ('posts:write', 'posts:publish', 'media:write'))
);

CREATE TABLE publishing_credentials (
  id uuid PRIMARY KEY,
  identity_id uuid NOT NULL,
  token_prefix varchar(32) NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  environment varchar(20) NOT NULL,
  issued_at timestamptz(6) NOT NULL DEFAULT now(),
  expires_at timestamptz(6) NOT NULL,
  last_used_at timestamptz(6),
  revoked_at timestamptz(6),
  revoke_reason varchar(300),
  rotated_from_credential_id uuid,
  CONSTRAINT publishing_credentials_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT publishing_credentials_rotated_from_fkey
    FOREIGN KEY (rotated_from_credential_id) REFERENCES publishing_credentials(id)
    ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT publishing_credentials_environment_check
    CHECK (environment IN ('staging', 'production')),
  CONSTRAINT publishing_credentials_expiry_check CHECK (expires_at > issued_at)
);

CREATE TABLE publishing_identity_ip_allowlist (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  identity_id uuid NOT NULL,
  ip_address varchar(45) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_publishing_identity_ip UNIQUE (identity_id, ip_address),
  CONSTRAINT publishing_identity_ip_allowlist_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE publishing_managed_media (
  id uuid PRIMARY KEY,
  identity_id uuid NOT NULL,
  purpose varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'processing',
  source_mime varchar(50) NOT NULL,
  source_bytes integer NOT NULL,
  source_sha256 char(64) NOT NULL,
  source_width integer,
  source_height integer,
  storage_path varchar(500) NOT NULL UNIQUE,
  primary_url varchar(1000) UNIQUE,
  variants jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT publishing_managed_media_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT publishing_managed_media_purpose_check
    CHECK (purpose IN ('thumbnail', 'cover', 'inline')),
  CONSTRAINT publishing_managed_media_status_check
    CHECK (status IN ('processing', 'ready', 'failed')),
  CONSTRAINT publishing_managed_media_size_check CHECK (source_bytes > 0)
);

CREATE TABLE publishing_blog_post_media (
  post_id integer NOT NULL,
  media_id uuid NOT NULL,
  usage varchar(20) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, media_id, usage),
  CONSTRAINT publishing_blog_post_media_post_fkey
    FOREIGN KEY (post_id) REFERENCES blog_posts(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT publishing_blog_post_media_media_fkey
    FOREIGN KEY (media_id) REFERENCES publishing_managed_media(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT publishing_blog_post_media_usage_check
    CHECK (usage IN ('thumbnail', 'cover', 'inline'))
);

CREATE TABLE publishing_idempotency_records (
  id uuid PRIMARY KEY,
  identity_id uuid NOT NULL,
  key_hash char(64) NOT NULL,
  request_hash char(64) NOT NULL,
  operation varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'in_progress',
  response_status integer,
  safe_response jsonb,
  resource_type varchar(40),
  resource_id varchar(200),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  completed_at timestamptz(6),
  expires_at timestamptz(6) NOT NULL,
  CONSTRAINT uq_publishing_idempotency_identity_key UNIQUE (identity_id, key_hash),
  CONSTRAINT publishing_idempotency_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT publishing_idempotency_status_check
    CHECK (status IN ('in_progress', 'completed'))
);

CREATE TABLE publishing_rate_limit_windows (
  identity_id uuid NOT NULL,
  bucket varchar(20) NOT NULL,
  window_start timestamptz(6) NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_id, bucket, window_start),
  CONSTRAINT publishing_rate_limit_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT publishing_rate_limit_bucket_check CHECK (bucket IN ('json', 'media')),
  CONSTRAINT publishing_rate_limit_count_check CHECK (request_count >= 0)
);

CREATE TABLE publishing_global_controls (
  id integer PRIMARY KEY DEFAULT 1,
  publishing_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_by_user_id integer,
  CONSTRAINT publishing_global_controls_singleton_check CHECK (id = 1),
  CONSTRAINT publishing_global_controls_version_check CHECK (version >= 1)
);

CREATE TABLE publishing_scheduler_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_started_at timestamptz(6),
  last_completed_at timestamptz(6),
  last_success_at timestamptz(6),
  last_run_id uuid,
  last_result_code varchar(80),
  last_processed_count integer NOT NULL DEFAULT 0,
  last_published_count integer NOT NULL DEFAULT 0,
  last_blocked_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT publishing_scheduler_state_singleton_check CHECK (id = 1)
);

CREATE TABLE publishing_audit_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_kind varchar(20) NOT NULL,
  identity_id uuid,
  admin_actor_id integer,
  sponsor_user_id integer,
  action varchar(100) NOT NULL,
  post_id integer,
  external_id varchar(200),
  request_id uuid,
  idempotency_key_hash char(64),
  from_version integer,
  to_version integer,
  from_state varchar(30),
  to_state varchar(30),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  content_hash char(64),
  metadata jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT publishing_audit_events_identity_fkey
    FOREIGN KEY (identity_id) REFERENCES publishing_machine_identities(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT publishing_audit_events_admin_fkey
    FOREIGN KEY (admin_actor_id) REFERENCES admin_users(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT publishing_audit_events_post_fkey
    FOREIGN KEY (post_id) REFERENCES blog_posts(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT publishing_audit_events_actor_kind_check
    CHECK (actor_kind IN ('machine', 'scheduler', 'admin'))
);

ALTER TABLE blog_posts
  ADD CONSTRAINT blog_posts_publishing_identity_fkey
  FOREIGN KEY (publishing_identity_id) REFERENCES publishing_machine_identities(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX uq_blog_posts_publishing_external
  ON blog_posts (publishing_identity_id, external_id);
CREATE INDEX idx_blog_posts_publishing_list
  ON blog_posts (publishing_identity_id, updated_at DESC, id DESC);
CREATE INDEX idx_blog_posts_publishing_status
  ON blog_posts (publishing_identity_id, status, updated_at DESC, id DESC);
CREATE INDEX idx_blog_posts_scheduler
  ON blog_posts (status, scheduled_for, id);
CREATE INDEX idx_blog_tags_active_name
  ON blog_tags (is_active, name);
CREATE INDEX idx_publishing_identities_sponsor
  ON publishing_machine_identities (sponsor_user_id);
CREATE INDEX idx_publishing_identities_active
  ON publishing_machine_identities (is_active);
CREATE INDEX idx_publishing_capabilities_active
  ON publishing_identity_capabilities (capability, revoked_at);
CREATE INDEX idx_publishing_credentials_identity
  ON publishing_credentials (identity_id, environment, expires_at);
CREATE INDEX idx_publishing_credentials_expiry
  ON publishing_credentials (expires_at, revoked_at);
CREATE INDEX idx_publishing_media_identity_status
  ON publishing_managed_media (identity_id, status);
CREATE INDEX idx_publishing_media_created
  ON publishing_managed_media (created_at);
CREATE INDEX idx_publishing_post_media_asset
  ON publishing_blog_post_media (media_id);
CREATE INDEX idx_publishing_post_media_usage
  ON publishing_blog_post_media (post_id, usage);
CREATE INDEX idx_publishing_idempotency_expiry
  ON publishing_idempotency_records (expires_at);
CREATE INDEX idx_publishing_idempotency_resource
  ON publishing_idempotency_records (resource_type, resource_id);
CREATE INDEX idx_publishing_rate_window_cleanup
  ON publishing_rate_limit_windows (window_start);
CREATE INDEX idx_publishing_audit_created
  ON publishing_audit_events (created_at DESC);
CREATE INDEX idx_publishing_audit_identity
  ON publishing_audit_events (identity_id, created_at DESC);
CREATE INDEX idx_publishing_audit_post
  ON publishing_audit_events (post_id, created_at DESC);
CREATE INDEX idx_publishing_audit_request
  ON publishing_audit_events (request_id);

-- Audit provenance is append-only. Retention cleanup may delete only records
-- older than 365 days; updates are never allowed. The application role does
-- not expose an audit mutation path.
CREATE FUNCTION publishing_audit_events_append_only()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'publishing_audit_events are append-only';
  END IF;
  IF OLD.created_at >= now() - interval '365 days' THEN
    RAISE EXCEPTION 'publishing_audit_events must be retained for at least 365 days';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER publishing_audit_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON publishing_audit_events
  FOR EACH ROW EXECUTE FUNCTION publishing_audit_events_append_only();

INSERT INTO publishing_global_controls (id, publishing_enabled, version)
VALUES (1, false, 1);

INSERT INTO publishing_scheduler_state (id)
VALUES (1);

COMMIT;
