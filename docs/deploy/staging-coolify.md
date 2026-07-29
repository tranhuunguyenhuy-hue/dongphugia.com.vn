# Staging deploy via Coolify

This document tracks the staging deployment path for the AWS/Coolify migration.

## Build artefact

- Registry: GHCR
- Image: `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web`
- Platform: `linux/arm64`
- Build workflow: `.github/workflows/staging-ghcr.yml`
- Runtime target: Coolify on AWS EC2 `t4g.small` in `ap-southeast-1`

The workflow uses the repository `GITHUB_TOKEN` with the minimum required GitHub
permissions:

- `contents: read`
- `packages: write`

Database connection strings are passed to Docker BuildKit as build secrets for
`next build`; they are not written to the repository and should not be embedded
as Docker build args.

## Required GitHub Actions variables

These values are not secrets, but they affect the built Next.js client/runtime.

| Name | Purpose |
| --- | --- |
| `STAGING_SITE_URL` | Temporary staging URL, not `dongphugia.vn` |
| `STAGING_NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `STAGING_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase public publishable key |
| `STAGING_NEXT_PUBLIC_GTM_ID` | Optional staging GTM ID; may be blank |
| `STAGING_BUNNY_CDN_HOSTNAME` | Bunny CDN hostname |

## Required GitHub Actions secrets

| Name | Purpose |
| --- | --- |
| `STAGING_DATABASE_URL` | Supabase pooled PostgreSQL URL for app runtime/build |
| `STAGING_DIRECT_URL` | Supabase direct PostgreSQL URL for Prisma; may match direct connection policy |

The workflow intentionally fails before Docker build if any required key is
missing, or if `STAGING_SITE_URL` uses the production domain.

## Required Coolify runtime environment variables

Enter these through Coolify only. Do not commit values to the repository.

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | Supabase pooled PostgreSQL URL |
| `DIRECT_URL` | Supabase direct PostgreSQL URL |
| `AUTH_SECRET` | Application auth secret |
| `ADMIN_PASSWORD` | Existing admin password model uses this in the current codebase |
| `NEXT_PUBLIC_SITE_URL` | Temporary staging URL, not production domain |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase public publishable key |
| `NEXT_PUBLIC_GTM_ID` | Optional |
| `BUNNY_CDN_HOSTNAME` | Bunny CDN hostname |
| `BUNNY_STORAGE_ZONE_NAME` | Required for upload/image admin flows |
| `BUNNY_STORAGE_API_KEY` | Required for upload/image admin flows; secret |
| `BUNNY_STORAGE_HOSTNAME` | Bunny storage endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Required only for scripts/admin paths that use service role; secret |
| `REVALIDATION_SECRET` | Existing app env key |

## Temporary staging domain

Do not use or change `dongphugia.vn` / production traffic for staging.

Recommended temporary domain for the current EIP:

`https://dongphugia-staging.47-131-92-97.sslip.io`

This avoids Mắt Bão/Cloudflare/DNS changes while still routing to the staging
EC2 public IP. Public access remains limited by the AWS Security Group and
Coolify proxy.

## Coolify resource shape

- Project: `dongphugia-staging`
- Environment: `staging`
- Resource type: Docker image
- Image: `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web:staging-latest`
- Application port: `3000`
- Container liveness check: `GET /` inside the container
- Build server: disabled
- Server: existing localhost/local Docker server only
- Existing Coolify server UUID: `npti3h3r47l9v1potlf7kkdh`
- Existing Docker destination UUID: `dm45dwx34qrb8gj5cstjymeo`
- Temporary domain: `https://dongphugia-staging.47-131-92-97.sslip.io`

## Coolify API sequence

Use an admin-created Coolify API token through `Authorization: Bearer <token>`.
Do not create an API token by editing the database directly.

1. Create the project:

   `POST /api/v1/projects`

   ```json
   {
     "name": "dongphugia-staging",
     "description": "Dong Phu Gia staging deployment on AWS/Coolify"
   }
   ```

2. Create the environment:

   `POST /api/v1/projects/{project_uuid}/environments`

   ```json
   {
     "name": "staging"
   }
   ```

3. Create the Docker image application:

   `POST /api/v1/applications/dockerimage`

   ```json
   {
     "project_uuid": "<project_uuid>",
     "environment_uuid": "<environment_uuid>",
     "server_uuid": "npti3h3r47l9v1potlf7kkdh",
     "destination_uuid": "dm45dwx34qrb8gj5cstjymeo",
     "name": "dongphugia-web-staging",
     "docker_registry_image_name": "ghcr.io/tranhuunguyenhuy-hue/dongphugia-web",
     "docker_registry_image_tag": "staging-latest",
     "ports_exposes": "3000",
     "domains": "https://dongphugia-staging.47-131-92-97.sslip.io",
     "is_force_https_enabled": true,
     "use_build_server": false,
     "instant_deploy": false
   }
   ```

4. Add runtime environment variables:

   `PATCH /api/v1/applications/{application_uuid}/envs/bulk`

   Use `is_runtime=true` and `is_buildtime=false` for the runtime-only Docker
   image resource. Do not echo values in logs.

5. Deploy only after the GHCR image exists and all runtime environment variables
   are present:

   `POST /api/v1/applications/{application_uuid}/deploy`

## Pre-deploy gates

- Security P0 fixes must be included in the deployed branch/image before go-live.
- The current app branch still has a known health endpoint leak risk; do not use
  `/api/health` as a public smoke target until the security-fixes branch is
  integrated.
- Do not create a new EC2/server.
- Do not create a new Coolify admin.
- Do not enable Coolify Build Server.
- Do not open public `22`, `6001`, `6002`, or `8000`.
- Do not change `dongphugia.vn`, Cloudflare, or production traffic.

## Security integration prerequisite

Security fixes currently live in the separate worktree:

`/Users/m-ac/Projects/dongphugia-security-fixes`

Branch:

`codex/security-production-blockers`

Before building/pushing the GHCR image for staging, integrate and validate the
security changes that cover:

- `/api/health` no longer exposes counts, region, environment flags, DB URL
  prefixes, or raw error details, and returns `503` on unhealthy DB checks.
- `/api/admin/revalidate` is POST-only, fails closed when the secret is missing,
  accepts `REVALIDATE_SECRET` or `REVALIDATION_SECRET`, validates tags, and does
  not mutate on GET.
- Admin/server actions enforce permissions before blog, product, partner,
  project, and order mutations.
- Sale-only users are restricted to assigned orders.
- Public blog detail lookup only returns published posts whose `published_at` is
  not in the future.
- Stored rich HTML is sanitized before rendering product/blog HTML.

Latest local evidence from that worktree:

- `npm test -- src/app/api/health/route.test.ts src/app/api/admin/revalidate/route.test.ts src/lib/admin-action-auth.test.ts src/lib/html-sanitizer.test.ts src/lib/public-api-blog.test.ts`:
  5 files passed, 13 tests passed.
- `npm run typecheck`: passed.
