# PostgreSQL staging schema bootstrap change set

Status: review gate only. Do not execute schema SQL, seed SQL, migration,
production export/import, or app deployment from this file without a separate
approval command.

## Target evidence

Read-only evidence captured on 30/07/2026 Asia/Ho_Chi_Minh.

- AWS account: `503344933326`
- Region: `ap-southeast-1`
- Instance: `i-011fe10948e0a8c15`
- SSM: Online
- PostgreSQL service label: `com.docker.compose.service=dpg-staging-postgres`
- Actual container observed:
  `dpg-staging-postgres-puhtw8fqq7hag65u53sxjw7t`
- Image:
  `postgres:16.10-bookworm@sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74`
- Runtime image ID:
  `sha256:396e3f5406387fb25dd1d994c0f3c7fa72a0bc6fc471f174736b95d007672bc2`
- Status: running, healthy, restart count `0`
- Exposed container port: `5432/tcp`
- Published host port for 5432: none
- Network: `dongphugia-staging-backend`
- Network internal: `true`
- Memory limit: `536870912` bytes, 512 MiB
- Memory+swap limit: `805306368` bytes, 768 MiB
- CPU limit: `500000000` NanoCPUs, 0.50 CPU
- PID limit: `256`
- Data volume:
  `puhtw8fqq7hag65u53sxjw7t_dpg-staging-postgres-data`
- Backup volume:
  `puhtw8fqq7hag65u53sxjw7t_dpg-staging-postgres-backups`

Target DB read-only preflight:

- public base tables: `0`
- public `_prisma_migrations` tables: `0`
- PostgreSQL major version check `>= 16`: pass

Important operator note: Coolify may suffix the actual container and volume
names. Future execution must resolve the container by Docker Compose service
label and require exactly one healthy match instead of hard-coding the observed
suffix.

## Bootstrap artefacts

Use the reviewed staging bootstrap files:

- `docs/deploy/staging-db-bootstrap/001_schema_from_prisma.sql`
- `docs/deploy/staging-db-bootstrap/002_seed_synthetic_stg_demo.sql`
- `docs/deploy/staging-db-bootstrap/checksums.sha256`

Expected static counts from the reviewed schema:

| Metric | Expected |
| --- | ---: |
| Tables | 46 |
| Explicit indexes | 176 |
| Unique explicit indexes | 42 |
| Foreign keys | 56 |
| ALTER TABLE statements | 56 |

Seed safety evidence:

- no standalone `BEGIN` or `COMMIT` inside seed file;
- no `DROP`, `TRUNCATE`, or `DELETE`;
- no insert into admin, customer, order, quote, or session tables;
- no connection string, Supabase key, or password assignment;
- synthetic `STG-DEMO-*` catalogue/blog data only.

## Future execution shape

This is the intended shape for a future approved execution gate. It is not
authorized by this review file.

1. Confirm caller identity, account, region, instance ID, and SSM Online.
2. Resolve exactly one running healthy PostgreSQL container:

   ```bash
   docker ps \
     --filter 'label=com.docker.compose.service=dpg-staging-postgres' \
     --filter 'status=running' \
     --format '{{.Names}}'
   ```

3. Stop if the command returns zero or more than one container.
4. Confirm the target container has:
   - image digest equal to the pinned PostgreSQL image;
   - `5432/tcp` with no published host port;
   - `dongphugia-staging-backend` internal network;
   - the reviewed memory, CPU, and PID limits;
   - healthy status and restart count `0`.
5. Confirm database is empty enough for first bootstrap:
   - public base table count is `0`;
   - `_prisma_migrations` does not exist;
   - no admin/customer/order/quote/session tables exist.
6. Verify bootstrap checksums from
   `docs/deploy/staging-db-bootstrap/checksums.sha256`.
7. Copy only the two reviewed SQL files to a temporary path on the EC2 host and
   then into the target container. Do not print or copy database credentials.
