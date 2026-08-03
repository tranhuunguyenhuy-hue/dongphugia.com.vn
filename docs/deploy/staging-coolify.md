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
| `STAGING_NEXT_PUBLIC_GTM_ID` | Optional staging GTM ID; may be blank |
| `STAGING_BUNNY_CDN_HOSTNAME` | Bunny CDN hostname |

## Required GitHub Actions secrets

| Name | Purpose |
| --- | --- |
| `STAGING_DATABASE_URL` | Self-hosted staging PostgreSQL URL for app runtime/build |
| `STAGING_DIRECT_URL` | Self-hosted staging PostgreSQL direct URL for Prisma; may match runtime URL |

The workflow intentionally fails before Docker build if any required key is
missing, or if `STAGING_SITE_URL` uses the production domain.

## Required Coolify runtime environment variables

Enter these through Coolify only. Do not commit values to the repository.

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | Self-hosted staging PostgreSQL URL |
| `DIRECT_URL` | Self-hosted staging PostgreSQL direct URL |
| `AUTH_SECRET` | Application auth secret |
| `ADMIN_PASSWORD` | Existing admin password model uses this in the current codebase |
| `NEXT_PUBLIC_SITE_URL` | Temporary staging URL, not production domain |
| `NEXT_PUBLIC_GTM_ID` | Optional |
| `BUNNY_CDN_HOSTNAME` | Bunny CDN hostname |
| `BUNNY_STORAGE_ZONE_NAME` | Required for upload/image admin flows |
| `BUNNY_STORAGE_API_KEY` | Required for upload/image admin flows; secret |
| `BUNNY_STORAGE_HOSTNAME` | Bunny storage endpoint |
| `REVALIDATION_SECRET` | Existing app env key |
| `WRITE_FREEZE_MODE` | Optional cutover guard. Leave unset/false unless a future migration gate approves a write freeze. |

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
- Image: `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:a81d54442068f70a9f5c7713ec03a565c15adcd17c871f07855be0a0081f1676`
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
    "docker_registry_image_tag": "staging-f3b5b6816654b38edc159e1702caed37deaf8555",
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

The API resource must resolve to the exact digest above before deployment. The
workflow tag is only a lookup convenience; do not use `staging-latest` or any
other mutable alias as the deployment acceptance value.

## Pre-deploy gates

- Security P0 fixes must be included in the deployed branch/image before go-live.
- The hardening candidate already contains the reviewed security patch as
  content-equivalent commit `eb3d732` in its source ancestry. The reviewed
  security worktree commit is `54f161a`; a no-content-difference and
  `git diff --check` comparison was recorded before this document was updated.
- The candidate therefore includes the bounded `/api/health` response,
  fail-closed revalidation endpoint, authorization guards, published-blog
  filtering, and rich-HTML sanitization. Still run the full candidate checks,
  ARM64 image verification, and staging smoke before any registry push or
  Coolify deployment.
- The current production image remains unchanged until a fresh PM-approved
  production window and all launch gates pass.
- Do not create a new EC2/server.
- Do not create a new Coolify admin.
- Do not enable Coolify Build Server.
- Do not open public `22`, `6001`, `6002`, or `8000`.
- Do not change `dongphugia.vn`, Cloudflare, or production traffic.

## Security validation record

The reviewed security worktree remains available at
`/Users/m-ac/Projects/dongphugia-security-fixes` on branch
`codex/security-production-blockers` for audit comparison. Its reviewed patch
is already represented in this candidate's source ancestry as `eb3d732`; do
not cherry-pick the equivalent patch a second time.

The integrated changes cover:

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

The candidate must retain the following validation gates:

- targeted security tests: 5 files passed, 13 tests passed;
- `npm run typecheck`: passed;
- full `npm run check`, production build, immutable `linux/arm64` image
  inspection, and bounded staging smoke.

Local candidate validation record (2026-08-03):

- source: `codex/post-launch-hardening` at `3730086`;
- local image: `dpg-post-launch-hardening:3730086-node24`;
- manifest digest: `sha256:696b3c707aa724c725164756a112833c4b962e74e5a4e97f58346ebe5d83f9a4`;
- platform: `linux/arm64`;
- runtime user: `nextjs` (UID 100, GID 101);
- runtime: Node `v24.18.1` (matches the package engine);
- image healthcheck: present for `GET /` on port 3000;
- no registry push, Coolify deploy, DNS change, or production data mutation was
  performed by this validation. The runner image intentionally omits npm and
  npx after build.
