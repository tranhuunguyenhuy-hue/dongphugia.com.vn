# V1 Cloudflare environments: localhost → Staging → Production

**Owner decision:** Cloudflare Workers for both Public and legacy Admin; localhost replaces remote PR Preview. Do **not** provision a Cloudflare Preview Worker/domain or a new Staging Worker.

| Environment | Identifier | Purpose | Data |
| --- | --- | --- | --- |
| Localhost | existing local dev / Wrangler command (verify package scripts) | Rapid development and focused tests | Disposable database / fixtures |
| Staging | existing `dpg-staging` Worker, account `d54f3402b9d112ab64d6135e0e3f1fb1` | M2 Public parity, M3 full Admin acceptance | Public snapshot allowed; **Admin must use isolated test PostgreSQL** |
| Production | existing `dongphugia-v1-public-production` Worker, both `dongphugia.vn` hostnames | M1 Public live DB, M4 full Admin `/admin` | Actual approved V1 Production PostgreSQL |

## Current state (observed 2026-11-13)

Staging deployment `f0cabc41-f024-46cc-8978-510c3d8c1216` and Production deployment `7d0194d7-b007-4fb0-9fd9-d365ca9de834` exist. Both Workers have `nodejs_compat` and assets. Neither had a Hyperdrive binding or Worker secrets listed. Staging has workers.dev enabled, no dedicated custom domain. Staging's historic sign-in shell had disabled Auth/DB and **does not pass M3**. Public Production used a catalogue snapshot. Re-check live configuration before deployment.

## Deployment cadence

- **M1:** implement DB read-through for Public and keep fallback snapshot; deploy to existing Production only with backup, source/version pin and real-route validation.
- **M2:** build same canonical Public UI as Production on existing `dpg-staging`. Reuse allowlisted snapshot resources where valid. Prove banner, categories, PDP, search, Blog and media desktop/mobile. Do not claim Admin functional from rendered sign-in.
- **M3:** integrate old Admin under `/admin` on `dpg-staging`. Verify SSR/Prisma/Hyperdrive compatibility, CPU budget and actual Auth/CRUD with separate DB; no Production DB writes or fake fixtures for acceptance.
- **M4:** promote Owner-approved build/code to existing Production Worker; verify `/admin`, least privilege, session, controlled Product/Blog editing, and Public freshness. Backup/rollback before cutover.

Use focused tests and required CI, not extra manual environment approval loops or six independent preview deployments. **Never** expose Production DB secrets via Staging/client. Runtime CPU and DB connection behavior must be measured on hosted Cloudflare before saying compatible.

## Rollback

Cloudflare Workers: **Workers & Pages → Worker → Deployments → previous version → Rollback**, or Wrangler rollback with explicit verified Worker and account. Rollback **application code only**. SQL migration, changed rows and external media may need backups/restore; maintain those separately. Log source SHA, Worker version, URLs and the rollback boundary in the active milestone issue.

## Historical code references

`apps/public/` is the deployed Public adapter. The full old Admin lives in `src/app/admin/`; `apps/admin/` was a separate unfinished implementation, **not** the current recovery target. PRs #300/#301/#304 are implementation references, not standalone active milestones.