8. Execute both SQL files in one `psql` transaction:

   ```bash
   psql \
     --set=ON_ERROR_STOP=1 \
     --single-transaction \
     -U "$POSTGRES_USER" \
     -d "$POSTGRES_DB" \
     --file=/tmp/dpg-bootstrap/001_schema_from_prisma.sql \
     --file=/tmp/dpg-bootstrap/002_seed_synthetic_stg_demo.sql
   ```

   The command must run inside the PostgreSQL container using the container's
   existing private `POSTGRES_USER` and `POSTGRES_DB` environment variables.
   Do not echo those values.

9. Remove temporary SQL files from the host and container after execution.
10. Stop at schema bootstrap acceptance. Do not deploy the application and do
    not import production data in the same gate.

## Post-bootstrap acceptance queries

Run read-only checks only. Do not print secrets.

Expected schema counts:

```sql
SELECT count(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

SELECT count(*)
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey';

SELECT count(*)
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
  AND indexdef LIKE 'CREATE UNIQUE INDEX%';

SELECT count(*)
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace;
```

Expected results:

- tables: `46`
- explicit non-primary-key indexes: `176`
- unique explicit non-primary-key indexes: `42`
- foreign keys: `56`

Expected seed checks:

```sql
SELECT count(*) FROM products WHERE sku LIKE 'STG-DEMO-%';
SELECT count(*) FROM admin_sessions;
SELECT count(*) FROM admin_users;
SELECT count(*) FROM customers;
SELECT count(*) FROM orders;
SELECT count(*) FROM quote_requests;
```

Expected results:

- `products` with `STG-DEMO-%` SKU: `3`
- admin/session/customer/order/quote tables: `0`

Recommended additional checks:

- `pg_isready` returns ready;
- DB container remains healthy;
- restart count remains `0`;
- host has no public listener on `5432`;
- AWS Security Group remains unchanged;
- disk, inode, memory, and swap remain above service-change-set thresholds.

## Rollback model

If execution fails before commit:

1. Do not retry blindly.
2. Capture only the first SQL error with secrets redacted.
3. Because `ON_ERROR_STOP=1` and `--single-transaction` are required, the
   schema and seed should roll back as one unit.
4. Re-check public table count remains `0`.
5. Leave the PostgreSQL service running unless there is a separate approval to
   stop or remove it.

If execution succeeds but acceptance fails:

1. Do not run destructive SQL immediately.
2. Confirm again this is the staging self-hosted DB, not Supabase production.
3. Preserve logs with secrets redacted.
4. Request explicit rollback approval before any of:
   - dropping/recreating the `public` schema;
   - removing the staging DB container;
   - removing the staging DB data volume.

Because no application has been deployed against this database yet, the
preferred rollback after a bad successful bootstrap is an approved staging-only
DB reset, not production traffic rollback.

## Not in scope

- production data export/import;
- Supabase mutation;
- application deployment;
- GHCR workflow;
- GitHub secret changes;
- AWS resource creation;
- AWS Security Group change;
- DNS, Cloudflare, or production traffic change;
- admin account creation.

## Proposed next approval command

`APPROVE-EXECUTE-POSTGRES-STAGING-SCHEMA-BOOTSTRAP`

Suggested approval should include:

- expected account: `503344933326`;
- expected instance: `i-011fe10948e0a8c15`;
- expected service label:
  `com.docker.compose.service=dpg-staging-postgres`;
- expected image digest:
  `sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74`;
- expected schema checksum:
  `28d314f9ff1362654d16509c482b61cf6bef701e0e65f48e615d32b3e5e35fa9`;
- expected seed checksum:
  `9d31b730b384484487b7dcdf796d83183cb11b2f02b3f7951e0d8773ed3813c0`;
- approval to copy temporary SQL files to the EC2 host/container;
- approval to execute exactly the two reviewed SQL files in one
  `psql --single-transaction` boundary.
