# Production PostgreSQL baseline-adoption contract

Status: **NOT AUTHORIZED / contract only**. This document does not mutate,
connect to, or compare against Production. PM approval and a separately
scheduled operation with dedicated recovery and approval controls are required
before any Production command.

## Required evidence before adoption

1. A fresh backup and private restore verification exist for the exact target.
2. A select-only Production schema comparison covers the same object classes as
   `db/postgres-migrations/schema-manifest.json` and records the canonical
   baseline hash, target identity and comparison timestamp.
3. Baseline provenance is explicit: canonical origin commit, layer checksums,
   PostgreSQL image/version, runner version and the named execution owner.
4. Differences are classified as adopt, migrate, preserve or block. No live
   object is silently overwritten; production-only objects require a separate
   reviewed migration or an explicit preservation entry.
5. The migration execution owner, maintenance window, monitoring and exact
   rollback boundary are named. Transaction rollback is not assumed to undo
   external effects or irreversible DDL.
6. The exact immutable ARM64 image digest has passed the isolated Staging path
   and its source revision matches protected `main`. Promotion uses the same
   immutable Staging-validated image digest.
7. No split-brain is possible: one migration lock/owner, one target, and a
   verified restore/rollback target are recorded before execution.

## Adoption sequence (future authorized operation)

```text
backup + restore proof
  → select-only schema comparison
  → PM approval of adoption/provenance and differences
  → named migration owner executes canonical PostgreSQL runner
  → post-migration schema comparison + runtime acceptance
  → promote the exact Staging-validated image digest
```

The production runner must use a Production-specific marker/role contract and
must not reuse Staging credentials, volume, network or data. Rollback is the
pre-agreed restore or reverse-migration boundary, not a best-effort recreate of
the live database.

## Explicit exclusions

- No Production mutation, migration, reset, restore, credential retrieval or
  runtime rollout is authorized by this task.
- No MS885, SEO, RLS/orphan cleanup, Package/Relationship or Family feature
  work is part of this contract.
