# Đông Phú Gia V1 — CI/CD fast lane

**Owner decision 2026-11-13:** prioritize real Production results; one critical GitHub quality gate and one explicit release workflow, not competing AWS/Pages/Preview/Staging worker pipelines.

## Verified problem

- Existing Cloudflare Workers Builds was linked to GitHub `main` with `build_command: npm run build`, `deploy_command: npx wrangler deploy`, root `/`, caching OFF, paths `*`. Root `build` runs legacy Next.js, **not** the `apps/public` Worker builder.
- A Cloudflare Build on 2026-11-13 failed upload: service binding `WORKER_SELF_REFERENCE` referred to missing Worker `dongphugia-web` (Cloudflare API code 10143). This is why a GitHub push/merge did not create a valid Production update.
- Repo had 36 workflow files; only the GitHub **`quality`** status was mandatory on `main`. Extra automatic homepage/local environment/PR preview jobs slowed down even docs PRs. Their automatic triggers are retired; historical manual flows are not work authority.

## Standard path

1. Codex edits active milestone on one branch; localhost tests. `quality` is the required check. For docs-only, classify and skip expensive PostgreSQL/npm/tests; for code, run actual tests, lint and typecheck.
2. Owner/agent integrates the reviewed commit to protected `main`. Do **not** assume Cloudflare deployed that SHA just because `quality` passes.
3. Go to **GitHub Actions → V1 Worker release → Run workflow → main**. First choose **`publish=false`** to build the actual Public Worker, produce a source-pinned artifact and run Wrangler dry-run and identity checks. If it fails, fix the source, don't deploy a fallback unreviewed root Next.js app.
4. After M1 data/source acceptance or later M4 Preview Admin acceptance, rerun with **`publish=true`**, using the latest protected `main`. Workflow uses `Production` GitHub environment credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`), builds and packages the exact `apps/public` Worker, deploys it to `dongphugia-v1-public-production`, and checks actual domain.
5. Record GitHub run, source SHA, Worker deployed version, Public and Blog URL smoke, DB Products+Blog counts and rollback route in the active issue. A successful deploy **without M1 database-backed Product/Blog completeness** does NOT complete M1.

## Environments and security

- Localhost development; **one fixed Preview `staging` inside Production Worker** for M2/M3 and isolated TEST Hyperdrive/Auth; same Worker's Production deployment for M1/M4.
- No automatic Production deploy on every `main` push. Existing Cloudflare direct Workers Builds is misconfigured and must not be a parallel publisher. Build-trigger exclusion/suspension is intentional until one pipeline is authoritative.
- Never use Production secrets in Preview or privileged DB access in Public. Preview/auth/data writes need separate TEST DB/roles and Access; Production data migrations need backup/restore proof.
- Worker rollback via Cloudflare Deployments only restores code; SQL changes and imports need separate restore/rollback.
- At least homepage and Blog smoke, identity verification, and runtime error check on real Worker, not only a green GitHub job.
