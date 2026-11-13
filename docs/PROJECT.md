# Đông Phú Gia V1 — technical handbook (CURRENT)

Effective: **2026-11-13**, supersedes former V1 roadmap/Phase 2 and dated AWS/Preview handoffs. **For execution authority read root `AGENTS.md` and the current milestone Issue.**

## Goal and hard milestone sequence

| Gate | Owner outcome | Issue | Validation |
| --- | --- | --- | --- |
| **M1 ACTIVE** | Production Public uses V1 PostgreSQL; **all recovered Products/SKUs and Blog** loaded, counted, verified, served on Public | [#307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307) | Hosted row counts + source reconciliation + actual Worker DB read-path + production URL smoke + snapshot fallback |
| M2 QUEUED | Cloudflare `dpg-staging` visually/functionally matches Public Production; **snapshot allowed** | [#308](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/308) | Staging URL, UI/Blog/PLP/PDP responsive parity, real Worker deployment and rollback |
| M3 QUEUED | **Entire existing legacy Admin**, not new Admin shell, usable on Staging with isolated DB | [#309](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/309) | Module inventory + login/session/RBAC + product/blog CRUD + end-to-end Staging data persistence |
| M4 QUEUED | Deploy accepted Admin to same-origin Production `/admin` | [#310](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/310) | Owner acceptance, backup, Production login/CRUD/fresh Public, rollback |
| M5 QUEUED | Audit website and propose future backlog | [#311](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/311) | Issue-level findings with URLs, priority, estimates; no automatic feature work |

Master tracker: [#306](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/306). Milestones are sequential; only M1 is active until accepted.

## Live environment architecture and provenance

- Cloudflare V1 account: `d54f3402b9d112ab64d6135e0e3f1fb1` (revalidate before modifying).
- Production Worker: `dongphugia-v1-public-production`, custom domains `www.dongphugia.vn`, `dongphugia.vn`. Last observed deployed version `7d0194d7-b007-4fb0-9fd9-d365ca9de834`, 2026-11-04 15:05 UTC. Current Public catalogue is **snapshot-backed**, NOT confirmed live PostgreSQL.
- Staging Worker: `dpg-staging`, workers.dev enabled, no custom domain. Last observed version `f0cabc41-f024-46cc-8978-510c3d8c1216`, 2026-11-13 06:13 UTC. Its prior deployed Admin sign-in shell **does not prove** authenticated/Admin CRUD support.
- At last Cloudflare read-only check, neither Worker had a Hyperdrive DB binding or Worker secrets; both had `nodejs_compat`. Cloudflare versions/deployments can be rolled back; database writes/migrations cannot.
- Supabase V1 candidate `bonxyxluzlxfkdetryoo`, application schema candidate `dpg_app`; **confirm hosted identity, schema, rows, permissions and actual owner**. Never confuse with V2.
- PR #300: legacy Products/Blog Admin source recovered locally. PR #301: local Workerd/Prisma test only. PR #304: proposed least-privilege DB role tested locally. **None constitutes hosted Admin or Production database import proof.** Reported 17,752 Products and 10 Blogs are local recovery evidence until independently reconciled on hosted DB.

## M1 — Production database recovery contract

1. Inventory source and destination: source of truth, 27-table historical backup/other supported recovery assets, products vs SKU semantics, public status, unique keys, category, slug, price source, media, Blog posts/slugs/body/images. Determine actual definitive counts from verified source; do not hardcode 17,752/10 as success threshold.
2. Verify hosted V1 database target and safety: fresh backup and testable restore point, migration parity, read-only reporting, free-tier size/CPU/cost limits. No blind destructive restore, overwrite or schema changes.
3. Import or reconcile missing source content idempotently with duplicate-safe keys; report totals, published totals, exact-SKU coverage, image references, Blog status and broken routes, unresolved discrepancies.
4. Add a **read-only** Worker-to-PostgreSQL adapter (Hyperdrive if measured compatible), scoped credentials/secret, finite query pagination, caching/freshness, graceful handling of DB unavailability. Keep canonical Public UI. No service credentials in browser.
5. Prove **actual** Production Public read path uses hosted PostgreSQL, not just a DB population. Validate sampled category/PLP/PDP/search and all published Blog routes. Keep snapshot as pretested fallback; document Worker rollback and DB restoration separately.
6. No price, stock, family or Blog publication assertions without evidence. If price unverified show `Liên hệ báo giá`; historical reference price needs clear provenance label.

M1 is complete **only when hosted DB is reconciled AND Production Public visibly serves it.**

## M2 — Staging

One existing Cloudflare Worker `dpg-staging`; localhost replaces remote Preview. Match current Production visuals and behavior, including HeroBanner, categories, SKU search, PDP and Blog. Staging may read published snapshot/allowlisted Public assets at this milestone, but it must not claim fresher data than Production. Evidence: URL, source Worker version, desktop/mobile parity, rollback. Staging Admin in M3 uses **isolated** test database with no Production write pathway.

## M3 — legacy Admin source and end-to-end functional scope

Target the canonical old `src/app/admin` and associated server modules, not a new `apps/admin` design. First compare original Admin route inventory to restored code: dashboard, auth and account lifecycle, Products/SKUs, Blog and other existing modules. Explicitly list present, missing, disabled and unsupported functions; **Products+Blog only is not “full Admin.”** Restore missing legacy functions within actual historic scope; do not invent new commerce features.

Hosted Workerd compatibility test must establish real login/session, permission denials, streamed SSR, Prisma/connection pooling, Cloudflare CPU budget, Product/Blog writes, audit and reload persistence using an isolated test PostgreSQL DB. Build/test locally first, promote to Staging for real integration. Do not unlock private pages by disabling Auth, do not share privileged DB access with Public and do not rely on a login-shell HTTP 200.

## M4 — Production promotion

After M1–M3/Owner acceptance: use reviewed artifact/code, same-origin `/admin`, V1 Production credentials with least privileges and recovery/backup. Validate Production read + bounded reversible write, actual Public refresh/invalidation and complete logged-in Admin smoke. Roll back Worker version as needed; SQL changes require their own restore/reverse plan. Never interpret successful upload as successful running Admin.

## M5 and exclusions

Only post-recovery audit for broken images/routes, product data, Blog media, SEO, design parity, CPU and performance, auth and backup correctness. Defer all elective features until new approval. Explicitly canceled: Phase 2 cart/order/checkout, new Admin platform and independent Admin domain, variant research/crawler, multi-agent parallel orchestration, PR previews, old AWS/EC2/Coolify staging, speculative infrastructure and separate approvals to prepare each local test.

## Source structure and data rules

- Canonical prior UI in `src/app/(public)/`, `src/components/`; deployed Public runtime `apps/public/` is adapted to Worker. Avoid unrelated UI rewrites.
- Legacy Admin in `src/app/admin/`; new `apps/admin/` is archival/experimental, not M3/M4 target.
- Database source in `prisma/`, `db/`, `supabase/`; code/SQL migrations must not be auto-applied just because checked in.
- Product identity, SKU, category, status, prices, slug, canonical path and Blog publication are first-class; manufacturer/document provenance is evidence, not licence to infer current price.
- External media remains Bunny-compatible; verify image bytes, not merely stored URL.
- Preserve rollback SQL/sha256, backups, imports, provenance and required CI even when deleting old **policy** documentation; these remain technical assets, not active work tickets.

See `docs/deploy/cloudflare-staging-production.md` and `docs/deploy/postgresql-production-adoption-contract.md`. Snapshot evidence is kept in `docs/ops/project-current-state.md`, but **live provider verification overrides date-stamped observations**.
