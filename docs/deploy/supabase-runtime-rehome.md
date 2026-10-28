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
attestation. All pending canonical migrations then run as one serializable
transaction, with each ledger row inserted in that same transaction. If any
pending migration fails, the entire pending suffix rolls back; no migration in
that suffix remains committed. The runner does not automatically reset the
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

For a Mac-hosted offline rehearsal, invoke `MODE=rehearsal` directly inside a
separately approved Linux ARM64 guest; do not dispatch the re-home workflow,
which contacts the Supabase control plane before its rehearsal step. The
rehearsal source database still receives the **full** dump, including excluded
rows. Only the target database is data-filtered. Its table selectors use
`--schema=dpg_app --table=<unqualified name> --strict-names`, and the target
check rejects rows in every other application table, including migration seed
tables, plus unexpected large objects and noncatalogue sequence advances.
This is a target-data boundary, not a guarantee that the source dump never
contains sensitive data or that schema-only restore creates only 27 objects.

Before any real archive or key enters the guest, an independent reviewer must
verify that the guest has no NIC, no route or egress, no writable host share,
guest swap or persistent plaintext path, and sufficient tmpfs/RAM/disk capacity.
The rehearsal script additionally refuses a remote Docker endpoint, uncached or
wrong-platform PostgreSQL image, an active guest network interface/default
route, a remote Supabase URL, and non-tmpfs evidence output. It runs its pinned
local image with `--pull=never` and a network-disabled container. An age key
may be supplied as an owner-controlled tmpfs file through `AGE_IDENTITY_FILE`;
never place it in chat, repository files, CI logs or command arguments. These
checks do not replace independent hypervisor-level isolation evidence. The
retained artifact and key remain out of scope until separately approved.

The rehearsal and Quality CI share the immutable official PostgreSQL 17.6
Bookworm OCI **index** `sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`.
Its `linux/amd64` child manifest is
`sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3`;
its `linux/arm64/v8` child manifest is
`sha256:5d11ffb37e58a7c9a2285359e50f7674e216c99b9114e47b0e7f21187c11252c`.
Both child configs declare `PG_VERSION=17.6-2.pgdg12+1` and identify Debian
Bookworm in their build history. The index, child manifests, and local image
IDs are different identities. A separately approved public-only ARM64 offline
test must verify the selected child and guest isolation before any real archive
or key is considered.

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

For the separate Issue #160 one-shot sync, use
`.github/workflows/supabase-runtime-issue160-recovery-once.yml`. It additionally
requires `SUPABASE_REHOME_ROOT_CA_CERTIFICATE`, downloaded from the target
project's Database Settings and used with `sslmode=verify-full`; there is no
verified generic public download URL. The protected Environment must require a
genuinely independent reviewer and prevent self-review. Stop before the
recovery job reads a secret if either the root certificate or this approval
control is absent.

That workflow binds the existing protected `BACKUP_AGE_PRIVATE_KEY` only after
the original ciphertext bundle passes exact checksum and manifest validation.
It derives the public age recipient in tmpfs, validates it against the original
source recipient, and uses it to encrypt the destination snapshot. The snapshot
covers full logical state in `dpg_app`, `dpg_control`, `dpg_v1`, and `dpg_v1_api`;
the `public` schema definition without table rows; `auth` and `extensions`
schema ACLs only; and global roles without passwords. It decrypts each archive
only into tmpfs, checks the decrypted archive hashes inside an isolated
PostgreSQL container, restores the archive there, compares the
`auth`/`extensions` ACL contract, and checks the table inventory before any
destination write.

The encrypted checkpoint does not automatically reverse partial migration
commits. On failure, stop and preserve the exact snapshot and ledger. Do not
retry, drop schemas, reset the project, or restore to the destination without a
separate Owner decision and a separately reviewed rollback procedure.

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
