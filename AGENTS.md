# ĐÔNG PHÚ GIA V1 — instructions for every AI agent

**CURRENT OWNER DECISION (2026-11-13).** This file is the **sole active work policy** for repository `tranhuunguyenhuy-hue/dongphugia.com.vn`. Read it and the assigned Issue. If needed, read `docs/PROJECT.md` and the **specific** deployment/data reference. Older issues, PRs, ADRs, plans and tool-generated handoffs are historical evidence only, **not** authority. Never start old work just because a document or open branch mentions it.

## One goal, five milestones, strictly ordered

Master: [#306](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/306).

1. **ACTIVE M1 [#307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307):** Public **Production** connects to V1 Supabase PostgreSQL; full restored Products/SKUs and Blog are verified **in hosted DB and served by actual Public read path**. Protect current storefront and preserve an immediately usable snapshot fallback.
2. **QUEUED M2 [#308](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/308):** existing Cloudflare Worker `dpg-staging` renders Public parity with Production; it **may use snapshot**. Working URL, desktop/mobile check, rollback. No new Cloudflare Preview.
3. **QUEUED M3 [#309](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/309):** restore **all legacy Admin modules** on Staging, real login/permissions and CRUD against an **isolated test PostgreSQL DB**. Reuse recovered `src/app/admin` rather than replacing with a new app shell. Inventory and prove each module, not just Products + Blog.
4. **QUEUED M4 [#310](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/310):** deploy Owner-accepted Admin to Production, verify protected login, DB permissions, Product/Blog writes and freshness on Public, backups and rollback.
5. **QUEUED M5 [#311](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/311):** post-restoration audit and separate future-upgrade proposal. No implementation of unapproved additions.

**Never substitute:** PR merge / local synthetic test / HTTP 200 / Cloudflare deployment record for deployed real-flow acceptance. Record **PASS / FAIL / UNKNOWN** and evidence.

## Environment contract

- Development and rapid preview: **localhost** only. No mandatory remote Preview service or PR preview workflow.
- Staging: existing `dpg-staging` Cloudflare Worker; fixed environment for Owner review. Public snapshot is allowed at M2; Admin test database must be isolated at M3. Worker rollback is **not** PostgreSQL rollback.
- Production: existing `dongphugia-v1-public-production` Worker, serving `www.dongphugia.vn` and `dongphugia.vn`. Target Admin: **same origin /admin**. Do not switch to `admin.dongphugia.vn` on your own.
- V1 Cloudflare account (verify live before any write): `d54f3402b9d112ab64d6135e0e3f1fb1`. V1 Supabase candidate `bonxyxluzlxfkdetryoo`: **verify the current actual target/schema/permissions**. V2 is a separate project. Never touch V2.
- Cloudflare Workers for both Public and Admin is approved **Option A**; Node.js compatibility support is not proof the legacy Admin passes Cloudflare CPU/Prisma/auth constraints.

## Workflow for the *single active milestone*

1. Read assigned Issue #307 (then next milestone only after acceptance). Check fresh `main`, exact deployed Worker version and target database state. Do **not** automatically spawn more agents, start multiple competing implementations, or resume old PR queues.
2. Select the shortest working path. Reuse existing code/commits when verified (legacy Admin #300, local workerd #301, DB role #304 are **reference only**). One integration branch/PR for the current milestone. No lengthy speculative research, new governance layers or unrelated redesign.
3. Develop and test on localhost. Run **focused tests + relevant typecheck/build** and one functional smoke in the affected real runtime. Keep existing mandatory branch checks; do not invent extra approval gates, CI workflows, previews or independent audits for every fix. On two repeated failures, change approach and report exact blocker.
4. For shared/Production database actions: confirm correct target, current backup, recoverability, schema, row counts and data provenance **before** imports/migrations. Prefer idempotent, reversible steps; read-only Public DB role; minimal Admin write permissions. Never expose credentials or store them in code. No destructive data loss, security bypass or unapproved costs.
5. After each delivery, update its **one** milestone Issue with source SHA/PR, deployed URL + version, DB count and sample evidence, specific PASS/FAIL/UNKNOWN, rollback path, and whether Owner acceptance remains. Do not declare milestone done without direct runtime proof.
6. Do not silently deploy changes to Production merely because a PR merged. Owner's approved M1–M5 plan sets priority; risky cutovers, destructive data changes and promotion M4 need recorded target-specific acceptance. Complete independent safe work instead of waiting unnecessarily.

## Scope freeze and source truth

**Canceled / not active:** legacy Phase 2 roadmaps, cart/checkout/order features, variant feature research, catalogue crawling, new Admin implementation, Cloudflare branch previews, AWS/EC2/Coolify staging, extra Workers, new DNS/custom domain, unrelated SEO/promotion optimization, independent reviews and auto-Codex dispatchers. Old tasks/PRs are superseded. **Do not merge or resume them.**

**Preserve while restoring:** correct canonical UI (home/banner/menu/category/PDP), known products/SKUs/slug/price provenance, Blog/media/SEO, actual database backups, migrations, evidence and reversible rollback scripts. Missing/uncertain price = `Liên hệ báo giá`; verified historical price must be labeled as reference, never current stock or confirmed price. Do not manufacture relationships or data.

Docs hierarchy: `AGENTS.md` → active Issue → `docs/PROJECT.md` → `docs/ops/project-current-state.md` → specific technical recovery/runbook. Archived Git history is for provenance only. Any conflicting legacy document loses to this decision. GitHub issues are closed rather than deleted to retain verifiable work history.
