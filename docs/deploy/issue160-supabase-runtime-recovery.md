# Issue #160 Supabase runtime recovery

Status: STOP — source procedure is not dispatch-ready and grants no write authorization.

The workflow `.github/workflows/supabase-runtime-issue160-recovery-once.yml`
exists for the exact Owner GO and target `bonxyxluzlxfkdetryoo`. It permits one
`workflow_dispatch` from `main` with an exact approved main SHA. It verifies the
current Issue #160 Owner comments, source artifact identity, runner capacity,
target organization/project, TLS, a destination snapshot, isolated restore,
schema contract, and database headroom before any remote write. It has no retry
path. A failed check is a STOP; never rerun the workflow to get past it.

## Dispatch gates

Do not dispatch until all of these are verified on the exact candidate:

1. Security, Standards, and Spec review plus required CI pass on the exact main
   SHA.
2. Re-attest the original ciphertext artifact ID, size, SHA-256, expiry, and
   Owner-controlled ciphertext-only custody copy immediately before the
   approved run. Keep both copies; never persist plaintext or delete either.
3. The `runtime-backup` Environment has the required secret names configured:
   `SUPABASE_REHOME_DATABASE_URL`, `SUPABASE_REHOME_ROOT_CA_CERTIFICATE`,
   `SUPABASE_MANAGEMENT_TOKEN`, and `BACKUP_AGE_PRIVATE_KEY`. The workflow
   derives the snapshot recipient from the existing protected key only after
   authenticating the source bundle, then compares it with the original backup
   recipient. `SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY` and
   `SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT` are not used. Inspect secret names
   only; never retrieve or print values. The project root CA is a project-bound
   certificate downloaded from Supabase Database Settings; do not guess it or
   substitute a generic CA.
4. Prove the exact TLS-verified target and least-privilege effective connection
   role without exposing the URL. The current target parser accepts only the
   `postgres` direct/pooler identity, so this requirement is not met. Require
   an Owner-approved migration identity with only the capabilities needed by
   the approved schema change and an explicit sanitized role attestation;
   `dpg_backup` remains a separate non-login, non-superuser, non-`BYPASSRLS`
   capability.
5. The source tree currently encrypts schema/data archives, checks their
   decrypted hashes, restores them in isolated PostgreSQL, compares selected
   `auth`/`extensions` ACLs, and checks table inventory. This is not yet full
   rollback-equivalence evidence for all affected data, schema, sequence,
   role, grant, RLS, and function state. Do not dispatch until that proof and
   exact pre-write destination revalidation are implemented and reviewed.
6. Verify account-wide zero-cost Actions plus Packages allowance and current
   usage before retaining a recovery checkpoint or deleting any CI artifact.
   A repository-only artifact count is insufficient. Do not delete protected
   recovery, source, custody, legal, or security evidence.
7. The current `runtime-backup` Environment has only the Owner as required
   reviewer and permits self-review. Configure a genuinely independent
   required reviewer and prevent self-review before dispatch.
8. The current target plan, database size, projected imported size, reserved
   headroom, migration ledger, schema contract, and RLS state all pass. The
   accepted database ceiling is 367,001,600 bytes; do not infer database size
   from encrypted artifact size.
9. GitHub Environment approval is recorded for the exact run and SHA.

If any gate is `UNKNOWN`, the original source artifact cannot be preserved, the
artifact budget would be exceeded, or the destination snapshot cannot prove
rollback, stop and report the specific blocker on Issue #160. Do not delete
artifacts or change retention, permissions, credentials, the project plan, or
infrastructure to force a pass without a separate Owner decision.

## Execution boundary

The one permitted run may reconcile only the canonical 23 migrations, the
required `dpg_v1.products` interface and three API procedures, the least-
privilege `dpg_backup` role, and the 13 identified `dpg_app` RLS settings, then
perform at most one 27-table catalogue sync. Preserve existing data. Do not
fabricate migration-ledger entries or replay incompatible migrations.

Never write Supabase Auth or Storage, unrelated data, DNS, Cloudflare
Production, public launch, AWS, or paid services. The protected job must emit
only sanitized aggregate evidence. Report one consolidated PASS/STOP result on
Issue #160 with the exact workflow run, verified table count, counts/hashes,
schema/RLS result, and database bytes.
