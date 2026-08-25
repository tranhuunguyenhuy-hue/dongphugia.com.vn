# PostgreSQL Migration Runner — HIGH_RISK Execution Specification

**Status:** Implemented; detailed deployment contract is ADR 0013
**Owner:** Engineering/Deployment
**Route:** HIGH_RISK
**Production:** not authorized
**Scope:** PostgreSQL migration origin, runner contract, and disposable Baseline v1 validation

## 1. Purpose and boundaries

This specification records the approved R0 direction. The executable runner,
canonical manifest/checksums and isolated Staging proof now live in the paths
listed below. No Production adoption is authorized.

The supported future path is PostgreSQL-only and must be independently
reproducible. The existing `prisma/migrations` tree and
`prisma/migrations/migration_lock.toml` remain immutable historical evidence.
They are never loaded by the new runner.

Explicit exclusions:

- MS885 Family migration or any other application/schema migration;
- Production or legacy shared-data Staging execution;
- Production baseline adoption or `_prisma_migrations` reconciliation;
- seed repair or seed execution;
- automatic conversion of legacy data;
- `prisma db push`, `migrate dev`, `migrate reset`, or ad hoc DDL/DML.

## 2. Migration origin decision

The new origin is a dedicated PostgreSQL migration tree, separate from the
retired SQLite-origin tree:

```text
db/postgres-migrations/
  0000_baseline_v1/
    extensions.sql
    core.sql
    catalog-integrity.sql
    publishing-runtime.sql
  0001_<candidate>/
    migration.sql
  manifest.json
  checksums.sha256
  schema-manifest.json
  schema-drift-allowlist.json
```

The exact directory and artifact names are part of the implementation
contract. The runner must accept only this origin and must fail closed if the
requested path resolves to `prisma/migrations`, contains the SQLite lock, or
contains an unlisted artifact.

Baseline v1 is layered as approved by R0:

1. core schema;
2. catalog integrity overlay;
3. publishing runtime overlay;
4. exception inventory (preserved Production objects, not replayed blindly).

The baseline is a structural contract, not a data dump. Its authority is the
versioned, sanitized manifest reconciled from the accepted R0 PostgreSQL
evidence. The manifest must record object identity, type, relevant definition
properties, layer, source evidence, and accepted exceptions.

## 3. Runner command contract

The runner exposes one explicit command:

```text
npm run db:migrate:postgres -- \
  --target isolated-staging \
  --origin db/postgres-migrations \
  --manifest db/postgres-migrations/manifest.json
```

Required command behavior:

- `--target isolated-staging` is the canonical Staging command; disposable is
  reserved for CI proof;
- the runner rejects `production`, legacy shared URLs, and unknown targets;
- the database URL is supplied through the approved runtime environment and is
  never printed or persisted;
- the runner applies the declared baseline/candidate in deterministic order;
- the runner emits only sanitized status, checksums, object counts, timing,
  and failure class;
- the runner exits non-zero before DDL when any provider, checksum, origin,
  target, or manifest validation fails.

No command for Production adoption is defined by this specification. A future
Production command requires a separate HIGH_RISK approval and target-specific
controls.

## 4. Provider and checksum validation

Preflight must fail closed when any of the following is true:

- Prisma datasource/provider is not PostgreSQL;
- the origin is not the dedicated PostgreSQL origin;
- `migration_lock.toml` or a SQLite-origin migration is selected;
- `manifest.json` is missing, malformed, or references an unknown layer;
- any SQL/artifact checksum differs from `checksums.sha256`;
- an artifact exists under the origin but is not listed in the manifest;
- the target is not explicitly disposable;
- the PostgreSQL major/version or pinned image identity differs from the
  recorded validation contract.

The runner must validate checksums before applying any SQL. Intentional
provider-mismatch and checksum-mismatch tests must demonstrate that failure is
pre-DDL and non-destructive.

## 5. Disposable PostgreSQL replay gate

Validation uses an isolated PostgreSQL container only. The existing pinned
fixture image is the default validation identity:

```text
postgres:16.10-bookworm@sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74
```

The replay gate passes only when all conditions hold:

1. Two fresh disposable databases replay the same Baseline v1 layers and
   produce identical sanitized structural manifests.
2. A controlled candidate migration can replay after Baseline v1 without
   unexpected schema drift.
3. The resulting object set matches the approved manifest, with only recorded
   exceptions.
4. Provider and checksum negative tests fail before DDL.
5. No connection, write, migration, or seed action occurs outside the
   disposable container.
6. Evidence records image identity, origin revision, artifact checksums,
   comparison result, failure-test result, and cleanup result without secrets,
   URLs, PII, or business rows.
7. The disposable container, network, volume, and temporary database are
   removed after validation, with sanitized cleanup evidence.

The replay gate does not prove historical Production provenance and does not
authorize shared-environment execution.

## 6. Required implementation artifacts

The implementation provides:

- the dedicated PostgreSQL origin and Baseline v1 layer artifacts;
- the sanitized manifest and checksum file;
- the runner command and target guard;
- provider/checksum validation tests;
- deterministic two-database replay tests;
- an isolated PostgreSQL execution script and protected-main workflow;
- sanitized evidence output and cleanup verification;
- a short operator runbook describing the no-Production boundary.

The implementation does not modify `prisma/schema.prisma`, the SQLite-origin
migrations, `migration_lock.toml`, or Production configuration.

## 7. Rollback boundary

Rollback for this task is isolated-target-only:

- before or during replay failure, stop the runner and destroy the isolated
  database/container/volume;
- after a replay, discard and recreate the isolated database from Baseline
  v1 rather than relying on an unreviewed down migration;
- preserve sanitized logs and manifests for diagnosis;
- do not alter Staging, Production, application state, or shared data.

Any future shared-environment migration must define its own backup, restore,
rollback, no-split-brain, monitoring, and PM approval gates. This specification
does not provide that authorization.

## 8. Acceptance and ownership

Engineering/Deployment owns the runner implementation and isolated/disposable
execution. Technical review owns manifest and structural comparison approval.
PM owns scope and any later environment authorization.

The implementation task is accepted when the replay gate, negative tests,
sanitized evidence, and cleanup criteria in this document pass. Current
execution status is reported by
`docs/deploy/isolated-staging-foundation.md`; Production remains unauthorized
under the separate adoption contract.
