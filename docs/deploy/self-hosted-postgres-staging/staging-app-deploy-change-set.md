# Staging application deploy change set

Status: local deployment package. This document does not authorize production
DNS, traffic, data migration, AWS, Security Group, IAM, or Vercel mutations.

## Accepted immutable image

| Field | Accepted value |
| --- | --- |
| Registry | `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web` |
| Source revision | `5eece0c0b78b51bc408dbc2f06404a726bed1143` |
| Immutable digest | `sha256:12b6d170e45d9c47caff2ae18466ef6ddea69f0038012a03b0fce4173aa9d5b3` |
| Platform | `linux/arm64` |

Coolify must deploy the image by digest, not a mutable tag alias or branch tag:

```text
ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:12b6d170e45d9c47caff2ae18466ef6ddea69f0038012a03b0fce4173aa9d5b3
```

The accepted build used native ARM64, produced registry SBOM/provenance, passed
the security threshold of zero HIGH and zero CRITICAL findings, and passed the
ephemeral-database runtime smoke gate. Preserve the workflow run URL and raw
evidence in `cutover-evidence-ledger.md` before production approval.

## Existing staging foundation

- AWS account: `503344933326`
- Region: `ap-southeast-1`
- Existing EC2 instance: `i-011fe10948e0a8c15`, architecture `aarch64`
- Existing EIP: `47.131.92.97`
- Existing Coolify project/environment: `dongphugia-staging` / `staging`
- Existing internal Docker network: `dongphugia-staging-backend`
- Existing PostgreSQL alias: full Coolify container alias on the shared staging
  network (the short alias did not resolve from the application network)
- PostgreSQL is internal-only; no host/public port `5432`
- AWS public ingress remains `80/tcp` and `443/tcp` only

No new AWS resource is required by this application change set.

## Coolify application specification

| Setting | Value |
| --- | --- |
| Resource name | `dongphugia-web-staging` |
| Server | Existing localhost Docker server |
| Build server | Disabled |
| Image | Accepted digest above |
| Container port | `3000` |
| Direct host port | None |
| Proxy | Existing Coolify proxy over `80/443` |
| Temporary URL | `https://dongphugia-staging.47-131-92-97.sslip.io` |
| Force HTTPS | Enabled |
| Internal network | `dongphugia-staging-backend` |
| Replicas | `1` |
| Restart policy | `unless-stopped` |
| Memory hard limit | `512 MiB` |
| Memory plus swap ceiling | `768 MiB` |
| CPU limit | `0.75 CPU` |

Do not use host networking. The app joins only the Coolify proxy network needed
for HTTP routing and `dongphugia-staging-backend` for database traffic. Do not
publish `3000`, `5432`, `6001`, `6002`, `8000`, or `22` directly.

## Runtime environment contract

Names only. Values must be entered through the approved Coolify secret/operator
mechanism and must not appear in Git, screenshots, command logs, or reports.

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SITE_URL`
- `BUNNY_CDN_HOSTNAME`
- `BUNNY_STORAGE_ZONE_NAME`
- `BUNNY_STORAGE_API_KEY`
- `BUNNY_STORAGE_HOSTNAME`
- `REVALIDATION_SECRET`
- `WRITE_FREEZE_MODE`

Optional or compatibility:

- `REVALIDATE_SECRET` - compatibility alias; if supplied, use the same
  staging-only value as `REVALIDATION_SECRET`
- `SESSION_HOURS` - defaults to `8`
- `NEXT_PUBLIC_GTM_ID` - blank is acceptable for staging
- `MAIN_SITE_URL` - only if cross-site revalidation is intentionally enabled
- `MAINTENANCE_MODE` - operational visitor maintenance page; it does not replace
  `WRITE_FREEZE_MODE`

`NEXT_PUBLIC_SITE_URL` must equal the temporary staging URL. `DATABASE_URL` and
`DIRECT_URL` must use the full internal Coolify PostgreSQL alias on port `5432`.
Do not set
Supabase public variables, production database URLs, `ADMIN_PASSWORD`, or other
seed credentials on the application.

## Pre-deploy stop conditions

Stop before deployment if any condition is true:

- image digest, platform, source revision, SBOM/provenance, or scan evidence is
  missing or differs from the accepted values;
- host available memory is below `700 MiB`, swap use exceeds `512 MiB`, or root
  disk free is below `24 GiB`;
- PostgreSQL is not healthy, has restarted unexpectedly, or publishes `5432`;
- the app cannot join `dongphugia-staging-backend`;
- AWS ingress differs from `80/443` only;
- a required runtime variable name is absent;
- any runtime value points at production data or Supabase production;
- production DNS, Vercel configuration, or traffic would be changed.

## Deployment sequence

1. Record pre-deploy host, PostgreSQL, Coolify, network, Security Group, and
   backup state in the evidence ledger.
2. Create or update the Coolify application using the immutable digest.
3. Attach the application to `dongphugia-staging-backend` without publishing a
   direct host port.
4. Enter staging-only runtime values using the secure operator mechanism.
5. Keep `WRITE_FREEZE_MODE=true` through migration rehearsal; unfreeze only for
   an explicitly approved synthetic write test.
6. Deploy once and follow the deployment to a terminal state.
7. On failure, collect redacted events/log categories and stop. Do not retry
   blindly or change the Security Group for debugging.

## Staging acceptance

Image and container:

- actual running digest matches the accepted digest;
- platform is `linux/arm64`;
- container reaches `healthy` and remains running;
- restart count remains `0` during the observation window;
- CPU, memory, swap, disk and inode use remain inside the stop thresholds.

Network and security:

- HTTPS temporary URL is valid;
- no direct host port is published by the app;
- PostgreSQL resolves and accepts TCP only through the internal network;
- no public `22`, `3000`, `5432`, `6001`, `6002`, or `8000`;
- health and application logs expose no secrets, connection strings, raw DB
  errors, row counts, AWS region, or stack details.

Application:

- `GET /` returns `200`;
- `GET /api/health` returns `200` with its safe response contract;
- catalogue, product, blog, search, sitemap and canonical metadata render;
- synthetic `STG-DEMO-*` content renders without production records;
- admin login page renders without creating an account;
- revalidation `GET` returns `405` and performs no mutation;
- write-freeze rehearsal blocks public and admin mutation paths with the
  expected safe response, then is disabled for normal staging use.

Database and storage:

- schema/reconciliation counts match the reviewed bootstrap evidence;
- no production customer, order, quote, session, or credential data exists;
- Bunny reads work and an approved synthetic upload/delete test passes without
  leaking the storage credential;
- legacy Supabase media URLs, if present, remain renderable through the explicit
  compatibility hostname in `next.config.ts`.

## Staging rollback

1. Stop routing the temporary staging hostname to the failed application.
2. Roll back the Coolify application to the previous accepted digest, or leave
   it stopped if no previous digest exists.
3. Preserve PostgreSQL and its volumes; do not drop/reset data without a
   separate reviewed action.
4. Confirm production remains on Vercel and its current production database.
5. Preserve redacted logs, resource metrics, digest, deployment ID and rollback
   timestamps in the evidence ledger.

Production migration and traffic change are governed only by
`production-cutover-runbook.md`.
