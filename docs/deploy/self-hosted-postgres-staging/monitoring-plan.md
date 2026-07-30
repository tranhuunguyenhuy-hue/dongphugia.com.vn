# Self-hosted PostgreSQL monitoring plan

Status: plan only. Do not create alarms, agents, or Coolify resources during
this gate.

## Readiness checks

Required before app deployment:

- container state is running;
- Docker healthcheck is healthy;
- `pg_isready` returns ready on the internal Docker network;
- app container can connect using internal `DATABASE_URL`;
- no public `5432` listener is exposed by Docker or AWS Security Group.

## Metrics

| Signal | Query/source | Initial threshold |
| --- | --- | --- |
| DB readiness | `pg_isready` / container health | alert after 3 consecutive failures |
| Connection count | `pg_stat_activity` | warn >= 28, critical >= 36 out of 40 |
| Long transactions | `pg_stat_activity` | warn if open > 5 min |
| Lock waits | `pg_locks` + `pg_stat_activity` | warn on blocked queries > 60s |
| Disk usage | host/CW Agent filesystem metric | warn >= 75%, critical >= 85% |
| DB volume growth | `du` on Docker volume path | trend daily |
| Memory | container stats / CloudWatch Agent | warn if DB container > 650 MiB |
| Restarts | Docker restart count | alert on any unexpected restart |
| Backup age | newest successful `.dump` timestamp | warn > 30h, critical > 48h |
| Backup checksum | `.sha256` exists and matches | alert on missing/mismatch |

## Read-only SQL snippets

Connection count:

```sql
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
FROM pg_stat_activity;
```

Long transactions:

```sql
SELECT
  pid,
  usename,
  state,
  now() - xact_start AS transaction_age
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND now() - xact_start > interval '5 minutes'
ORDER BY transaction_age DESC;
```

Database size:

```sql
SELECT
  datname,
  pg_size_pretty(pg_database_size(datname)) AS database_size
FROM pg_database
WHERE datname = current_database();
```

## Alert routing

Staging minimum:

- Coolify health status visible in UI.
- CloudWatch Agent already reports host memory/disk.
- Add an operator checklist for backup age until automated alerting is approved.

Before production go-live:

- wire DB alerts to an actual notification target, not silent dashboards;
- add backup-age alarm;
- add disk forecast/retention alarm;
- run a restore drill and attach evidence.

## Health endpoint implications

The current app `/api/health` performs Prisma counts for products/categories and
returns `503` on DB failure. After the app points to self-hosted PostgreSQL, this
endpoint can be used as the app-level DB dependency signal.

Do not expose deep DB internals publicly. Keep detailed DB metrics in logs,
CloudWatch/Coolify, or an operator-only dashboard.
