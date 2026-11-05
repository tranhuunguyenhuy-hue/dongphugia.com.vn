# Backup capability for the recovered current database

Source candidate for Issue #270. The PM approved this replacement plan in chat
on 2026-11-05 (“Duyệt phương án backup cho database hiện có”). This records source
implementation authority, not permission to execute database changes or create
credentials. The former empty-target/two-migration bootstrap is not the path for
this recovered database. Its workflows, history and runtime controls are retained.

## Locked current state

Target is `bonxyxluzlxfkdetryoo`, `dongphugia-runtime`, Singapore, healthy Free
Preview. `existing-state/baseline.json` contains only catalog metadata or hashes
of definitions/settings, never table rows, credential values, passwords or role
password hashes. It records 66 tables, 52 sequences, one view, eight existing
recovery/application roles, schema owners/ACLs, relation structures, column-ACL fingerprints and policies,
function definitions/ACL fingerprints, types, default privileges and memberships.
The inventory query is explicitly normalized to UTC, ISO dates and a fixed
search path. `baseline.sha256` records the canonical JSON fingerprint; execution
compares the complete live inventory, not just names or counts. This snapshot
was captured read-only on 2026-11-05 and must match immediately before execution.

The two existing recovery login roles keep their observed BYPASSRLS attributes;
this candidate does not grant those attributes to backup or alter the recovery
roles. Two `pg_stat_statements` extension views have pre-existing PUBLIC SELECT.
Their extension identity, definitions and ACL fingerprints are pinned. They are
allowed as inherited system observability access, not newly granted backup
objects or application data. Unexpected effective application privileges fail.

## Bounded capability transaction

The new manual `existing-state-backup.yml` defaults to `inspect`. Inspection
uses READ ONLY and rollback. Bootstrap requires a fresh exact Owner approval,
Owner dispatch, trusted merged main SHA, matching baseline SHA and the existing
`runtime-backup` Environment. The gate claims the approval once before starting
the protected job. No run/job rerun is accepted. Shared concurrency serializes
this workflow with the legacy bootstrap and read-only diagnostics.

Bootstrap creates only `dpg_backup` as NOLOGIN, NOINHERIT, NOSUPERUSER,
NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, connection limit zero.
It grants schema USAGE on the two pinned schemas and SELECT on exactly the
66 tables and 52 sequences. For tables already using RLS, it adds one
permissive SELECT policy dedicated to this role. Existing flags/policies and
all other role privileges remain unchanged. It adds no default grants,
credential, backup-login membership, business rows, migration history or old ledger.
It does not replay the seven empty-target migrations or either old prerequisite.

A serializable transaction takes SHARE ROW EXCLUSIVE locks on the table set,
validates the complete before inventory and records server-side row/sequence
fingerprints in memory. After DDL it removes only the exact expected additions
from a copy of the observed metadata and requires the original manifest to
match. It checks direct ACL catalogs, shared ownership dependencies, effective
DML/sequence privileges, schema/database creation and reachable privileged
functions. It compares every table/sequence through SET ROLE dpg_backup with
the privileged before state, then rechecks the privileged state and budget.
Managed PostgreSQL 17 automatically gives its non-superuser creator a role
administration edge. The manifest pins the existing postgres actor and bootstrap
superuser identity. Exactly one provider-created dpg_backup → postgres ADMIN
membership, with INHERIT FALSE and SET FALSE and the pinned bootstrap grantor,
is accepted as the new role's management metadata. It gives no role access to
the backup capability itself. For the RLS visibility probe only, the creator
adds a separate INHERIT FALSE, SET TRUE, ADMIN FALSE self-grant under its own
grantor identity, then removes that exact self-grant before final attestation.
The provider auto-grant is neither edited nor removed. No other membership is
accepted. Synthetic integration uses the same non-superuser CREATEROLE/BYPASSRLS
administrator semantics and checks the transient SET grant is gone.
Only complete success commits. A failure rolls back the active transaction.

Table locks block table writes but do not freeze nextval. The Owner execution
line therefore explicitly attests a quiescent writer/DDL window. State is
compared again before commit; an external sequence advance stops this run and
must be investigated. A rollback does not undo an external nextval. This
procedure never resets a sequence to hide such drift. Advisory/workflow locks
are not substitutes for the Owner's quiescence coordination.

## Approval syntax and controls

Dispatch inputs are exact `approved_source_sha`, `approved_baseline_sha`,
`operation` and, except for inspect, `approval_comment_id`.

After the exact source PR merges, the Owner posts an unchanged new Issue #270
comment created after merge, consisting of one line:

```text
EXISTING-BACKUP-EXECUTE: sha=<40hex> baseline=<64hex> operation=<bootstrap|backup_restore> quiescent=yes nonce=<32hex>
```

The dispatcher validates exact author, source PR/main relationship, timestamp,
operation and nonce, then records one `EXISTING-BACKUP-CLAIMED:` comment. A
claimed comment or nonce is never reusable. Retrying is a new dispatch and
Owner decision after read-only state inspection. No automatic down migration,
ledger edit, target reset, role cleanup or retry is performed on failure.

