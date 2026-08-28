# LEO-540 runtime backup and recovery

Status: source contract for encrypted protection of the isolated Supabase
runtime dataset. This document does not authorize Production access, a
Production write, a new credential, a new encryption-key store, paid backup or
PITR, or archive deletion.

## Design

[`runtime-backup.yml`](../../.github/workflows/runtime-backup.yml) runs an
encrypted backup daily at 02:17 UTC and runs the encrypted backup plus an
isolated restore rehearsal weekly on Sunday at 03:17 UTC. The restore can also
be manually dispatched from protected `main` before a major migration or
cutover event. The one-time LEO-540 acceptance rehearsal ran before the final
fail-closed main-only trigger was retained; the schedule is not active on
`main` until this PR is approved and merged. The backup job:

1. attests the exact `dongphugia-runtime` / `ap-southeast-1` Preview target and
   its `production-derived-reduced-runtime` contract, using the existing
   `dpg_backup_login` explicitly set to the `dpg_backup` capability with
   `transaction_read_only=on` and SELECT coverage for every `dpg_app` table;
2. checks the target contract's 350 MiB hard ceiling and 250/300 MiB alert
   thresholds, stopping unless the live size is `WITHIN_BUDGET`;
3. runs PostgreSQL 17.6 `pg_dump` with row-security enabled in custom logical
   format for only `dpg_app` and
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

The workflow consumes only the Owner-approved `runtime-backup` GitHub
Environment configuration:

| Environment | Secret/variable | Purpose |
| --- | --- | --- |
| `runtime-backup` | `SUPABASE_RUNTIME_DATABASE_URL` | exact isolated runtime connection |
| `runtime-backup` | `BACKUP_AGE_RECIPIENT` variable | public age recipient |
| `runtime-backup` | `BACKUP_RETENTION_DAYS=14` variable | retention contract |
| `runtime-backup` | `BACKUP_AGE_PRIVATE_KEY` | decrypt only inside the protected rehearsal job |
| `runtime-backup` | `BACKUP_FAILURE_WEBHOOK_URL` (optional) | existing alert endpoint |

No workflow step creates, rotates, retrieves, prints, or persists a credential
or key. A missing key, target URL, recipient, retention variable, or alert
configuration is not silently repaired. The target-local `dpg_backup_login`
is the only dedicated login and has no write, ownership, BYPASSRLS, or role
administration capability.

## Retention and cost boundary

The approved source contract is 14 days and one encrypted artifact per run.
The workflow does not delete old artifacts or configure a provider lifecycle
rule. No paid storage, backup tier, PITR, overage, new bucket, or new external
service is introduced by this source change. The current repository inventory
is 46 artifacts / 368,552,993 bytes against the approved 500,000,000-byte
budget; one measured backup artifact fits with 122,548,818 bytes remaining.
Schedule activation remains subject to the same cost boundary and Owner merge
decision.

The database hard stop remains 350 MiB, with existing 250 MiB and 300 MiB
alerts. The backup job stops unless the live target reports `WITHIN_BUDGET`.

## Isolated restore rehearsal

The restore job downloads the artifact from the exact backup run, verifies both
checksums before decryption, and decrypts into `/dev/shm`. It restores into a
pinned PostgreSQL 17 container with:

- daily backup runs do not invoke restore;
- the Sunday 03:17 UTC weekly schedule invokes restore after its backup; and
- a protected manual dispatch can invoke restore before a major migration or
  cutover event.

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

- Source implementation: complete in open PR #124; exact-head CI is green.
- Live encrypted logical backup: `PASS`, workflow run `33182413565`.
- Checksum/integrity manifest: `PASS`.
- Live isolated restore: `PASS`, workflow run `33182413565`, using the pinned
  network-disabled/tmpfs-only PostgreSQL 17.6 rehearsal target.
- Product validation: `PASS`.
- Family/MS885 validation: `PASS`.
- Blog validation: `PASS`.
- Actions artifact free/near-zero-cost allowance: `PASS`; 46 artifacts totaling
  368,552,993 bytes remain, below the approved 500,000,000-byte budget, with
  one measured backup artifact fitting inside the remaining headroom.
- Artifact preservation: `PASS`; 294 previously audited `SAFE_TO_DELETE`
  artifacts were deleted, while all audited `MUST_KEEP` and `UNCERTAIN`
  artifacts were retained. The complete per-artifact deletion manifest was not
  retained; this one-time process deviation was ratified by the Owner.
- Production database/write-target switch: not performed.
- Production deployment, DNS/traffic cutover, paid PITR/storage, unrelated
  credential/security mutation, and AWS retirement: not performed.
- Schedule activation: daily backup and weekly restore schedules remain
  fail-closed until Owner approval and merge; no Production authorization is
  granted by this record.
