# Isolated Staging deployment foundation

This is the canonical candidate path for database-backed delivery:
`code → PostgreSQL migration → isolated Staging → test/smoke → Production promotion`.
It is
write-enabled only inside a disposable, label-owned PostgreSQL target and is
never a Production access path.

## Target identity

- PostgreSQL image: `postgres:16.10-bookworm` pinned by the digest in
  `db/postgres-migrations/manifest.json`.
- Network: `dpg-isolated-staging-backend`.
- Volume: `dpg-isolated-staging-volume`.
- Database container: `dpg-isolated-staging-postgres`.
- Application container: `dpg-isolated-staging-app`.
- Ownership label: `com.dongphugia.deployment-foundation=isolated-staging-v1`.
- Database marker: `dongphugia:isolated-staging:v1`.
- Migration role: `dpg_staging_migrator`; application role:
  `dpg_staging_app`.

Names are fixed so preflight can refuse an unowned collision. Host ports are
random and bound to loopback; the application uses the private `postgres`
network alias and does not use Production credentials, data, schema or volume.

## Canonical command

From a clean protected-main checkout, the workflow receives the exact digest
from `Build production candidate` and runs:

```sh
npm ci
npm run staging:isolated -- proof --image \
  ghcr.io/<owner>/dongphugia-web@sha256:<staging-validated-digest>
```

For local, non-promotable proof while editing foundation code:

```sh
npm run staging:isolated -- proof \
  --image dpg-foundation-isolated-staging:local --allow-dirty
```

The command performs preflight, source/provider/checksum validation, fresh
baseline replay, declared migration execution, app deployment, target
identity attestation, `/api/health`, homepage and `robots.txt` noindex smoke,
and exact schema-manifest comparison. It reports the candidate commit and
image digest; it does not deploy Production.

## Rebuild and rollback

```sh
npm run staging:isolated -- provision --image dpg-foundation-isolated-staging:local --allow-dirty
npm run staging:isolated -- reset
npm run staging:isolated -- down
```

`reset`/`down` remove only resources carrying the exact ownership label. A
fresh `provision` creates a new database and replays Baseline v1. If any
resource name exists without the label, the command stops and does not remove
it. A migration error rolls back its transaction and leaves the target
unpromotable until it is recreated.

## MS885 normalized migration boundary

The MS885 candidate creates only the normalized Family, generic configuration
groups, and explicit Product membership relations. It does not rewrite legacy
`variant_group` fields or Product/PDP commercial data. The approved
`MS885DW4#XW` and `MS885DW18#XW` manufacturer members remain catalogue gaps when
their Product rows are absent; the migration maps existing rows only and never
fabricates those Products. If coverage or schema validation fails, discard and
recreate the isolated target with `reset`; no down migration or shared-data
repair is implied.

## Failure gates

The runner fails closed for a non-PostgreSQL provider, SQLite/Prisma origin,
checksum or manifest mismatch, unsupported SQL transaction control, wrong
database marker/role/version, wrong target URL (including query overrides),
unexpected schema drift, or a Production-looking target. The schema allowlist
is empty by default and every future entry requires an exact object identity,
expected/actual hashes, reason, owner and review date.

## Disposable proof

The end-to-end proof adds `0001_pipeline_probe.sql` to a temporary copy of the
canonical origin. It is additive, runs only on the disposable target, is
verified in the ledger and is deleted with the target. It is not an MS885
feature migration and must never be promoted.
