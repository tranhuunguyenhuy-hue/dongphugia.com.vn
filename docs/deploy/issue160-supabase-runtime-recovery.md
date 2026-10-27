# Issue #160 Supabase runtime recovery

Status: gated source procedure; it is not dispatch or write authorization.

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
2. The original encrypted source artifact and its approved custody are verified
   before the 30 October 2026 expiry. The current workflow only stages source
   ciphertext in runner tmpfs and removes it at job cleanup; that is not durable
   custody.
3. The `runtime-backup` Environment has the required secret names configured:
   `SUPABASE_REHOME_DATABASE_URL`, `SUPABASE_REHOME_ROOT_CA_CERTIFICATE`,
   `SUPABASE_MANAGEMENT_TOKEN`, `SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY`, and
   `BACKUP_AGE_PRIVATE_KEY`; it also has the
   `SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT` variable. Inspect names only; never
   retrieve or print values.
4. The connection target is verified over TLS with hostname and CA checks, and
   the database identity and privileges are proven without exposing the URL.
   The connection role must have only the permissions needed for the approved
   schema reconciliation and catalogue sync. `dpg_backup` remains a separate
   non-login, non-superuser, non-`BYPASSRLS` capability.
5. The exact affected-state snapshot is encrypted, fits the approved GitHub
   artifact budget, and passes isolated restore and rollback-equivalence checks.
6. The current target plan, database size, projected imported size, reserved
   headroom, migration ledger, schema contract, and RLS state all pass. The
   accepted database ceiling is 367,001,600 bytes; do not infer database size
   from encrypted artifact size.
7. GitHub Environment approval is recorded for the exact run and SHA.

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
