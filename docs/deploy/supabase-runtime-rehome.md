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
passwordless `dpg_backup` capability needed by later LEO-542 grants. It refuses
an inexact target or any pre-existing role with stronger attributes. Creating
`dpg_backup_login` or any credential is outside this migration.

The remote restore preflight requires the complete current V1 schema, exact
target contract, PostgreSQL 17, the four restricted capability roles, empty
Auth and Storage, no `dpg_app` rows, an empty restore manifest, and enough room
under the 350 MiB hard stop.

## Catalogue-only boundary

The executable allowlist contains only the 27 legacy catalogue metadata tables
needed for Product, Brand, Category, taxonomy, attribute/specification,
relationship, product image/document URL metadata, and provenance behavior.
It excludes admin and session data, PII, customers, staff, orders, quotes,
Blog, publishing identities and credentials, and media bytes. `dpg_v1` rows are
not imported from this artifact.

The full encrypted archive is decrypted only into tmpfs. Before any remote
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
and defaults to read-only `apply=false`. It verifies open Issue #158, the exact
merged control SHA supplied by the operator, the successful source run, and the
non-expired exact artifact ID. The protected `runtime-backup` Environment must
provide:

- existing `BACKUP_AGE_PRIVATE_KEY`, used only in the tmpfs rehearsal/apply;
- `SUPABASE_REHOME_DATABASE_URL`, restricted to project ref
  `bonxyxluzlxfkdetryoo` through its exact direct or Singapore session-pooler
  identity.

The source runtime connection secret is never read or reused by this workflow.

After rehearsal, remote preflight is read-only. When `apply=true`, the generated
data-only restore, sequence repair, deterministic manifest validation, excluded
surface check, and size guard execute inside one serializable transaction. Any
error disconnects with the transaction uncommitted. A post-commit sanitized
manifest must still equal the rehearsed manifest.

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
