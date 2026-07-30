# Validation ledger

Status: read-only/local-only validation. No database, AWS, Coolify, DNS,
Cloudflare, GHCR, or secret mutation was performed.

## Worktree

- Worktree: `/Users/m-ac/Projects/dongphugia-selfhosted-postgres-staging`
- Branch: `codex/self-hosted-postgres-staging-changeset`
- Base commit: `cb5e9d72f934fa27a2ff895cca7b1c7c1a68ec23`
- Parent integration branch: `codex/staging-source-integration`

## Supabase runtime dependency audit

Result: no active `src` runtime dependency was found on Supabase Auth, Storage,
Realtime, PostgREST, or RPC.

Evidence from source search:

- no `src` calls to `.from(...)`, `.rpc(...)`, `.storage`, `.auth`, or
  `.channel(...)` on a Supabase client;
- no `src` imports from `@/lib/supabase`, `@/utils/supabase`,
  `utils/supabase`, or `lib/supabase`;
- the remaining Supabase files are unused client/helper modules:
  - `src/lib/supabase.ts`
  - `src/utils/supabase/client.ts`
  - `src/utils/supabase/server.ts`
  - `src/utils/supabase/middleware.ts`

Remaining non-runtime or configuration references:

- `package.json` and `package-lock.json` still include Supabase dependencies;
- `Dockerfile` and `.github/workflows/staging-ghcr.yml` still pass public
  Supabase build variables;
- `docs/deploy/staging-coolify.md` and `README.md` still document Supabase
  variables;
- older operator scripts under `scripts/` still contain Supabase access paths;
- `next.config.ts` still allows the legacy Supabase Storage host
  `tygjmrhandbffjllxveu.supabase.co`.

Decision recorded for this source PR:

- Keep the Supabase Storage host in `next.config.ts` for now.
- Local source/data scan did not find stored Supabase media URLs outside
  `next.config.ts` and the review artefacts, but this does not prove production
  rows no longer reference old images.
- Treat the hostname as a temporary compatibility allowance, not as a staging
  runtime dependency on Supabase.

## PostgreSQL image validation

Selected Docker Official Image:

- `postgres:16.10-bookworm`
- OCI index digest:
  `sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74`
- ARM64 child manifest:
  `sha256:a64c3894964de33920f4de7cc1e88dfdfa3284bcb0c7c760a0512680a34a8faf`

The compose proposal pins the digest and sets `platform: linux/arm64`.

## Schema bootstrap compatibility

Reviewed existing bootstrap artefacts:

- `docs/deploy/staging-db-bootstrap/001_schema_from_prisma.sql`
- `docs/deploy/staging-db-bootstrap/002_seed_synthetic_stg_demo.sql`

Expected counts remain:

- tables: 46
- indexes: 176
- unique indexes: 42
- foreign keys: 56

Self-hosted bootstrap must reuse the existing single-transaction execution
model. This gate does not execute SQL.

## Network and exposure validation

Compose proposal:

- no public `ports:` mapping;
- `expose: 5432` only for internal Docker networking;
- internal network: `dongphugia-staging-backend`;
- AWS Security Group must remain unchanged with public inbound 80/443 only.

## Security and privacy checks

The artefacts intentionally contain only placeholder variable names. They do
not contain:

- database passwords;
- connection strings;
- Supabase keys;
- Coolify credentials;
- cookies or tokens;
- production data exports.

Migration plan excludes `admin_sessions`, `crawl_product_snapshots`, and
`crawl_import_decisions` for the first pass.

## Write-freeze source draft

This branch adds a default-off `WRITE_FREEZE_MODE` guard.

Coverage:

- Prisma model writes;
- Prisma raw execute operations;
- `/api/revalidate`;
- `/api/admin/revalidate`;
- `/api/upload-image`;
- admin login/session writes through Prisma interception;
- admin server-action writes through Prisma interception;
- public order/quote/contact writes through Prisma interception.

The guard is not active unless a future environment change sets
`WRITE_FREEZE_MODE=true`.

## Open risks

1. Self-hosting PostgreSQL on the same 2 GiB EC2 host reduces operational
   margin. The proposed limits are conservative, but staging load must be
   measured before production.
2. Backups stored on the same EBS volume protect against logical mistakes but
   not against host/volume loss. Production should add off-host backup storage.
3. The current `MAINTENANCE_MODE` is not a complete write-freeze because `/api`
   and `/admin` are bypassed.
4. Legacy Supabase Storage image URLs may still exist in data. Removing the
   remote image host before media URL cleanup could break images.
5. Constant-time revalidate secret comparison remains a follow-up hardening item
   before production go-live.