The protected job independently checks current Free plan and the exact healthy
project using GET-only scoped Management API requests, exact database endpoint
parsing and verified TLS with the pinned official Supabase CA. Database size
must remain below the established 250 MiB alert threshold for backup readiness,
within the target contract's strict 350 MiB hard ceiling. Plaintext is forbidden
outside a confirmed tmpfs workspace. Failures publish fixed categories only.

## Separate credential gate

This source never creates `dpg_backup_login`, changes a password, retrieves a
secret or reuses the migration login for backup. Before `backup_restore`, a
separately approved credential operation must establish a dedicated backup
login with NOINHERIT, no administrative/BYPASSRLS attributes, connection limit
two (one keeper plus one dumper), default_transaction_read_only=on, no owned objects or direct ACLs and only
membership with INHERIT FALSE permitting SET ROLE dpg_backup. Its sole
administrative member may be the pinned provider-created postgres ADMIN edge
with INHERIT FALSE/SET FALSE, under the same bootstrap grantor; no login
inheritance or third-party membership is accepted. The runtime URL must use that exact
login and exact project/direct or Singapore session-pooler endpoint. Existing
age recipient/private key are consumed through protected variables/secrets.
No credential is sent through chat, PRs, logs or command arguments.

## Encrypted backup and isolated restore

`backup_restore` needs its own exact approval line and checks the dedicated
login, capability, target and baseline before exporting one REPEATABLE READ
READ ONLY PostgreSQL snapshot. Server-side hashes are computed from sorted
per-row SHA256 digests, not by returning rows to logs or the model. The snapshot
keeper remains open while a pinned PostgreSQL 17 pg_dump reads the same snapshot
under dpg_backup with row-security enabled. It verifies all state again before
closing the keeper, including nontransactional sequence state.

The schema-filtered custom dump includes dpg_app and dpg_control. Existing
public.runtime_* function definitions and their exact owner/EXECUTE ACL recovery statements are preserved separately in the same
snapshot because a schema-filtered dump would omit them. The dump, complete
state manifest and that public-API recovery record are individually age-encrypted before
leaving tmpfs. Only three ciphertext files and a public envelope are uploaded.
The envelope binds target, baseline, exact source/run and ciphertext checksums;
it contains no row hashes/counts, schema SQL, keys or credentials. Artifacts
retain 14 days and fail closed unless existing plus proposed ciphertext stays
under the established 500,000,000-byte repository artifact budget. No deletion,
new bucket, paid backup, provider-plan change or schedule is introduced.

The same run verifies ciphertext checksums and identity before decrypting into
tmpfs. It restores to the pinned PostgreSQL 17 image with --pull=never,
--network none, read-only root filesystem, no host mounts, tmpfs database/tmp
and a 1.5 GiB memory ceiling. Necessary roles and auth.uid are inert local
stubs with no login/admin/BYPASSRLS; neither keys nor database URLs are passed
to that container. Public API definitions are restored there, never remotely. Their exact owner/ACL statements and decoded ACL entries stay in the encrypted JSON for separately approved recovery; the sandbox deliberately does not apply those privilege statements.
The actual current functional schema, policies, every table's data fingerprint
and every sequence value/state must match the encrypted snapshot. Source owner/ACL metadata is retained inside the encrypted dump. Those
application owner/ACL commands are intentionally not applied inside the sandbox; this is a content and
functional-definition recovery proof, not staff authorization acceptance.
Future dpg_v1/Admin/order modules are not fabricated or required for this proof.

## Candidate validation and execution boundary

Focused tests cover target restrictions, exact metadata/privilege deltas,
populated-data preservation, sequence drift, RLS completeness, one-use approvals
and encrypted-artifact identities. Synthetic PostgreSQL tests replay the real
seven schema files into a disposable local container, populate a Product, prove
failed attempts roll back, then export/encrypt/restore and reject corruption.
They use a temporary synthetic TLS certificate and age identity only. The
separate source-validation workflow has no protected Environment or runtime
secrets. Local Docker absence is NOT_RUN; CI must pass the real integration.

Source PR, CI, independent review, merge, capability execution, credential
configuration, encrypted backup, isolated restore and any phase-2 schema write
remain separate evidence. After a successful capability commit its role/grants
remain as a checkpoint. If a post-commit issue occurs, freeze further operations
and propose an exact privilege rollback separately; never alter catalogue rows
or undo history automatically. Production, DNS, cloud billing, media bytes,
checkout/orders/CMS schema and catalogue changes are outside this candidate.

## Read-only fingerprint diagnostic after a failed bootstrap

Run 42041540394 failed in its capability transaction with a sanitized generic
error. Post-run checks found no backup role or legacy ledger. Do not retry the
transaction automatically. The `inspect` operation now also computes the same
server-side table and sequence fingerprints, inside its existing READ ONLY
transaction, without printing fingerprints, counts, rows, SQL or credentials.
Fixed stage labels distinguish target, inventory and fingerprint; a small
allowlist distinguishes client timeout, server statement timeout and lock
timeout without printing raw errors. Failure leaves the transaction rolled back.
This read-only diagnostic does not itself authorize a bootstrap retry.
