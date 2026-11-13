# ĐÔNG PHÚ GIA V1 — instructions for every AI agent

**CURRENT OWNER DECISION (2026-11-13).** This file is the **sole active work policy** for repository `tranhuunguyenhuy-hue/dongphugia.com.vn`. Read it and the assigned Issue. If needed, read `docs/PROJECT.md` and the **specific** deployment/data reference. Older issues, PRs, ADRs, plans and tool-generated handoffs are historical evidence only, **not** authority. Never start old work just because a document or open branch mentions it.

## One goal, five milestones, strictly ordered

Master: [#306](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/306).

1. **ACTIVE M1 [#307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307):** Public **Production** connects to V1 Supabase PostgreSQL; full restored Products/SKUs and Blog are verified **in hosted DB and served by actual Public read path**. Protect current storefront and preserve an immediately usable snapshot fallback.
2. **QUEUED M2 [#308](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/308):** create/use **ONE fixed Worker Preview named `staging` INSIDE `dongphugia-v1-public-production`**, not the separate `dpg-staging` Worker. Verify Public parity with Production; snapshot allowed; fixed Preview URL, desktop/mobile and exact deployment evidence.
3. **QUEUED M3 [#309](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/309):** restore **ALL legacy Admin** under `/admin` ON THE SAME FIXED Preview `staging`, including **real Hyperdrive, PostgreSQL, authentication, sessions, roles and full necessary features/CRUD**, against an **isolated test PostgreSQL database**. Reuse `src/app/admin`; no disabled login shell or substitute CMS.
4. **QUEUED M4 [#310](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/310):** deploy Owner-accepted Admin to Production, verify protected login, DB permissions, Product/Blog writes and freshness on Public, backups and rollback.
5. **QUEUED M5 [#311](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/311):** post-restoration audit and separate future-upgrade proposal. No implementation of unapproved additions.

**Never substitute:** PR merge / local synthetic test / HTTP 200 / Cloudflare deployment record for deployed real-flow acceptance. Record **PASS / FAIL / UNKNOWN** and evidence.

## Environment contract

- **Localhost:** development and focused tests; no automatic Preview per Git branch/PR.
- **Fixed Preview `staging`:** a named Preview inside Production Worker `dongphugia-v1-public-production` (same Worker, independent Preview deployment and URL), M2/M3 acceptance target. Worker Previews **do not inherit Production settings**: explicit Preview vars/secrets and **distinct Hyperdrive config pointing at isolated TEST DB/schema**. Owner AUTHORIZES **full legacy Admin, Hyperdrive, real login/auth/session and other needed functionality** there. Preview URLs public by default: use Cloudflare Access/equivalent plus app authorization. No Production write credentials or Production DB mutations from Preview. Old `dpg-staging` Worker is superseded, not to be used or deleted in this docs-only change.
- Production: existing `dongphugia-v1-public-production` Worker, serving `www.dongphugia.vn` and `dongphugia.vn`. Target Admin: **same origin /admin**. Do not switch to `admin.dongphugia.vn` on your own.
- V1 Cloudflare account (verify live before any write): `d54f3402b9d112ab64d6135e0e3f1fb1`. V1 Supabase candidate `bonxyxluzlxfkdetryoo`: **verify the current actual target/schema/permissions**. V2 is a separate project. Never touch V2.
- Cloudflare Workers for both Public and Admin is approved **Option A**; Node.js compatibility support is not proof the legacy Admin passes Cloudflare CPU/Prisma/auth constraints.

## Workflow for the *single active milestone*

1. Read assigned Issue #307 (then next milestone only after acceptance). Check fresh `main`, exact deployed Worker version and target database state. Do **not** automatically spawn more agents, start multiple competing implementations, or resume old PR queues.
2. Select the shortest working path. Reuse existing code/commits when verified (legacy Admin #300, local workerd #301, DB role #304 are **reference only**). One integration branch/PR for the current milestone. No lengthy speculative research, new governance layers or unrelated redesign.
3. Develop and test on localhost; use **exactly one fixed Preview** for M2/M3 hosted verification: `npx wrangler preview --worker-name dongphugia-v1-public-production --name staging` with correct repo Wrangler settings. No per-PR Preview automation or new Worker. Run focused tests, relevant typecheck/build and real Preview login/CRUD smoke. On two repeated failures change approach; record blocker.
4. For shared/Production database actions: confirm correct target, current backup, recoverability, schema, row counts and data provenance **before** imports/migrations. Prefer idempotent, reversible steps; read-only Public DB role; minimal Admin write permissions. Never expose credentials or store them in code. No destructive data loss, security bypass or unapproved costs.
5. After each delivery, update its **one** milestone Issue with source SHA/PR, deployed URL + version, DB count and sample evidence, specific PASS/FAIL/UNKNOWN, rollback path, and whether Owner acceptance remains. Do not declare milestone done without direct runtime proof.
6. Do not silently deploy changes to Production merely because a PR merged. Owner's approved M1–M5 plan sets priority; risky cutovers, destructive data changes and promotion M4 need recorded target-specific acceptance. Complete independent safe work instead of waiting unnecessarily.

## Scope freeze and source truth

**Canceled / not active:** legacy Phase 2, cart/order/checkout, variant research, catalogue crawling, new Admin, **automatic per-branch Cloudflare Preview builds**, **using separate `dpg-staging` Worker**, AWS/EC2/Coolify staging, extra Workers/DNS/domain, unrelated SEO/marketing, extra approval workflows, multi-agent auto-dispatch. Old issues/PRs remain closed as superseded; preserve useful source/rollback.

**Preserve while restoring:** correct canonical UI (home/banner/menu/category/PDP), known products/SKUs/slug/price provenance, Blog/media/SEO, actual database backups, migrations, evidence and reversible rollback scripts. Missing/uncertain price = `Liên hệ báo giá`; verified historical price must be labeled as reference, never current stock or confirmed price. Do not manufacture relationships or data.

Docs hierarchy: `AGENTS.md` → active Issue → `docs/PROJECT.md` → `docs/ops/project-current-state.md` → specific technical recovery/runbook. Archived Git history is for provenance only. Any conflicting legacy document loses to this decision. GitHub issues are closed rather than deleted to retain verifiable work history.

## Fixed Preview technical authority (Owner-approved)

M1 Production DB-backed Public stays first. M2/M3 use the *single* `staging` Preview inside the Production Worker with a stable URL and independent Preview version history. Preview may have full legacy Admin functionality **only with real auth and isolated test data**, never a Production writable Hyperdrive binding. `wrangler preview` does not deploy Production. Protect Preview's public URL, check Cloudflare CPU fit and Hyperdrive behavior in hosted Preview, and record URL/ID/auth/CRUD proof. See `docs/deploy/cloudflare-fixed-preview-production.md`. Worker code rollback does not restore SQL writes. Do not decommission `dpg-staging` yet.
