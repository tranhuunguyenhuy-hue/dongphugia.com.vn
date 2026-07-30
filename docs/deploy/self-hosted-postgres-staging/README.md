# Self-hosted PostgreSQL staging change set

Status: review-only. Do not create the database service, run SQL, export data,
run GHCR, or modify production.

Base branch/head:

- Branch: `codex/self-hosted-postgres-staging-changeset`
- Base commit: `cb5e9d72f934fa27a2ff895cca7b1c7c1a68ec23`
- Target integration branch after approval: `codex/staging-source-integration`

## Goal

Move the staging runtime target away from Supabase-managed Postgres and prepare
a self-hosted PostgreSQL service on the existing AWS EC2/Coolify host.

No new AWS resource is required for this design. Data stays on the existing
encrypted 40 GiB EBS root volume through Docker/Coolify persistent volumes.

## Architecture

```text
Cloudflare/DNS: unchanged
AWS Security Group: unchanged; public inbound remains 80/443 only
EC2 t4g.small: existing staging host
Coolify: existing local Docker server

Coolify project/environment:
  dongphugia-staging / staging

Internal Docker network:
  dongphugia-staging-backend

Services:
  dongphugia-web-staging
    DATABASE_URL -> dpg-staging-postgres:5432
    DIRECT_URL   -> same internal PostgreSQL service

  dpg-staging-postgres
    image: postgres:16.10-bookworm@sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74
    platform: linux/arm64
    public ports: none
    persistent volume: dpg_staging_postgres_data
    backups volume: dpg_staging_postgres_backups
```

## Pinned image evidence

Registry: Docker Official Image `library/postgres`.

Selected image:

- Tag: `postgres:16.10-bookworm`
- OCI index digest:
  `sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74`
- ARM64 child manifest:
  `sha256:a64c3894964de33920f4de7cc1e88dfdfa3284bcb0c7c760a0512680a34a8faf`

Rationale:

- PostgreSQL 16 is mature and conservative for this migration.
- The selected tag has an ARM64 manifest for `t4g.small`.
- The digest pins the exact multi-arch image index; `platform: linux/arm64`
  forces the ARM64 variant on the EC2 host.

## Resource budget for t4g.small / 2 GiB RAM

Recommended initial limits:

| Component | Limit | Notes |
| --- | ---: | --- |
| PostgreSQL container memory | 768 MiB hard limit | Avoid starving Coolify/app on 2 GiB host. |
| PostgreSQL CPU | 0.75 vCPU | Leaves headroom for web app, Docker, Coolify, SSM, CloudWatch agent. |
| `max_connections` | 40 | Staging only; keep app Prisma pool small. |
| `shared_buffers` | 128 MiB | Conservative for 768 MiB container. |
| `work_mem` | 4 MiB | Prevent per-connection memory blowups. |
| `maintenance_work_mem` | 64 MiB | Enough for restores/index work without starving host. |
| `effective_cache_size` | 384 MiB | Planner hint only. |
| DB persistent volume | start on existing encrypted EBS | Watch disk before app/media/log growth. |
| Backup volume | same encrypted EBS | Move off-host later before production. |

Hard condition: if free disk drops below 12 GiB or DB+backup growth exceeds the
existing EBS comfort zone, stop and revisit storage before deployment.

## Existing schema bootstrap

Use the reviewed schema artefact from:

- `docs/deploy/staging-db-bootstrap/001_schema_from_prisma.sql`
- `docs/deploy/staging-db-bootstrap/002_seed_synthetic_stg_demo.sql`

Expected schema counts:

- 46 tables
- 176 indexes
- 42 unique indexes
- 56 foreign keys

For a self-hosted DB bootstrap, run both files in one future-approved
transaction using the existing staging DB runbook pattern. Do not execute during
this change-set gate.

## Source diff plan

The app runtime currently uses Prisma/PostgreSQL for database access. Supabase
runtime code is unused in `src`; the proposed diff removes unused client
factories and public Supabase build/runtime variables.

Review:

- `proposed-supabase-runtime-removal.patch`
- `validation.md`

Do not apply the patch until PM approves the runtime switch plan.

Important data-compatibility note: `next.config.ts` still allows the legacy
Supabase Storage host. Remove that host only after product/media URLs are
confirmed to use Bunny CDN, or keep it as a temporary explicit compatibility
allowance while cleaning legacy rows.

## Backup and restore

Review:

- `backup-restore-runbook.md`

Required before cutover:

- nightly `pg_dump` with 7 daily + 4 weekly retention;
- pre-cutover logical backup;
- EBS snapshot;
- restore drill into a disposable local/staging target;
- backup age monitoring.

## Monitoring

Review:

- `monitoring-plan.md`

Minimum signals:

- DB readiness;
- connection count;
- disk usage;
- memory usage;
- backup age;
- container restarts;
- slow or failed backup jobs.

## Migration allowlist and reconciliation

Review:

- `migration-allowlist.md`
- `reconciliation-queries.sql`

The first migration plan preserves primary keys and sequences, excludes
`admin_sessions`, and delays crawl/operator history tables that are not required
for staging runtime.

## Write-freeze / final delta

Review:

- `write-freeze-final-delta-plan.md`

The current `MAINTENANCE_MODE` does not cover `/api` or `/admin`, so a future
application-level write guard is required before production cutover.

## Timeline to 02/08

Assuming today is 30/07 Asia/Ho_Chi_Minh and each gate receives same-day
approval:

| Date | Gate | Output |
| --- | --- | --- |
| 30/07 | Review this change set | Approve source diff + DB service design. |
| 31/07 | Create self-hosted Postgres staging service | Internal DB online, no public 5432. |
| 31/07 | Bootstrap empty schema | Schema + synthetic seed only. |
| 01/08 | Approved dry-run export/import from Supabase production | Counts/checksums/reconciliation report; no traffic switch. |
| 01/08 | Restore drill + backup validation | Prove backups are usable. |
| 02/08 | Final-delta rehearsal / write-freeze rehearsal | PM decision for staging app deploy against self-hosted DB. |

## Rollback plan

Before production traffic or DNS changes, rollback is simple:

1. Keep Supabase production unchanged as source of truth.
2. Do not point production traffic to self-hosted DB.
3. If staging DB bootstrap/import fails, discard the self-hosted staging DB
   volume after explicit approval.
4. Keep current Vercel/Supabase production untouched.
5. Keep PR #26 unmerged until all DB migration and staging acceptance gates pass.

After any future cutover, rollback requires the final write-freeze decision:

- if no writes occurred on self-hosted DB, repoint app back to Supabase;
- if writes occurred, export the delta back or preserve self-hosted as source of
  truth and roll forward only.

## Proposed next approval command

`APPROVE-SELF-HOSTED-POSTGRES-SOURCE-AND-SERVICE-PR`

Suggested scope for that approval:

- apply the proposed Supabase runtime-removal source patch;
- commit/push a review PR;
- create no Coolify service yet;
- keep DB execution behind a separate approval gate.
