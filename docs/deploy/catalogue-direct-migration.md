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
   absence of unreviewed INSERT triggers and projected capacity. Save the affected empty-table
   state and sequence/schema metadata in another encrypted checkpoint. A fixed
   private ref `direct-attempt-<M1 commit>` is the one-shot write guard: it is
   never updated, deleted or bypassed. Replay after ambiguous commit is refused.
   Insert explicit columns/keys, validate hashes and FK constraints, then restart
   only linked sequences with a reviewed bounded helper. One serializable
   transaction commits the data and sequence changes. No DDL replay, trigger
   disabling, table truncation or RLS relaxation occurs during import.
3. **M3 / verify**: separate read-only identity and repeatable-read snapshot;
   compare all 27 counts/hashes, constraints, forced RLS, repeat the
   anon/authenticated/PUBLIC exposure gate, sequence **next-value
   semantics** and PostgreSQL database bytes. A checkpoint code SHA must equal
   execution SHA by default. After a compatible code fix, explicitly supply the
   original `checkpoint_code_sha`; the workflow verifies that it is an ancestor
   of current reviewed main and still uses the same bundle contract. No fresh
   export is needed. M1 also checks the approved 375,221-row baseline and four
   key per-table counts; empty/drifting catalogue requires review.
4. **M4 / Preview**: only after M3 PASS, reuse the canonical public application
   and existing Preview delivery path. This workflow does **not** implement
   public UI integration or claim that M4 has passed. Public filtering must use
   active/publication/PDP/listing/indexing rules; July source prices must not be
   presented as current. Verify real images, routes, SEO and browser behavior.
   Do not use fixtures or an emergency replacement UI as catalogue recovery.
5. **M5**: Production/DNS/bindings remain HOLD pending separate Owner GO.

