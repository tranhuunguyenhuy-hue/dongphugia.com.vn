# LEO-540 runtime backup and recovery

Status: source contract for encrypted protection of the isolated Supabase
runtime dataset. This document does not authorize Production access, a
Production write, a new credential, a new encryption-key store, paid backup or
PITR, or archive deletion.

## Design

[`runtime-backup.yml`](../../.github/workflows/runtime-backup.yml) runs daily at
02:17 UTC and can be dispatched only from protected `main`. The backup job:

1. attests the exact `dongphugia-runtime` / `ap-southeast-1` Preview target and
   its `production-derived-reduced-runtime` contract, using the existing
   `dpg_readonly_login` explicitly set to the `dpg_readonly` capability with
   `transaction_read_only=on` and SELECT coverage for every `dpg_app` table;
2. checks `dpg_control.free_tier_database_guard` is `WITHIN_BUDGET`;
3. runs `pg_dump` in custom logical format for only `dpg_app` and
   `dpg_control`;
4. creates the schema/data manifest from catalog metadata, row counts, and
   row hashes only;
5. encrypts the dump with `age` before it leaves a tmpfs workspace; and
6. uploads the encrypted bundle, manifest, and checksum file as one GitHub
   Actions artifact with a 14-day retention period.

The artifact contains no plaintext dump. The manifest contains no row values,
credentials, URLs, tokens, passwords, or key material. The checksum file covers
both the encrypted archive and the manifest.

## Key and secret handling

The workflow consumes existing Owner-managed GitHub Environment configuration
only:

| Environment | Secret/variable | Purpose |
| --- | --- | --- |
| `runtime-backup` | `SUPABASE_RUNTIME_DATABASE_URL` | exact isolated runtime connection |
| `runtime-backup` | `BACKUP_AGE_RECIPIENT` variable | public age recipient |
| `runtime-backup` | `BACKUP_RETENTION_DAYS=14` variable | retention contract |
| `restore-rehearsal` | `BACKUP_AGE_PRIVATE_KEY` | decrypt only inside the protected rehearsal job |
| `runtime-backup` | `BACKUP_FAILURE_WEBHOOK_URL` (optional) | existing alert endpoint |

No workflow step creates, rotates, retrieves, prints, or persists a credential
or key. A missing key, target URL, recipient, retention variable, or alert
configuration is not silently repaired. If `BACKUP_AGE_PRIVATE_KEY` would need
a new storage decision, stop with `LEO_540_STATUS: REQUIRES_OWNER_DECISION`.
If the existing target-local read-only identity lacks coverage for a runtime
table, stop before `pg_dump`; adding a grant or changing a role is a new
security mutation and requires the same Owner decision.

## Retention and cost boundary

The approved source contract is 14 days and one encrypted artifact per run.
The workflow does not delete old artifacts or configure a provider lifecycle
rule. No paid storage, backup tier, PITR, overage, new bucket, or new external
service is introduced by this source change. Before enabling the schedule, the
Owner must verify that the repository’s existing Actions artifact allowance
covers this retention and archive size; an unknown allowance or any paid
requirement is `BLOCKED`, not an inferred pass.

The database hard stop remains 350 MiB, with existing 250 MiB and 300 MiB
alerts. The backup job stops unless the live target reports `WITHIN_BUDGET`.

## Isolated restore rehearsal

The restore job downloads the artifact from the exact backup run, verifies both
checksums before decryption, and decrypts into `/dev/shm`. It restores into a
pinned PostgreSQL 17 container with:

- `--network none`;
- no bind mounts;
- read-only container root;
- tmpfs-only database, temporary, and socket paths; and
- a 1.5 GiB memory limit.

The container has inert local role and `auth.uid()` stubs solely to parse the
restored RLS policies. It cannot reach Supabase, AWS, Production, DNS, or any
external target. The script removes only its own temporary container and tmpfs
workspace after the result is emitted; it never removes an archive.

After restore, the same sanitized manifest query is run against the container.
The comparison requires exact target, schema, and data manifests; it ignores
only runtime metadata that is expected to differ, such as database size and
backup timestamp.

## Product, Family/MS885, and Blog validation

The restore acceptance SQL returns only a generic PASS or failure class:

- Product table presence, the accepted 17,752 Product rows, 110,321 Product
  images, and unique Product SKU identity are checked.
- The Product Family contract requires `toto:ms885`, 18 memberships, the
  accepted 2/13/3 group distribution, exactly the two open gaps
  `MS885DW4#XW` and `MS885DW18#XW`, and no `MS885DE6#XW` membership.
- Blog tables, the accepted 6/17/0/0/92 category/post/tag/post-tag/Managed
  Media counts, and all post/category, post/tag, and post/Managed Media links
  are checked for orphaned relations.

The SQL does not print Product SKUs, Blog titles/content, URLs, or any other
row. The canonical Product/Family contract remains
`dongphugia:product-family-preservation:v1`; no catalogue gaps are filled and
no Product row is fabricated.

## Failure and alerting

Any missing input, target mismatch, budget alert, dump failure, encryption
failure, checksum mismatch, decryption failure, restore failure, manifest
mismatch, or Product/Family/Blog failure exits non-zero. The `alert` job then
emits a sanitized GitHub Actions failure signal. An existing Owner-configured
webhook is optional; its payload contains only the failure class and no
database, credential, URL, or key data. Webhook delivery failure is itself
reported without hiding the original failed job.

## Recovery and rollback ownership

The named migration owner owns the backup bundle, restore rehearsal, manifest
comparison, and target-side recovery procedure. The Owner/PM retains authority
over any future Production candidate, write target, cutover, and rollback
window. LEO-540 performs no Production mutation and cannot switch a write
target. A failed rehearsal is recovered by fixing the exact Owner configuration
or source defect and rerunning the same workflow; it does not trigger cleanup,
credential rotation, paid fallback, or Production recovery.

## Current gate record

- Source implementation: pending PR review.
- Live scheduled backup: `UNKNOWN` until the Owner-configured target URL and
  existing key/retention boundary are present.
- Live isolated restore: `UNKNOWN` until a protected workflow run completes.
- Actions artifact free/near-zero-cost allowance: `UNKNOWN` until revalidated
  against the current repository plan/quota.
- Production database/write-target switch: not performed.
