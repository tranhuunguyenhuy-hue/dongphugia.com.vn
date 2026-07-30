# PostgreSQL staging service change set review

Status: review gate only. Do not create a PostgreSQL service, container,
network, volume, secret, scheduled backup, schema, or migration from this file
without a separate execute approval.

## Source review

PR #28:

- URL: <https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/28>
- Base: `codex/staging-source-integration`
- Head: `codex/self-hosted-postgres-staging-changeset`
- Head commit: `89a096885a71eae3cd8febb364c8438e360ecf46`
- Status: Draft, mergeable
- Checks: `quality`, `Vercel`, and `Vercel Preview Comments` succeeded.

Reviewed source properties:

- `WRITE_FREEZE_MODE` is default-off.
- Prisma write interception blocks model writes and raw execute operations when
  `WRITE_FREEZE_MODE=true`.
- Explicit write-freeze guards cover cache revalidation and Bunny image upload
  side effects.
- Supabase runtime packages and public build variables are removed.
- Legacy Supabase Storage hostname remains in `next.config.ts` as a temporary
  media compatibility allowance.

## Current EC2 capacity evidence

Read-only evidence captured on 30/07/2026 Asia/Ho_Chi_Minh from:

- AWS account: `503344933326`
- Region: `ap-southeast-1`
- Instance: `i-011fe10948e0a8c15`
- EIP: `47.131.92.97`
- Type: `t4g.small`, ARM64, 2 vCPU, standard CPU credits
- Root EBS: `vol-0d903423f9ba88a59`, 40 GiB, gp3, encrypted,
  `DeleteOnTermination=true`
- SSM: Online

Host resources:

| Signal | Current |
| --- | ---: |
| Memory total | 1846.6 MiB |
| Memory used | 616.3 MiB |
| Memory available | 866.3 MiB |
| Swap total | 2048.0 MiB |
| Swap used | 14.5 MiB |
| Disk total `/` | 39.93 GiB |
| Disk used `/` | 6.55 GiB |
| Disk available `/` | 33.38 GiB |
| Inode use | 1% |

Current Docker containers:

| Container | Status | Health | Restarts | Memory |
| --- | --- | --- | ---: | ---: |
| `coolify` | running | healthy | 0 | 337 MiB |
| `coolify-realtime` | running | healthy | 0 | 80.82 MiB |
| `coolify-db` | running | healthy | 0 | 40.02 MiB |
| `coolify-redis` | running | healthy | 0 | 7.695 MiB |

Current Docker volumes:

- `coolify-db`
- `coolify-redis`

Current Docker networks:

- `bridge`
- `coolify`
- `host`
- `none`

Security Group:

- Public inbound: 80 and 443 only.
- No AWS Security Group ingress for 22, 5432, 6001, 6002, or 8000.

Host listeners currently include Coolify ports 8000/6001/6002 bound on the
instance, but those ports are not open through the AWS Security Group.

## Final service diff

Future execute approval would add exactly this PostgreSQL resource shape:

- service/container: `dpg-staging-postgres`
- image:
  `postgres:16.10-bookworm@sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74`
- platform: `linux/arm64`
- no `ports:` mapping
- internal-only expose: `5432`
- network: `dongphugia-staging-backend`, `internal: true`
- volumes:
  - `dpg_staging_postgres_data:/var/lib/postgresql/data`
  - `dpg_staging_postgres_backups:/backups`
- restart policy: `unless-stopped`
- healthcheck: `pg_isready` against localhost inside the container
- security option: `no-new-privileges:true`

It must not use:

- `coolify-db`
- the existing `coolify-db` volume
- public host port `5432`
- AWS Security Group changes

## Resource budget

Final recommended staging limits:

| Setting | Value |
| --- | ---: |
| `mem_limit` | 512 MiB |
| `memswap_limit` | 768 MiB |
| `cpus` | 0.50 |
| `pids_limit` | 256 |
| `max_connections` | 25 |
| `shared_buffers` | 96 MiB |
| `work_mem` | 4 MiB |
| `maintenance_work_mem` | 48 MiB |
| `effective_cache_size` | 256 MiB |
| `max_wal_size` | 256 MiB |

Capacity projection:

| Scenario | Approx result |
| --- | ---: |
| Current container memory total | 465.5 MiB |
| With PostgreSQL 512 MiB hard limit | 977.5 MiB |
| Approx memory available after PostgreSQL hard limit | 354.3 MiB |
| With PostgreSQL 768 MiB hard limit | only 98.3 MiB available |

Decision: use 512 MiB for staging. The earlier 768 MiB proposal is too tight on
the current `t4g.small` once web app deployment is considered.

Stop thresholds before execute:

- SSM must be Online.
- Docker/Coolify containers must be healthy with zero unexpected restarts.
- Memory available must be at least 700 MiB before creation.
- Swap used must be below 256 MiB before creation.
- Disk available must be at least 30 GiB before creation.
- Inode use must remain below 70%.
- AWS Security Group must still expose only 80/443 inbound.

Stop thresholds after execute:

- DB container memory must idle below 250 MiB before schema/data import.
- Host memory available must stay above 250 MiB.
- Disk available must stay above 24 GiB after DB service creation.
- No public listener on 5432.
- No new idle EIP, EBS, or AWS resource should exist.

