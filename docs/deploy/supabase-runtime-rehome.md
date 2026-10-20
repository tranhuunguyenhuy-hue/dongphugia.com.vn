# Supabase runtime re-home into the isolated Free organization

Status: source candidate for Issue #158. This runbook does not authorize merge,
legacy-project mutation, paid service use, DNS, traffic, cutover, or any
Production access or write.

## Exact target and recovery source

- Organization: `Đông Phú Gia Runtime`, ref `ymjvuwefhqqlymwlocqn`.
- Project: `dongphugia-runtime`, ref `bonxyxluzlxfkdetryoo`.
- Region: Singapore / `ap-southeast-1`; plan: Free; environment: Preview.
- Recovery source: successful `runtime-backup.yml` run `38915575745`, artifact
  `leo540-runtime-backup-38915575745` / ID `12052107648`, retained through
  2026-10-30.
- Source identity: PR #156 candidate
  `d300eb696a94acfa557fbaf7a8c0e66876dafb63`, merge
  `59d9ea02dbceb5a3b83d00f929a8ee3a8f70cc35`, trusted backup control
  `ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc`.

The artifact contains excluded Blog, staff, and quote rows. It must never be
restored in full to the remote project.

## Schema prerequisite

Apply the repository migrations in filename order. The inserted
`20260828183000_leo542_backup_role_prerequisite.sql` creates only the
passwordless `dpg_backup` capability needed by later grants. The ordered
`20260828183200_leo540_backup_coverage_prerequisite.sql` then grants only
schema usage and SELECT on the nine tables required by the existing Preview
RLS-hardening preconditions, with one `leo540_backup_select` policy per table.
It also grants SELECT only to `dpg_readonly` on the four existing family
boundary tables that LEO-560 requires, without adding a write privilege or
policy. It refuses an inexact target, role drift, or pre-existing direct
privileges/policies on these tables; no other table or role gains access.
Creating `dpg_backup_login` or any credential is outside these migrations.

## Migration transaction and size boundary

The runner verifies the target's exact 367001600-byte hard ceiling and measures
`pg_database_size(current_database())` before checkpoint-ledger adoption, before
each pending migration, after that migration and its ledger row inside the same
serializable transaction, and after the sequence. The measured size must remain
strictly below 350 MiB; equality is a hard stop. A size or contract failure
rolls back the active migration transaction and does not start the next one.

Checkpoint entries 1–7 are adopted together only after the full checkpoint
attestation. Pending entries 8–23 each commit in their own serializable
transaction. If entry N fails, only N rolls back: the exact committed prefix
and its ledger checksums remain. The runner does not automatically reset the
database, edit the ledger, or run down-migrations.

On a failed migration, stop the workflow and preserve its run ID, exact source
commit, failed filename, and sanitized failure reason. Before any retry, the
runner fails closed unless the ledger contains all seven adopted checkpoint
entries followed by an ordered contiguous prefix; gaps fail with
`migration_ledger_non_prefix`, and a shorter existing ledger fails with
`migration_checkpoint_incomplete`, before pending migration DDL. An
Owner-authorized read-only inspection must also verify each filename, version,
and SHA-256 against the manifest at that exact commit, then recheck target
identity, PostgreSQL 17, Free-plan/database headroom, forced RLS/grants, and
empty Auth/Storage and catalogue invariants. A non-prefix, short checkpoint,
checksum/schema mismatch, or unavailable gate is NOT_READY and requires a
reviewed repair plan. Never hand-edit the ledger, reset/drop the target, or
retry blindly. Resuming the same exact source is a separate Owner decision
naming the target, source commit, observed prefix, and failed migration; the
runner then skips the verified prefix and applies only missing files. This
procedure does not authorize catalogue import, backup replay/decryption,
Preview publication, Production, DNS, or traffic.

The remote restore preflight requires the complete current V1 schema, exact
target contract, PostgreSQL 17, the four restricted capability roles, empty
Auth and Storage, an empty restore manifest, and enough room under the 350 MiB
hard stop. All `dpg_app` tables must be empty except the exact migration-owned
MS885 family/configuration/gap seed tuples; those four seed tables are not
imported from the recovery artifact and any semantic drift stops the run.

