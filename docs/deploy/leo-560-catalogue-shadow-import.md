# LEO-560 catalogue-only Supabase Preview shadow import

Status: source candidate for Issue #152. This runbook does not authorize merge,
Production access, DNS, traffic, cutover, paid service use, or importing any
data class beyond the explicitly approved catalogue boundary.

## Exact boundary

- Source: the immutable LEO-560 S3 dump version
  `CSyMYJz1glatK32aWl2K8pukzxzXl69c`, 88,499,596 bytes, SHA-256
  `86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1`.
- Target: Supabase Preview project `dongphugia-runtime`, ref
  `tlmgudfhsyzayiazuugf`, Singapore (`ap-southeast-1`).
- Included only: Product, Brand, Category, Attribute, and Product-bound
  Provenance in `dpg_v1`.
- Excluded: Family/Product Line, Axis, Option, PII, Auth, customers, staff,
  orders, quotes, Blog, media rows/bytes, and every Production connection.

The frozen V1 wireframe does not expand this data approval. Historical LEO-562
Family rows remain excluded and are not inferred, renamed, or transformed.

## Protected workflow

`.github/workflows/leo560-shadow-import.yml` is manual, main-only, and has a
default non-writing preflight mode. It requires:

1. the exact reviewed main SHA;
2. open Issue #152 containing the recorded approval boundary;
3. a fresh successful `runtime-backup.yml` run bound to the exact task PR head;
4. successful encrypted backup and network-isolated restore jobs from that run;
5. a non-expired encrypted backup artifact retained for 14 days;
6. live read-only Cloudflare evidence that the exact Preview Worker has no
   route in the canonical `dongphugia.vn` zone, no account custom domain, no
   Production association on that canonical surface, and no non-asset binding;
   and
7. approval of the protected `runtime-backup` GitHub Environment.

The protected Environment must contain these additional task-scoped secrets:

| Secret | Contract |
| --- | --- |
| `SUPABASE_RUNTIME_MIGRATION_URL` | Exact `postgres` owner connection for only `dongphugia-runtime`; never printed or reused for Production |
| `SUPABASE_MANAGEMENT_TOKEN` | Read-only scoped token for current organization plan and project identity/health only |
| `LEO560_SNAPSHOT_URL` | Short-lived read URL for the exact immutable S3 object version; never printed or persisted |

The existing read-only `SUPABASE_RUNTIME_DATABASE_URL` remains backup-only and
is never repurposed for import. Missing secrets stop the job; the workflow does
not create, retrieve, rotate, or repair credentials.

## Execution controls

The workflow downloads the snapshot into the ephemeral runner workspace,
checks exact byte size and SHA-256, and restores it only to local PostgreSQL
17.6. Before download it also parses the secret URL without printing it and
requires the exact bucket, key, version ID, AWS signature contract, and an
expiry no longer than one hour. LEO-562 then runs locally with deterministic replay. The catalogue-only
adapter accepts that local canonical result and refuses any remote target other
than the exact Supabase ref and Singapore host contract.

Before mutation it requires:

- current Supabase organization plan `free`, no more than two active Free
  projects, and exact target identity/region/`ACTIVE_HEALTHY` status from the
  read-only Management API;
- exact `dpg_control.target_contract` identity and PostgreSQL 17;
- exactly four canonical root Categories;
- zero existing target rows in the approved catalogue write surface, apart
  from those roots;
- zero historical Family rows;
- the recorded LEO-562 catalogue counts;
- projected database size below the repository 350 MiB hard stop; and
- a serializable transaction plus task-specific advisory lock.

The Cloudflare check uses only the existing read-only discovery token. Secret
values are never requested or reported; the gate evaluates only resource,
canonical-zone route, account custom-domain, binding-type, version, and
deployment metadata. It makes no account-wide claim about routes in unrelated
zones.

The only insert statements name these tables explicitly:

- `brands`, `categories`, `products`, `product_source_provenance`;
- `attribute_definitions`, `attribute_options`;
- `category_attribute_policies`, `product_attribute_values`; and
- `product_attribute_multi_options` (expected row count zero).

All excluded-table counts and the exact source/target catalogue digests are
compared before commit. The actual database size is also measured before
commit. Any mismatch or hard-stop breach rolls back the entire transaction.
The repository integration suite exercises the real PostgreSQL transaction
path for successful commit, non-empty-target refusal, read-back digest
mismatch rollback, excluded-row preservation, and pre-commit size rollback.
The imported Products remain `DRAFT`, with withheld
pricing, insufficient provenance for publication, and no READY media; this
workflow does not publish or expose them.

## Evidence and cleanup

The retained 14-day evidence contains only target identity, aggregate counts,
checksums, database-size measurements, recovery run identity, and exclusion
booleans. It contains no source rows, PII, URL, token, password, or encryption
key. The detailed ID/hash-only quarantine artifact is encrypted with the
existing backup age recipient before upload and retained for 14 days; its
plaintext plus the dump and intermediate result files are deleted from the
ephemeral runner after every outcome.

## Rollback and current blocker

Rollback authority is the fresh encrypted artifact whose isolated restore
already passed. Recovery restores the exact target backup; it never reads or
writes the Production database.

As of 2026-10-15, local `aws login` cannot be restored, and the three additional
protected Environment secrets are not configured. The protected workflow is
new in this unmerged source candidate and intentionally accepts only trusted
`main`; the current no-merge approval therefore cannot execute it. Source
validation may continue, but snapshot retrieval, live preflight, and target
mutation remain `BLOCKED` until a separately approved merge and exact
credential setup. The exact snapshot may be supplied only as the task-scoped,
short-lived `LEO560_SNAPSHOT_URL` secret by an already authorized custodian;
no alternative source, branch relaxation, or credential may be substituted.
