# Disposable CI database fixtures

This is **not a Staging runtime runbook**. The canonical repository-wide
database-backed candidate path is the isolated PostgreSQL foundation in
[`../isolated-staging-foundation.md`](../isolated-staging-foundation.md).
ADR 0010 and [`../staging-coolify.md`](../staging-coolify.md) are superseded
historical shared-data references. These SQL artifacts are disposable CI-test
fixtures and must not be executed against Staging or Production.

## Permitted use

- An ephemeral PostgreSQL service created by a GitHub Actions job or an
  explicitly disposable local test environment.
- Focused schema, synthetic catalogue and Publishing authority-harness tests.
- Automatic disposal with the test service when the job ends.

## Prohibited use

- Coolify Staging, Production, any shared database, backup, restore, or
  migration path.
- Runtime acceptance, customer-facing validation, media upload, scheduler,
  Global Publishing Gate, credential issuance, or any side effect.
- Manual reset, repair, rehome, or seed operation outside a disposable test
  container.

## Artifacts

- `001_schema_from_prisma.sql` — schema fixture generated from the reviewed
  Prisma schema snapshot.
- `002_seed_synthetic_stg_demo.sql` — synthetic catalogue fixture only.
- `003_rehome_synthetic_stg_demo_to_canonical.sql` and
  `004_align_synthetic_product_contract.sql` — retained compatibility fixtures
  for historical disposable tests.
- `004_publishing_api_v1.sql` — Publishing API schema fixture with the Global
  Publishing Gate initially disabled.
- `checksums.sha256` — integrity manifest for review of fixture changes.

The CI workflows mount these files into an isolated PostgreSQL container and
verify expected aggregate fixture counts. Do not copy the prior direct-`psql`
instructions from repository history into an operational runbook. Any future
test-fixture change remains source work. Any inspection or mutation of legacy
shared-data resources needs separately recorded recovery and approval controls.
