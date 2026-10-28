# Direct catalogue migration — Issue #160

Owner authority: [execution direction](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/160#issuecomment-6463981651)
and the subsequent Owner instruction allowing automatic M1–M4 without individual
deployment approval. This lane has its own `catalogue-direct-migration`
Environment: only branch `main`, no required reviewer, admin bypass disabled.
`runtime-backup`, PR #185, original encrypted backup and existing vault/default
branches remain unchanged. This procedure does not authorize Production or DNS.

## Units and acceptance

1. **M1 / export**: exact 27-table allowlist and dependency order reused from
   `scripts/backup/catalogue-restore-contract.mjs`. Source is only
   `tygjmrhandbffjllxveu.public`. One repeatable-read, read-only transaction
   exports sorted PostgreSQL JSON text, preserving numeric precision, keys and
   nulls. Capture column/default/constraint/sequence metadata and table hashes.
   Data passes through tmpfs, gzip and age. Upload ciphertext only to the
   existing Owner-private vault, using bounded chunks on a new orphan branch;
   verify every chunk and whole ciphertext by read-back. M1 PASS means this
   retrievable immutable commit exists, not merely a runner file.
2. **M2 / import**: resume the M1 commit; never export again. Re-read the full
   encrypted bundle and verify its authenticated content and per-table hashes
   before connecting the writer. Check exact destination
   `bonxyxluzlxfkdetryoo.dpg_app`, empty tables, schema compatibility, forced RLS,
   insert-trigger absence and projected capacity. Save the affected empty-table
   state and sequence/schema metadata in another encrypted checkpoint. A fixed
   private ref `direct-attempt-<M1 commit>` is the one-shot write guard: it is
   never updated, deleted or bypassed. Replay after ambiguous commit is refused.
   Insert explicit columns/keys, validate hashes and FK constraints, then restart
   only linked sequences with a reviewed bounded helper. One serializable
   transaction commits the data and sequence changes. No DDL replay, trigger
   disabling, table truncation or RLS relaxation occurs during import.
3. **M3 / verify**: separate read-only identity and repeatable-read snapshot;
   compare all 27 counts/hashes, constraints, forced RLS, sequence **next-value
   semantics** and PostgreSQL database bytes. A checkpoint code SHA must equal
   execution SHA; code changes after M1 need an explicit reviewed compatibility
   decision, not a fresh export by default.
4. **M4 / Preview**: only after M3 PASS, reuse the canonical public application
   and existing Preview delivery path. This workflow does **not** implement
   public UI integration or claim that M4 has passed. Public filtering must use
   active/publication/PDP/listing/indexing rules; July source prices must not be
   presented as current. Verify real images, routes, SEO and browser behavior.
   Do not use fixtures or an emergency replacement UI as catalogue recovery.
5. **M5**: Production/DNS/bindings remain HOLD pending separate Owner GO.

The current implementation requires exact column/default/constraint mapping;
any difference is a review gate, not grounds to alter the source or relax target
checks. Reject generated columns and unreviewed INSERT triggers. Sequence
metadata is non-MVCC in PostgreSQL: the snapshot preserves rows consistently and
records observed sequence state; the next value must exceed restored IDs.
Source writes and `nextval()` are never used. `ALTER SEQUENCE RESTART` is
transactional; `setval()` is forbidden because it does not roll back.
[PostgreSQL sequence functions](https://www.postgresql.org/docs/17/functions-sequence.html)

## Roles and initial setup

Generate reviewable, password-free setup with:

```sh
node scripts/catalogue-direct/provision.mjs source
node scripts/catalogue-direct/provision.mjs read
node scripts/catalogue-direct/provision.mjs import
```

These commands only print SQL; they do not connect or execute. They create new
NOLOGIN purpose roles, grant SELECT only on the allowlist and linked sequences,
and INSERT only for the import role. They do not modify existing roles or global
PUBLIC grants. Import additionally needs the fixed-schema SECURITY DEFINER
`dpg_app.direct_catalogue_restart(text,text,bigint)` helper owned by the sequence
owner. PUBLIC execute is revoked; only `dpg_direct_import` may call it. The
helper checks the original session user, hardcoded table allowlist, linked
sequence, increment and next-value lower bound. Its exact body/configuration is
attested before use. It executes no arbitrary caller-supplied SQL.

Purpose roles have BYPASSRLS solely to prevent silent filtered exports and allow
inserts under forced RLS, paired with bounded table grants. Runtime attestation
rejects superuser/role/database powers, memberships, unrelated table access,
schema CREATE and executable unrelated SECURITY DEFINER routines. PUBLIC
inherited privileges may cause a genuine security STOP; do not globally revoke
or widen ACLs automatically. No role/password bootstrap has run on either real
project. Source is read-only: use an existing compliant source identity; creating
the generated source role requires a separate explicit source-access setup
decision. Provision target identities through an authorized private administrative
session; never run migration data transfer as `postgres`.

Synthetic PostgreSQL verification proves rollback of inserted rows **and**
transactional sequence restart, precision, FK/key preservation and negative
helper/DELETE probes. An empty affected target with unchanged schema plus this
transaction boundary is the rollback position; an arbitrary full-database
snapshot is not required by this data-only implementation. There is no automatic
remote rollback/import replay. On failure verify actual committed state first.
Physical database files can retain aborted tuples; never interpret SQL rollback
as proof disk bytes were reclaimed, and never auto-truncate/vacuum to resume.

## Single Owner setup checklist

No independent human reviewer or per-deployment approval is required for this
new Environment under the updated Owner instruction. Keep old environments as
they are. GitHub CLI admin access is already available. Secret names below are
the **implemented contract**, replacing earlier proposed names for this lane.

Open repository Settings → Environments → `catalogue-direct-migration` →
Environment secrets. Enter values directly into GitHub or a protected local
provisioning session; never chat, Issue comments, source, public logs or artifacts.

| Secret | Required value / purpose |
|---|---|
| `DIRECT_SOURCE_DATABASE_URL` | Existing restricted read identity for `tygjmrhandbffjllxveu`; SELECT exactly 27 public tables and their linked sequences. No source mutation. |
| `DIRECT_SOURCE_CA` | Official source project server root certificate. |
| `DIRECT_TARGET_READ_DATABASE_URL` | Restricted reader for exactly 27 `dpg_app` tables and linked sequences in `bonxyxluzlxfkdetryoo`. |
| `DIRECT_TARGET_IMPORT_DATABASE_URL` | `dpg_direct_import` login, SELECT/INSERT on the 27 tables, sequence SELECT, execute only the bounded restart helper. No superuser, memberships or table UPDATE/DELETE. |
| `DIRECT_TARGET_CA` | Official destination project server root certificate. |
| `DIRECT_CHECKPOINT_AGE_IDENTITY` | Existing Owner-held verified age identity copied securely for this Environment; no rotation or backup change. Enables encrypted checkpoint export and later recovery. |
| `DIRECT_VAULT_REPOSITORY` | Existing Owner-private vault `owner/repository`, kept private; no new repository required. |
| `DIRECT_VAULT_TOKEN` | Fine-grained Contents read/write credential scoped to that vault only. No default-branch write is performed. |

Use Supabase Dashboard → exact project → Connect for direct or **Session** pooler
connection. Require port 5432 and database `postgres`; remove URL query parameters
because the driver supplies and verifies CA/hostname itself. Transaction pooler,
unverified TLS and `postgres` transfer credentials are rejected. Certificate:
Database Settings → SSL Configuration → download server root certificate.
[Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)

GitHub cannot reveal/re-copy encrypted Environment secret values. Do not grant
read access to all secrets or repurpose old legacy URLs by name. Codex can perform
reviewed setup and configure secret values through a protected session when the
necessary login is available; only Owner-held login/MFA and inaccessible secret
material require Owner action. No need to provision unused migration URLs or
new encryption keys. Browser Use may be enabled in Work settings to allow Codex
to handle Dashboard navigation; the human completes MFA/credential entry.

Finally, confirm account-wide Actions/Packages usage and private-vault headroom
at GitHub Settings → Billing & licensing → Usage. Set Environment variable
`DIRECT_ZERO_COST_ATTESTATION` to a JSON record with `verifiedAt` (current UTC
ISO timestamp), `billableUsd: 0`, `paidUsageBlocked: true`, and
`checkpointBytesRemaining` (verified integer bytes, at least 200000000).
Do not fabricate this record: Codex can set it after reading actual evidence.
It expires after 24 hours. No paid overage, plan upgrade or artifact deletion.
The 200 MB checkpoint cap is an internal conservative guard, not a claim about
the account's actual billing allowance.

## Execute and preserve

After exact-head review, required CI and PM merge gate, use workflow_dispatch on
main with `approved_sha` equal to that main SHA. Choose `export` with no checkpoint;
then `import` and `verify` with the exact M1 commit emitted in the safe summary.
Codex may dispatch those steps without individual human deployment approvals.
Re-running an existing Actions attempt is refused. The job disables host swap,
uses tmpfs only for secret/plaintext, installs checksum-pinned age, and emits
sanitized stages/counts/hashes/receipt IDs only. No artifacts/cache contain data.

If initial export fails before the durable ref/read-back, M1 is **not complete**.
Keep whatever verified ciphertext was safely committed; never claim the runner
or its MVCC snapshot survives termination. A lost incomplete source snapshot may
require Owner review before a new export. Once M1 PASS, failure in import/verify
must never trigger another export. The fixed attempt ref preserves the before
state across ambiguous commit or runner loss; use verify to establish reality.
Keep original ciphertext, refs and prior success evidence. Clear only ephemeral
secret/plaintext; rollback uncommitted transactions on disconnect.

On data/security/cost/permission risk: STOP, publish exact stage, last verified
checkpoint/run/SHA, target-write attempt and transaction certainty, safe remaining
unit and minimal Owner action. Harmless local syntax/tooling/test mistakes may
be corrected without restarting the recovery. Post milestone evidence to Issue
#160. Never turn mechanism/fixture PASS into a real migration or Preview claim.
