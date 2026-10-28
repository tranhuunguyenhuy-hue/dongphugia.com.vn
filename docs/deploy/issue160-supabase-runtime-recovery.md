# Issue #160 Supabase runtime recovery

Status: **STOP — PR #185 is not dispatch-ready. No recovery or destination
write is authorized while any gate below is unknown or failing.** The workflow
has one manual attempt, exact-main-SHA and Owner-comment gates, protected
`runtime-backup` Environment, no retry path, verified TLS, and pre-write target
and capacity checks.

## Evidence in this candidate

- Destination snapshot v3 encrypts the complete affected-schema dump for
  `dpg_app`, `dpg_control`, `dpg_v1`, and `dpg_v1_api` (data, schema, sequence,
  ACL, RLS, and routine state); `public` schema DDL/ACL/routines; `auth` and
  `extensions` schema ACLs; and global role attributes/memberships without
  passwords. The canonical 23-migration set is the scope being compared.
- Before any write, the workflow restores those objects into pinned,
  network-isolated PostgreSQL, compares normalized schema and data/sequence
  dump hashes plus role and schema-ACL state, and checks the encrypted object
  hashes. Normalization removes only volatile pg_dump version headers and its
  random psql `\\restrict` token. Snapshot receipt format is v3.
- Pending canonical migrations now run in one serializable transaction with
  one ledger update per migration; any failure rolls back the entire pending
  suffix. The existing protected snapshot and pre-write gates remain required.
- Target connection purposes are distinct and exact for project
  `bonxyxluzlxfkdetryoo`: read-only snapshot/admin, `dpg_migration_login` set to
  `dpg_migration`, and `dpg_catalogue_restore_login` set to
  `dpg_catalogue_restore`. Migration identity is attested before migration
  operations. Catalogue apply attests that its capability role is
  `BYPASSRLS`, has no admin/database/role powers or unrelated memberships,
  grants only read/write on the 27 allowlisted tables, read-only access to
  recovery metadata/seeds, and ownership only of their sequences. It must not
  have table access outside that contract, schema/database CREATE, or
  application-function EXECUTE. It does not read or write Auth/Storage.
- The source-ciphertext identity already verified by the prior protected
  check is reused for destination snapshot encryption; no separate snapshot
  identity/recipient secret is needed. Do not re-read or output its value.

## Owner checklist — exact remaining gates

1. **$0 billing and artifacts:** Current repository inventory is
   **125 active artifacts / 873,835,602 bytes**, above the workflow's internal
   500,000,000-byte guard. Provide current account-wide Actions and Packages
   allowance and usage from GitHub **Settings → Billing & licensing → Usage**
   (or enable appropriately scoped billing-read access). No artifact cleanup
   is safe until both allowance and $0 effect are proven. Preserve artifact
   `12052107648` and its Owner ciphertext custody copy.
2. **TLS CA:** Secret-name metadata currently shows
   `SUPABASE_REHOME_ROOT_CA_CERTIFICATE` is absent. For the exact project
   `bonxyxluzlxfkdetryoo`, use the Supabase
   Dashboard project **Connect** panel / server root-certificate download,
   then set Environment secret
   `runtime-backup/SUPABASE_REHOME_ROOT_CA_CERTIFICATE`. Keep `verify-full`;
   never paste certificate or connection material in chat or Issue comments.
   [Supabase: Connecting with PSQL](https://supabase.com/docs/guides/database/psql)
   documents the dashboard server root certificate and `sslmode=verify-full`.
3. **Independent approval:** Environment metadata currently shows only the
   Owner as reviewer and `prevent_self_review=false`. Repository
   **Settings → Environments →
   `runtime-backup` → Required reviewers** must include a human other than the
   Owner, and **Prevent self-review** must be enabled. Preserve branch
   restrictions. The prior inspection found only the Owner and self-review
   allowed; recheck before dispatch.
4. **Database identities and secrets:** Environment metadata lacks both
   purpose-specific database URLs below. The existing random password for
   `dpg_migration_login` was deliberately not returned by its migration, so a
   new credential must be securely set and stored as
   `runtime-backup/SUPABASE_REHOME_MIGRATION_DATABASE_URL`. Create/attest the
   dedicated `dpg_catalogue_restore` capability and its single login member
   using the exact contract above, then store its TLS connection as
   `runtime-backup/SUPABASE_REHOME_CATALOGUE_DATABASE_URL`. These are two new
   secrets; values must never be sent through chat or comments. The existing
   `SUPABASE_REHOME_DATABASE_URL` is retained only for read-only preflight and
   snapshot queries. Existing `BACKUP_AGE_PRIVATE_KEY` is reused; no new
   snapshot key/recipient secret is required. If the target lacks the
   already-reviewed `dpg_migration`/`dpg_backup` role baseline or exact grants,
   STOP before changing it and report the specific mismatch.

Recheck that Environment contains the required secret **names only**:
`SUPABASE_REHOME_DATABASE_URL`, `SUPABASE_REHOME_MIGRATION_DATABASE_URL`,
`SUPABASE_REHOME_CATALOGUE_DATABASE_URL`,
`SUPABASE_REHOME_ROOT_CA_CERTIFICATE`, `SUPABASE_MANAGEMENT_TOKEN`, and
`BACKUP_AGE_PRIVATE_KEY`. Never retrieve or print values.

## Dispatch and write gates

Before considering one protected run, require exact-head Security, Standards,
and Spec PASS; required CI and branch protection PASS; current artifact and
ciphertext custody attestation; verified account-wide $0 capacity; correct
secret-name metadata; independent Environment reviewer/self-review protection;
and a successful TLS, target, migration-identity, rollback-equivalence, role,
and Free-plan-capacity preflight. GitHub Environment approval must match the
exact run and SHA. Any unknown is STOP. Do not retry a run or make a destination
write while stopped.

The approved write scope remains only the canonical 23 migrations and one
transactional sync of the exact 27-table catalogue. Do not change Auth, Storage,
Production, DNS, Cloudflare bindings, or public launch. Report table counts and
hashes, schema/RLS, and measured destination bytes only after actual verified
execution; encrypted backup size is not a database-size estimate.
