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

## Authority and autonomous delivery

This file is the single source of repository working policy. `docs/PROJECT.md`
is an on-demand technical/product reference. Skills supply techniques, not
additional approval gates. Explicit task instructions and tool permissions apply.
Dated task pointers above must be checked against the assigned Issue/current code;
an old unresolved decision does not reopen an already accepted decision.

Assignment by the Owner authorizes scoped source work through a review-ready PR:
inspect code/Issues/CI, select implementation and test boundaries, create a task
branch, edit source/docs/migration files, install locked dependencies, run checks
on disposable local/CI resources, commit/push the task branch, update its Issue/PR
and request Owner review. Preserve unrelated changes and existing branch ownership.
Choose technical details independently within established business/architecture
contracts. Record reasonable assumptions in the PR; continue without plan approval.
Writing a migration or authorization test is source work; applying it to a shared
hosted database or changing real staff permissions is an environment operation.

Owner approval remains necessary for merge, Production deployment, changes to
shared data/Auth/secrets/DNS, destructive operations or costs beyond an agreed
budget. A preauthorized isolated Preview may be used within its recorded scope.
This policy does not provision infrastructure or bypass sandbox/provider controls.
Ask only for a material unresolved business decision, scope expansion or missing
access that blocks progress. First inspect available evidence and finish independent
work. Report the failed operation, redacted evidence and the minimum action needed;
do not request secrets in chat or ask again for authority already granted.

## Issue to review, acceptance and closure

1. Read the assigned Issue and this file; check current main, relevant PRs and
   task ownership. Continue the existing owned branch or create `codex/<task>`.
   Read only technical references needed for the affected code.
2. Extract observable acceptance criteria and scope. Choose the solution and
   tests autonomously. A clear small task needs no extra spec, ADR or review round.
3. Implement and validate: docs = diff/references; UI = rendered desktop/mobile
   checks; behavior = focused tests and applicable lint/typecheck; schema/security
   = isolated integration and denial tests; broader changes = affected builds.
   Use package.json for commands. Preserve required CI and deterministic gates.
4. Self-review the diff against each acceptance criterion. Open/update one bounded
   PR, follow CI to completion and fix related failures. After two failures using
   the same method, diagnose/change approach. Mark unavailable evidence UNKNOWN.
5. Request Owner review only with a concrete result: PR/head SHA, acceptance-to-test
   evidence, CI status, Preview/screenshots where relevant, risks and rollback.
   A draft with blockers is not review-ready. Address review feedback and recheck
   changed behavior; renewed changes must be visible to the reviewer.
6. Merge only after Owner approval of the reviewed candidate. Deploy only with
   approval for the candidate/target and applicable operational safeguards.
   Verify deployed identity, impacted URLs/flows and errors; retain rollback evidence.
7. A source-only Issue closes after approved merge and acceptance. An Issue requiring
   release closes after approved deployment and successful smoke. Record evidence
   before closure; avoid automatic closing keywords for release-dependent tickets.
   Ready for review, merged and deployed are distinct states.

## Current Preview and Staging contract

- Local Preview runs only on the developer machine. Start it with
  `npm run preview:local`; Public `/` and Admin `/admin` share
  `http://127.0.0.1:8787`. It has no Cloudflare Worker, workers.dev URL,
  Cloudflare Preview token or publication path.
- Staging is one Cloudflare Worker, `dpg-staging`, in account
  `d54f3402b9d112ab64d6135e0e3f1fb1`. Public `/` and Admin `/admin` share
  `https://dpg-staging.tranhuunguyenhuy.workers.dev`.
- Both environments read current Production data directly through fixed,
  server-side GETs to the Production-published public catalogue. They do not
  copy Production data or present synthetic fixtures as environment data.
  Synthetic fixtures remain appropriate for isolated automated tests.
- The environment Worker binds no database, Supabase, service-role, Auth-admin,
  order, CMS, status, fee or upload write capability. Auth is disabled; private
  staff/customer data remains unavailable. Reject every non-GET/HEAD request
  before asset or app dispatch. `Path=/admin` is not browser isolation on a
  shared origin.
- Production runtime, domains, DNS, data and Auth remain unchanged. Do not
  change Production database roles/RLS/Auth, deploy Production, rotate tokens,
  add paid scope, or merge without the separate required authorization.
- Read [`docs/deploy/preview-staging-worker-foundation.md`](docs/deploy/preview-staging-worker-foundation.md)
  for the current implementation, acceptance and staging handoff. Older
  database-backed staging and Preview setup documents describe separate or
  historical workflows and do not configure these Public/Admin environments.

## Owner setup checklist

- Keep repository CI and branch protection in force; use the existing PR and
  reviewed source SHA. Do not create a second PR or replace the owned worktree.
- Local builds and browser checks receive no provider credentials. The staging
  publisher builds candidate code without Cloudflare credentials and consumes
  its data-only artifact from trusted default-branch code; deployments serialize
  on one Staging target.
- Before any Staging publication, require supported Cloudflare policy-scope
  evidence that the token is restricted to `dpg-staging`. A variable string or
  selected-Worker GET does not prove that Production write authority is absent.
  If supported scope evidence is unavailable, keep publication blocked and
  report the exact missing access. Never probe Production writes or request a
  secret in chat.
- The coordinator reviews the exact artifact, current Production baseline,
  scope evidence, smoke/log plan and rollback plan before any hosted operation.
  A draft PR or passing source CI alone does not establish hosted acceptance.
