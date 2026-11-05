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

## Exact target and gates

- Supabase organization: `ymjvuwefhqqlymwlocqn` (Free).
- Project: `dongphugia-runtime`, ref `bonxyxluzlxfkdetryoo`.
- Region: `ap-southeast-1`; expected health: `ACTIVE_HEALTHY`.
- Database target must pass the existing exact URL parser and exact target
  contract, PostgreSQL 17, and the strict 350 MiB size ceiling.
- Owner scope is durably recorded on Issue #270. The workflow requires that
  exact Owner-authored approval marker, the open Issue, a manual dispatch by
  the Owner from `main`, and the exact merged source SHA.
- `expected_ledger_prefix` must match the pre-run custom ledger state:
  `absent`, `7`, `8`, or `9`. A retry is a separate Owner decision using the
  exact observed prefix. A non-prefix, checksum mismatch, schema drift, or
  unexpected later migration fails closed.
- Before ledger adoption, the runner replays the seven pinned checkpoint
  migrations in local network-disabled PostgreSQL and compares the normalized
  schema dump with the exact remote checkpoint.

The workflow uses only the existing `runtime-backup` GitHub Actions environment and
its exact-target database URL and read-only Supabase Management token. It does
not require the expired catalogue artifact because it neither decrypts nor
restores a backup.

## Acceptance and recovery

The runner accepts only the exact nine-entry ledger prefix and verifies the
backup role remains NOLOGIN, has no role memberships, has no schema CREATE
privilege, and has only the exact SELECT grants and policies. It verifies the
four `dpg_readonly` SELECT grants and rechecks database size. Logs and workflow
summary contain no row data, connection URL, or secret.

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