## Catalogue-only boundary

The PM approved the expanded recovery catalogue boundary on 2026-10-18 for
this exact new-account target. This supersedes the narrower historical
LEO-560/S3 boundary only for Issue #158; it does not alter or retroactively
authorize the old project or old artifact workflow.

The executable allowlist contains only the 27 legacy catalogue metadata tables
needed for Product, Brand, Category, taxonomy, attribute/specification,
relationship, product image/document URL metadata, and provenance behavior.
It excludes admin and session data, PII, customers, staff, orders, quotes,
Blog, publishing identities and credentials, and media bytes. `dpg_v1` rows are
not imported from this artifact.

The full encrypted archive is decrypted only after `/dev/shm` is proven to be
a real `tmpfs` mount. Before any remote
connection, the exact filtered restore is rehearsed in pinned PostgreSQL 17:

1. a network-disabled source database receives the full exact archive;
2. a second database receives schema only;
3. only the explicit catalogue allowlist is restored into the second database;
4. all allowed-table counts and deterministic UTC/C-collated hashes are
   compared; and
5. every excluded `dpg_app` table must remain empty.

Evidence contains only aggregate counts, hashes, excluded table names, and
pass/fail state. It contains no rows, URLs, credentials, keys, or media bytes.

## Protected workflow

`.github/workflows/supabase-runtime-rehome.yml` is manual, protected-main-only,
and defaults to the read-only `preflight` operation. `migrate` applies only the
missing reviewed migrations; `restore` requires their exact completed ledger
and performs the catalogue transaction. It verifies open Issue #158, the exact
merged control SHA supplied by the operator, the successful source run, and the
non-expired exact artifact ID. The protected `runtime-backup` Environment must
provide:

- existing `BACKUP_AGE_PRIVATE_KEY`, used only in the tmpfs rehearsal/apply;
- `SUPABASE_REHOME_DATABASE_URL`, restricted to project ref
  `bonxyxluzlxfkdetryoo` through its exact direct or Singapore session-pooler
  identity; URL query/hash parameters and non-session pooler ports are rejected;
- `SUPABASE_MANAGEMENT_TOKEN`, scoped for read-only verification of organization
  `ymjvuwefhqqlymwlocqn`, its Free plan, and project identity/region/health.

The source runtime connection secret is never read or reused by this workflow.

Before any checkpoint hash is adopted, the migration runner replays the exact
seven files in pinned, network-disabled PostgreSQL 17 and requires the
normalized `dpg_app`/`dpg_control` schema-only dump to equal the remote dump.
It then verifies the complete role, membership, connection-limit, role-setting,
object, exact-seed/otherwise-empty-data and RLS contract. Default `preflight`
performs only this read-only remote
attestation. The rollback-only synthetic owner-isolation probe runs only inside
`migrate`, immediately before the first ledger write.

After that attestation, the runner stores exact checked-out migration hashes in
a private forced-RLS ledger and applies each remaining migration once in
repository order. The final gate requires the complete 23-entry ledger plus
schema, forced-RLS, read-only API acceptance, and (for `migrate`) rollback-only
behavioral acceptance before catalogue preflight can pass. The PostgreSQL 17
integration replay also runs the LEO-560 read-only acceptance and verifies that
its existing `admin_sessions` backup-policy precondition still fails closed
when deliberately removed inside a rolled-back test transaction.

After rehearsal, default remote preflight is read-only. When operation is
`restore`, the generated data-only restore, sequence repair, deterministic
manifest validation, excluded surface check, and size guard execute inside one
serializable transaction. Any error disconnects with the transaction
uncommitted. A post-commit sanitized manifest must still equal the rehearsed
manifest.

## Gates and rollback

Source PR, required CI, merge, schema completion, protected workflow preflight,
remote restore, static Preview build, browser acceptance, and any later traffic
decision are separate gates. A successful restore does not authorize DNS,
traffic, cutover, or Production.

Before data import, rollback is recreation of only the isolated new project and
requires separate deletion approval. During import, the serializable transaction
prevents partial catalogue state. After a committed import, rollback requires a
separately approved target reset/recreation; the workflow does not truncate,
delete, or overwrite a non-empty target.
