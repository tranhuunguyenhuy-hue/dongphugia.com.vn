# Supabase Preview backup-role bootstrap

Status: task-owned source procedure for Issue #270. This one-time bootstrap
does not authorize backup credential creation, a backup run, restore, Phase 2
schema, Production, DNS, or traffic.

## Owner-approved scope

The Owner approved bootstrapping only the two existing backup prerequisite
migrations on the exact `dongphugia-runtime` Preview project:

1. `20260828183000_leo542_backup_role_prerequisite.sql`
2. `20260828183200_leo540_backup_coverage_prerequisite.sql`

The protected workflow also adopts the exact seven-migration runtime checkpoint
into `dpg_control.runtime_migration_ledger` with checked-out SHA-256 values.
The ledger is control metadata, not catalogue or customer data. Each of the two
pending migrations and its ledger row commit together in a serializable
transaction. The workflow stops at the nine-entry prefix and rejects any
ledger already beyond it.

The migrations create the passwordless `dpg_backup` role and grant SELECT-only
coverage on the exact nine prerequisite tables. Four Product/Family boundary
tables receive SELECT-only grants to `dpg_readonly`. No rows are imported or
updated. The workflow does not create `dpg_backup_login`, set a password, read
or write a secret, or run the backup job.

The runner also requires `dpg_backup_login` to be absent before it starts. This
prevents a partially configured credential role from gaining access during the
bootstrap.

## Exact target and gates

- Supabase organization: `ymjvuwefhqqlymwlocqn` (Free).
- Project: `dongphugia-runtime`, ref `bonxyxluzlxfkdetryoo`.
- Region: `ap-southeast-1`; expected health: `ACTIVE_HEALTHY`.
- Database target must pass the existing exact URL parser and exact target
  contract, PostgreSQL 17, and the strict 350 MiB size ceiling.
- Owner scope is durably recorded on Issue #270. The workflow requires that
  exact Owner-authored approval marker, the open Issue, a manual dispatch by
  the Owner from `main`, and the exact merged source SHA.
- The standing scope marker does not authorize execution on a future source
  revision. Each run also requires a new Owner-authored Issue #270 comment
  created after the exact PR merge time, with one line in this form:
  `BACKUP-BOOTSTRAP-EXECUTE: sha=<40-character-merged-sha> prefix=<absent|7|8|9> nonce=<32-lowercase-hex>`.
  Dispatch must provide that comment's exact ID and the same SHA and prefix.
  Preflight verifies the comment author, unchanged creation/update timestamp,
  SHA, and approved prefix, then claims both the comment ID and nonce with a
  run/attempt comment before the database job starts. A claimed ID or nonce
  can never be reused; each retry needs a new exact Owner comment and a new
  workflow dispatch. GitHub job/workflow re-runs are rejected so they cannot
  skip the preflight claim. The current Project Owner must dispatch the
  workflow from `main`.
- `expected_ledger_prefix` must match the pre-run custom ledger state:
  `absent`, `7`, `8`, or `9`. A retry is a separate Owner decision using the
  exact observed prefix. A non-prefix, checksum mismatch, schema drift, or
  unexpected later migration fails closed.
- Before ledger adoption, the runner replays the seven pinned checkpoint
  migrations in local network-disabled PostgreSQL and compares the normalized
  schema dump with the exact remote checkpoint.

The workflow uses only the existing `runtime-backup` GitHub Actions environment,
its exact-target database URL, and a read-only Supabase Management token. The
token needs only Organization Settings (Read) for the organization plan and
Organization Projects (Read) for the scoped `/v1/organizations/{slug}/projects`
lookup; it does not need account-wide project access or database permissions.
The organization-scoped check uses the same endpoint and shared response
validator in the bootstrap and in the separate read-only
`supabase-management-token-preflight.yml` workflow. The v1 response must contain
a `projects` array and `pagination` object; organization identity is bound by
the request path. The preflight never reads a database URL, connects to
Postgres, consumes a bootstrap approval, or applies migrations. Its success
only records that its requests were GET-only; the token's full granted scopes
are not inferred. The bootstrap does not require the expired catalogue artifact
because it neither decrypts nor restores a backup.

## Acceptance and recovery

The runner accepts only the exact nine-entry ledger prefix and verifies the
backup role remains NOLOGIN, has no role memberships, owns no objects, has no
default privileges or role settings, and has only the exact SELECT grants and
policies. It scans all direct ACL catalogs, rejects every other direct ACL and
policy on the nine protected tables, rejects effective read/write privileges
on non-system tables outside the nine-table allowlist, and rejects effective
access to other sequences. It verifies the four `dpg_readonly` SELECT grants
and database size. The workflow summary reports the number of
migrations applied for the approved starting prefix (`absent`/`7`: two, `8`:
one, `9`: zero). Logs and summary contain no row data, connection URL, or
secret.

If either migration fails, stop and preserve the exact workflow run, source
SHA, observed ledger prefix, failed migration, and sanitized reason. The active
migration transaction rolls back; earlier committed entries remain. Do not
reset the database, edit the ledger, or automatically retry. An authorized
Owner may separately approve resuming the exact contiguous prefix. No down
migration is run by this procedure.

After a successful bootstrap, any backup login and credential must be
configured through the protected secret process as a separate action. A fresh
backup, checksum/private-copy verification, and restore rehearsal remain
separate gates before any later schema/data work.

## Read-only database connection diagnostic

After run `41996633354` failed with the sanitized `database_operation_failed`,
use `supabase-database-preflight.yml` from exact merged `main`, supplying
`approved_source_sha`. This Owner-only, attempt-one workflow uses the existing
`runtime-backup` Environment and database URL. It shares bootstrap concurrency
so the diagnostic cannot overlap a bootstrap run.

The diagnostic reports only connection type, phase, allowlisted error code,
aggregate target checks and observed ledger entry count (`absent`, 7, 8 or 9).
A successful count is an observation, not validation of ledger checksums or
permission to resume migrations. Unknown errors remain UNCLASSIFIED; messages,
stacks, SQL details, credentials, hostnames and row contents are never printed.
It uses the same target parser and TLS behavior as the migration runner,
bounded connection/query timeouts, a READ ONLY transaction, and rollback.
It does not invoke the migration runner or create any role or ledger.
A successful diagnostic does not establish schema equivalence or complete
bootstrap acceptance. Bootstrap retry still requires a fresh Owner comment
for the exact source and independently verified prefix.

The shared Node target parser now supplies the pinned official Supabase CA
with `rejectUnauthorized: true`. The CA provenance/fingerprint is recorded in
`scripts/backup/certificates/README.md`. This addresses the connection-phase
`SELF_SIGNED_CERT_IN_CHAIN` observed in diagnostic run `41999982149` without
changing database credentials or disabling certificate/hostname verification.
The psql/pg_dump wrappers retain their existing behavior; this bounded repair
changes only the Node PostgreSQL client trust configuration.