The current implementation requires column/type/nullability/constraint parity.
All columns are inserted explicitly, so differing defaults and serial-versus-identity
syntax do not change source values. Only PostgreSQL timestamp default precision
versus explicit precision 6 is normalized; precision loss is refused. Reject
generated columns and unreviewed INSERT triggers. The existing canonical
`leo538_free_tier_headroom` statement trigger is retained: its event/configuration
and exact function body must match the committed boundary migration. No guard is
disabled. Sequence
metadata is non-MVCC in PostgreSQL: the snapshot preserves rows consistently and
records observed sequence state; the next value must exceed restored IDs.
Source writes and `nextval()` are never used. `ALTER SEQUENCE RESTART` is
transactional; `setval()` is forbidden because it does not roll back.
[PostgreSQL sequence functions](https://www.postgresql.org/docs/17/functions-sequence.html)

## Roles and initial setup

Live metadata audit on 28 Oct found 27/27 tables and 316 columns on both projects,
but destination lacks 20 UNIQUE constraints, one stock-status CHECK and two
NOT NULL attributes. `scripts/catalogue-direct/target-parity.sql` prepares exactly
those 23 statements in one transaction with an all-27-tables-empty guard. The
source remains unchanged. Do not run it before exact target attestation and a
durable pre-setup schema/ACL/empty-data checkpoint; the role bootstrap changes
permissions and schema, so its snapshot precedes this setup, not just import.
The transfer workflow deliberately does not run administrative setup SQL as the
import role. Codex uses the authorized administrative control-plane session for
this one reviewed M2 setup unit after M1, then revalidates the least-privilege
credentials. No real role/helper/parity setup has executed yet. The existing
23 canonical migrations are not replayed. Any newly observed difference requires
review of that difference, not an unbounded migration run.

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
attested before use, including exclusive effective execute ACL. Creation revokes
unintended function default grants on this new helper, preserving other ACLs.
It executes no arbitrary caller-supplied SQL.

Purpose roles have BYPASSRLS solely to prevent silent filtered exports and allow
inserts under forced RLS, paired with bounded table grants. Runtime attestation
rejects superuser/role/database powers, memberships, unrelated table access,
schema CREATE, direct sequence USAGE/UPDATE or unrelated sequence SELECT, and
executable unrelated SECURITY DEFINER routines. Target preflight also rejects
anon/authenticated/PUBLIC table access before any import. PUBLIC
inherited privileges may cause a genuine security STOP; do not globally revoke
or widen ACLs automatically. No role/password bootstrap has run on either real
project. Source catalogue remains read-only: prefer an existing compliant source
identity. Any necessary identity bootstrap changes only reviewed access metadata
through the authorized private administrative session, never source catalogue
rows. Provision target identities through an authorized private administrative
session; never run migration data transfer as `postgres`.

Synthetic PostgreSQL verification proves rollback of inserted rows **and**
transactional sequence restart, parity/role DDL rollback, precision, FK/key
preservation and negative helper/DELETE/post-import-PUBLIC-grant probes. Metadata
checkpoints include exact table ACLs and RLS policies for before-state comparison.
An empty affected target with unchanged schema plus this
transaction boundary is the rollback position; an arbitrary full-database
snapshot is not required by this data-only implementation. There is no automatic
remote rollback/import replay. On failure verify actual committed state first.
Physical database files can retain aborted tuples; never interpret SQL rollback
as proof disk bytes were reclaimed, and never auto-truncate/vacuum to resume.

## Codex setup and Owner-only material

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
| `DIRECT_CHECKPOINT_AGE_IDENTITY` | Independent direct-checkpoint identity, generated and verified in the protected runner. Historical backup identities remain untouched. |
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
material require Owner action. The independent checkpoint key is already configured; do not regenerate it or request a historical backup key. Browser Use may be enabled in Work settings to allow Codex
to handle Dashboard navigation; the human completes MFA/credential entry.

Finally, confirm account-wide Actions/Packages usage and private-vault headroom
at GitHub Settings → Billing & licensing → Usage. Set Environment variable
`DIRECT_ZERO_COST_ATTESTATION` to a JSON record with `verifiedAt` (current UTC
ISO timestamp), `recoveryId: "issue160-direct-20261028"`, `billableUsd: 0`, `paidUsageBlocked: true`, and
`checkpointBytesRemaining` (verified integer bytes, at least 200000000).
Do not fabricate this record: Codex can set it after reading actual evidence.
It expires after 24 hours. No paid overage, plan upgrade or artifact deletion.
All checkpoint refs for this fixed recovery ID are inventoried before publication;
their cumulative bytes plus the new checkpoint cannot exceed 200 MB. Source
ciphertext is capped at 190 MB, retaining space for before-state receipts, and
the single source ref prevents repeated exports consuming the same allowance.
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

After a genuine data-write STOP, normal execution must first choose `verify`.
If the target is independently proven to match its preserved **empty** before
state including sequences/schema, a new linked import attempt may use
`resume_before_checkpoint` plus `resume_owner_comment`. The latter identifies an
Owner comment in Issue #160 containing exactly this line (substitute SHAs):

```text
DIRECT_RESUME_GO source=<M1 commit> before=<preserved before commit> code=<current main SHA>
```

The original attempt remains intact. Each resume GO comment can create only one
new immutable attempt ref; reuse is refused. This is recovery approval after a
real STOP, not approval for every routine deployment. Credential attestation
occurs before creating the data-write marker, so a missing writer credential
does not consume it. An ambiguous commit with nonempty/different target never
permits automatic import replay.

On data/security/cost/permission risk: STOP, publish exact stage, last verified
checkpoint/run/SHA, target-write attempt and transaction certainty, safe remaining
unit and minimal Owner action. Harmless local syntax/tooling/test mistakes may
be corrected without restarting the recovery. Post milestone evidence to Issue
#160. Never turn mechanism/fixture PASS into a real migration or Preview claim.

## Protected connection bootstrap

`catalogue-direct-setup.yml` has two manual units: `source`, `target`, all exact-main/Owner/attempt-one guarded in the direct Environment.
Temporary administrative setup URL slots are sealed to its pinned public key
from existing exact-project candidates. They never enter the transfer runner.
No historical Environment settings, backup/key slots, or original URLs change.

Source setup verifies only source TLS and administrative capability; it has no
destination prerequisite. Target setup verifies TLS, capability and the full live target
metadata/ACL/RLS/policy/trigger/linked-sequence/empty-data state against immutable
checkpoint `354efb8cfe4740936c50f2f34030cf2081ab2a6d`. Snapshot encryption,
hash, decryption and semantic checks precede any persistent role/schema change.
Each provisioning unit generates new credentials only in the swap-free runtime,
stores its encrypted preimage plus credentials in a new immutable private ref,
and reads/decrypts it back **before** the database transaction. Existing setup
refs or roles refuse replay. Each source or target unit commits atomically;
target locks the allowlist, repeats the before-state comparison, and uses only
the reviewed parity/role/helper SQL. Effective role checks run before commit;
fresh restricted TLS logins are independently verified afterward. Only pinned
GitHub sealed values leave the runner for installation by the existing Owner
CLI. No plaintext credential artifact or log is produced. A lost or ambiguous
commit retains its setup checkpoint and requires independent state diagnosis.

The role gate permits only the extension-owned `extensions.pg_stat_statements`
and `pg_stat_statements_info` platform views in addition to the catalogue set.
PostgreSQL restricts other users' SQL text to privileged roles, and membership
in such roles remains forbidden. A same-named unowned view fails. The exact
existing `public.rls_auto_enable()` body/owner/configuration/`event_trigger`
return type is also recognized: it cannot be invoked as an ordinary routine,
and the transfer roles have no persistent DDL authority. Arbitrary executable
SECURITY DEFINER routines still fail. No global ACL is revoked or widened.
See [PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/17/pgstatstatements.html)
and [event triggers](https://www.postgresql.org/docs/17/event-trigger-definition.html).

After the three purpose-specific secrets pass authentication and permission
checks, use the unchanged M1 export entrypoint. Preserve all setup and data
checkpoint refs. Remove only task-created temporary administrative slots when
setup/recovery no longer needs them; never change original credentials.

## FAST Public-only M4 candidate

Owner FAST direction6470305678 authorizes the manual
`catalogue-public-preview.yml` path after real M3 PASS. It builds the existing
canonical Public adapter with the public M1 checkpoint identity, then gives only
the restricted target reader to the separate public DTO projection step. No
historic prices, raw HTML, provenance or private blobs enter Worker assets.
Pricing/availability use contact-only wording. No database credentials enter the
Worker. M3 run/checkpoint identity and code ancestry are checked before data use.

The existing assembler retains/hashes the Public-only candidate before any
provider write; Admin is deferred. Publication uses only an existing isolated
Worker version Preview, with Free-plan/capacity/isolation checks and retained
managed-state evidence. No bootstrap, active deployment replacement, custom
domain or DNS mutation is allowed. HTTP and browser acceptance must prove the
exact real snapshot; synthetic fixture health cannot satisfy M4.

A same-SHA retained artifact may resume only if its producer finished and no
upload step started. Any attempted upload with unknown outcome requires read-only
provider inspection; never upload again blindly. Production/DNS remains HOLD.