## Secret and environment contract

Names only. Do not write values into repository, PR, logs, or reports.

PostgreSQL service private env:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Application private env after app deploy approval:

- `DATABASE_URL`
- `DIRECT_URL`

Recommended contract:

- `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are created in
  Coolify private variables for the DB service.
- `DATABASE_URL` and `DIRECT_URL` are created only for the app service after DB
  service acceptance.
- Do not expose a direct external DB URL.
- Do not reuse Coolify internal database credentials.

## Future execute operation list

If a later execute command is approved, the operator would perform exactly these
actions:

1. Reconfirm AWS account, instance ID, SSM Online, SG, disk, memory, swap,
   Docker health, and PR #28 head.
2. Confirm DB credentials are ready in the secure operator flow without
   displaying values.
3. In existing Coolify project/environment only, create a new Docker Compose
   resource using `coolify-postgres.compose.yml`.
4. Enter only the required private env variable names/values in Coolify.
5. Start the DB service.
6. Verify container health, no public 5432, internal network, volumes, resource
   limits, logs redacted, and restart count.
7. Stop at DB service acceptance.

The execute operation must not:

- run `001_schema_from_prisma.sql`;
- run `002_seed_synthetic_stg_demo.sql`;
- import/migrate/export production data;
- create AWS resources;
- change Security Group/DNS/Cloudflare/Supabase/GHCR;
- deploy the application.

## Acceptance checklist

After service execute approval only:

- Container `dpg-staging-postgres` is running.
- Healthcheck is healthy.
- Image digest matches the pinned digest.
- Architecture is ARM64.
- No public port 5432 exists in Docker or AWS Security Group.
- Network `dongphugia-staging-backend` is internal.
- Volumes `dpg_staging_postgres_data` and
  `dpg_staging_postgres_backups` exist.
- Volumes live on the existing encrypted EBS-backed Docker storage.
- Resource limits match this change set.
- `coolify-db` remains untouched.
- Existing Coolify containers remain healthy.
- Host memory/disk/swap remain above thresholds.
- No schema, seed, migration, or production data import has occurred.

## Backup and restore drill

Before accepting the DB as staging source of truth:

1. Create a logical backup job design using `pg_dump --format=custom`.
2. Keep 7 daily and 4 weekly backups.
3. Record SHA-256 for each backup.
4. Perform a restore drill into a disposable target before any cutover.
5. Run `reconciliation-queries.sql`.
6. Confirm sequence values, row counts, checksums, and excluded tables.
7. Keep EBS snapshot as an additional safety layer, not as the only backup.

Important storage risk:

- Backups stored on the same EBS root volume reduce local free disk.
- EBS snapshots will capture backup churn; large nightly dump churn can increase
  snapshot storage cost.
- Before production go-live, move backups off-host to encrypted object storage.

## Rollback plan

Before schema/data/app deployment:

1. Stop the new DB service through Coolify.
2. Remove only `dpg-staging-postgres` after explicit approval.
3. Remove only the two new DB volumes after explicit approval.
4. Leave `coolify-db`, `coolify-redis`, and existing Coolify resources intact.
5. Confirm no public 5432 and no orphan Docker resources.

After schema bootstrap but before app deployment:

1. Keep current production untouched on Vercel/Supabase.
2. Drop/recreate only the staging DB service/volumes after explicit approval.
3. Re-run bootstrap only through a separate SQL approval gate.

After app deployment:

- rollback app to prior image/config first;
- do not delete DB volumes until data ownership is clear;
- if writes occurred, preserve DB and reconcile before any destructive action.

## Cost estimate

No new AWS resource is required for DB service creation.

Current fixed EBS root volume:

- 40 GiB gp3 in Singapore at public on-demand price: `$3.84/month`.
- This is already provisioned; DB creation does not increase the charge unless
  the volume is expanded.

Incremental risks:

| Scenario | Estimated added cost |
| --- | ---: |
| +1 GiB EBS snapshot data retained for a month | `$0.05/month` |
| +5 GiB EBS snapshot data retained for a month | `$0.25/month` |
| +10 GiB EBS snapshot data retained for a month | `$0.50/month` |
| +20 GiB EBS snapshot data retained for a month | `$1.00/month` |
| Expand gp3 root 40 -> 60 GiB | +`$1.92/month` |
| Expand gp3 root 40 -> 80 GiB | +`$3.84/month` |

Pricing source: AWS Price List API, `AmazonEC2`, location
`Asia Pacific (Singapore)`, queried 30/07/2026.

## Review conclusion

GO for a later PostgreSQL service creation approval, with conditions:

1. Use the 512 MiB / 0.50 vCPU / 25-connection profile in this change set.
2. Re-run capacity preflight immediately before execute.
3. Do not run schema/seed/migration during service creation.
4. Do not deploy the app until DB service acceptance passes.
5. Do not merge PR #28 or PR #26 without separate approval.
6. Keep legacy Supabase Storage hostname until production media evidence is
   sufficient to remove it safely.

Suggested approval command:

`EXECUTE-POSTGRES-STAGING-SERVICE`
