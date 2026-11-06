# Dong Phu Gia — Codex entry point

**This is the complete startup context. Read this file once and start the
requested task. Do not preload `docs/`, `.agents/skills/`, past PRs, old
handoffs, ADRs, runbooks, or a second context file.** Use
[`docs/PROJECT.md`](docs/PROJECT.md) only if the active task needs detailed
domain, architecture, deployment, or troubleshooting reference.

## Project and objective (snapshot: 2026-11-06)

- Repo: `tranhuunguyenhuy-hue/dongphugia.com.vn`, base branch `main`.
- Customer website: `https://www.dongphugia.vn`; staff application target:
  `https://admin.dongphugia.vn`.
- Business: Vietnamese building-materials retailer. Four catalogue sectors:
  Thiết bị vệ sinh, Gạch ốp lát, Thiết bị nước, Thiết bị bếp.
- **Current delivery tracks:** P0 Public recovery (#260) is still open;
  do not assume it is complete or deployed. **Phase 2 (#270) is the next
  requested source-work track**: verified PDP variants, footer parity,
  durable guest cart/order and staff Admin/CMS. Keep Phase 2 isolated from
  the P0 Production candidate; do not fold either into unrelated migration.
- Work authority: GitHub [#260](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/260)
  (P0 Public recovery), [#270](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/270)
  (Phase 2), [PR #272](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/272)
  (cart/order), [PR #282](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/282)
  (workflow/docs). **These are dated pointers, not confirmed current status:
  inspect the relevant GitHub item only when the request touches it.**
- **Phase 2 handoff:** first inspect Issue #270 and existing PR #272/branch
  ownership; continue an active owned PR rather than starting a conflicting
  branch. Verify 17-group/51-product variant coverage against real source,
  footer desktop/mobile parity, persistent and idempotent guest orders, and
  denied unauthorized Admin actions. UI/source work may proceed without a
  blanket database-backup gate; DB/Auth/provider writes require their own
  exact approval and recoverable data. The choice between legacy Admin
  restoration and new Supabase Auth/Admin remains **UNDECIDED** in #270.
- The 2026-09 V1 design handoffs had a global wireframe-freeze condition.
  They were consolidated, **not converted into blanket authorization** for
  new V1 schema/architecture implementation. The newer Phase 2 recovery
  issue governs bounded source work; settle new-V1 design decisions before
  irreversible writes. Specific details: `docs/PROJECT.md` §2A.
- **Runtime caution:** repository contains legacy AWS EC2/Coolify/Prisma/
  PostgreSQL and Cloudflare Workers/Supabase recovery/Preview code. Older
  documents conflict on which serves Production. Verify the actual target
  and deployed version before any Production action; do not assume a migration
  completed from source history or a Preview build.

## Where to work

- `src/app/(public)/`, `src/components/`, `src/lib/`: canonical legacy Public
  UI/component tree (reuse visual design; do not silently fork it).
- `apps/public/`: Cloudflare-oriented Public runtime/adapters.
- `apps/admin/`: separate staff-only Admin app.
- `packages/`: shared pure contracts; `prisma/`, `supabase/`, `db/`:
  data schema/migrations — touch only when explicitly in scope.
- `scripts/`: builds, tests, catalogue/media utilities; `.github/workflows/`:
  CI, Preview and release mechanisms.
- `docs/PROJECT.md`: **one** consolidated detailed reference. Existing
  `docs/deploy/` and `docs/adr/` files are specialized operational/decision
  evidence, **not routine session context**. Read exactly one only if this
  task depends on its executable contract. Ignore historical `docs/internal/`
  handoffs and old snapshot files.

## Domain rules that must survive refactors

- Product = one canonical PDP/model. SKU = exact sellable choice. A Product
  Line/Family (Dòng sản phẩm) is 1–3 *dependent* ordered option axes; each
  valid path resolves to an existing Product or exact SKU. No invented
  variants, combinations, products, or family-level price/SEO identity.
- SKU may override price, availability and media; missing SKU-specific values
  fall back to Product. Keep the real Product/SKU identities in cart/order.
- Canonical Product pricing: regular `price`, optional lower `sale_price`,
  optional `voucher_online_discount_amount` for online ordering; display
  `sale_price ?? price`. Never present an uncertain price as confirmed.
  Historical restored Public price snapshots are provenance-controlled
  display data, not proof of current sale price.
- Orders are **guest requests** until staff confirmation. Normal status:
  `NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`; payment:
  COD or BANK_TRANSFER. Pending shipping/installation fee is **not 0**.
  Order line and monetary snapshots remain immutable.
- Keep public catalogue visibility and SEO eligibility tied to valid product,
  price, category, availability and media. Protect canonical URLs, redirects,
  structured data and sitemaps.
- Public and Admin must not share privileged browser state. Enforce
  authorization and Supabase RLS/server-side boundaries; never expose secrets,
  staff roles or service keys through Public.
- Keep existing Bunny-compatible media URLs/allowlists unless the request
  explicitly changes media; URL metadata is not proof the file bytes exist.

## Default workflow — deliver, don't over-process

`Request → minimal change → focused checks → one PR → Owner approval → release
(if requested) → live smoke`

1. Understand the desired visible outcome. For a small clear task, **do not
   create Issue/spec/ADR**, read whole docs, or schedule repeated review.
2. Check current `main`, open relevant PRs and changed files; make one
   short-lived `codex/<task>` branch and one bounded PR. Do not reset,
   rebase, delete or rewrite unrelated work.
3. Run narrow validation: docs = diff/references; UI = rendered output;
   business behavior = targeted tests plus applicable lint/typecheck; broad
   change = relevant integration/build. Required GitHub CI still applies.
4. **Risk based, not ceremonial:** CSS, copy, footer, read-only SEO require
   no database backup, restore rehearsal or unrelated infrastructure gate.
   Data/schema, payments, privileges, secrets, uploads and DNS/CDN cutovers
   need specific approval, scoped recovery evidence and relevant safeguards.
5. Owner approves merge and Production candidate/target. Combine approvals
   only where automation actually binds one reviewed candidate to exact
   deployment. Never confuse PR merge, preview artifact and live Production.
6. Release to verified runtime; check impacted live URLs/flows, errors and
   rollback readiness. Report: result, PR/commit, checks and Production status.
7. After **two failures with the same technique**, diagnose/change approach
   rather than looping. Mark unverified evidence `UNKNOWN`. Stop after
   acceptance; unrelated findings become nonblocking follow-ups.

## Quick commands and escalation

- Default checks: `npm run lint`, `npm run typecheck`, `npm test`.
  Use affected app build and rendered checks when appropriate, not automatic
  `npm run build` for unrelated documentation changes.
- Do not paste credentials, tokens, customer rows, database URLs or private
  provider values into code, PRs or reports.
- For exact domain decisions, deployment/rollback, publishing credentials,
  catalogue migration or incident recovery: read **only the corresponding
  section** of `docs/PROJECT.md`, then its one linked specialized file if
  needed. Revalidate live providers before writes.
- Preserve existing CI, code/test gates and explicit Owner authority. A
  documentation cleanup does not authorize database or Production mutation.
