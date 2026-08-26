# ADR 0013: Isolated PostgreSQL Staging is the deployment foundation

## Status

Accepted; canonical for database migration and candidate deployment. ADR 0010
is superseded and retained as historical shared-data Staging context only.

## Decision

The canonical deployment chain is:

```text
code → PostgreSQL migration → isolated Staging → test/smoke → Production promotion
```

`db/postgres-migrations/` is the only deployment migration origin. Baseline v1
is the accepted PostgreSQL baseline; `prisma/migrations/` and its SQLite-origin
history remain immutable historical evidence and are never replayed by the
deployment runner.

Every candidate Staging run creates a label-owned PostgreSQL target with a
dedicated network, volume, migration role (`dpg_staging_migrator`) and runtime
role (`dpg_staging_app`). The target is identified by a database marker and
attested before any DDL. A fresh target replays every baseline layer, applies
only declared PostgreSQL migrations, emits a structural schema manifest/hash,
and runs the candidate application against the same target.

The protected-main workflow accepts only an immutable ARM64 image digest whose
OCI revision matches the checked-out commit. The workflow invokes the same
local path as the disposable proof: preflight, target attestation, baseline
replay, pending migrations, application deployment, health/smoke checks and
schema drift verification. A branch with a dirty worktree is local proof only
and can never be promoted.

## Rollback boundary

Staging rollback is recreate/reset of the exact label-owned database, volume,
network and application resources. It does not connect to or mutate
Production. Migration failure is transactional and fail-closed; a partially
applied baseline or migration ledger cannot be adopted silently.

## Production boundary

Production is not mutated by this ADR. Promotion requires the separate
HIGH_RISK contract in `docs/deploy/postgresql-production-adoption-contract.md`:
select-only schema comparison, baseline provenance/adoption decision, named
migration owner, backup/restore and rollback boundary, and same immutable
Staging-validated digest.

## Consequences

- New feature threads reuse one reproducible Staging path instead of
  investigating database topology from scratch.
- The old shared-Production-data Coolify runbook is retained only as a legacy
  operational reference; it is not a canonical migration or replay target.
- Disposable probe migrations are additive, isolated and explicitly
  non-promotable.

## Related

- GitHub Issue #103
- `docs/deploy/isolated-staging-foundation.md`
- `docs/deploy/postgresql-production-adoption-contract.md`
- ADR 0010 (superseded for deployment foundation)
