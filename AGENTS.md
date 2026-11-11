# Dong Phu Gia — Codex entry point

**This is the complete startup context. Read this file once and start the
requested task. Do not preload `docs/`, `.agents/skills/`, past PRs, old
handoffs, ADRs, runbooks, or a second context file.** Use
[`docs/PROJECT.md`](docs/PROJECT.md) only if the active task needs detailed
domain, architecture, deployment, or troubleshooting reference.

## Project and objective (snapshot: 2026-11-11)

- Repo: `tranhuunguyenhuy-hue/dongphugia.com.vn`, base branch `main`.
- Customer website: `https://www.dongphugia.vn`; staff application target:
  `https://admin.dongphugia.vn`.
- Business: Vietnamese building-materials retailer. Four catalogue sectors:
  Thiết bị vệ sinh, Gạch ốp lát, Thiết bị nước, Thiết bị bếp.
- **Current delivery tracks:** P0 recovery [#260](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/260)
  remains separate; verify its live state when a task depends on it. Phase 2
  sources are tracked by [#270](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/270)
  and integrated candidate [PR #291](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/291).
  The bounded Public + Admin Preview is [#290](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/290).
- **Phase 2 choices are settled:** retain the separate `apps/admin` application
  with Supabase Auth/RLS; Preview covers only the existing bounded modules. Do
  not restore the legacy monolithic CMS or describe excluded modules as accepted.
  Continue the owned integration PR and verify variant/cart/order, staff-denial,
  publication-integrity and desktop/mobile evidence on the exact candidate.
  Hosted writes require the recorded exact-target authorization and recovery path.
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

## Owner setup checklist (not yet verified or provisioned)

Complete once, then verify access without printing credential values:

- [ ] Workspace: writable task checkout, network access to approved registries/GitHub,
  toolchain matching package.json/lockfile, browser testing and disposable PostgreSQL
  via local containers or CI. Allow scoped development commands; keep privileged
  system and destructive actions outside blanket approval.
- [ ] GitHub identity: repository read, task-branch push, Issue/PR updates, review
  requests, Actions logs/artifacts and approved CI dispatch. Verify a test branch/PR.
  Protect main with required checks and Owner review; Agent cannot bypass protections.
- [ ] Credentials: inject development/staging secrets via a secret manager or ignored
  local environment; CI secrets belong in scoped GitHub environments. Record variable
  names, custodian, expiry and renewal method, never values. Test credential validity.
- [ ] Staging authorization: record project/resource identifiers, permitted operations,
  reset boundaries, budget/quota and credential scope. Separate Public/Admin origins,
  database/Auth, media storage and outbound integrations from Production.
- [ ] Accounts: synthetic guest/order/catalogue data plus authorized and unauthorized
  staff accounts. Configure staging Auth redirect URLs and test email delivery/sink.
- [ ] Production: separate deployment credentials and protected environment with Owner
  approval. Verify controls live; YAML alone does not prove reviewer enforcement.
- [ ] Intake: Owner assignment or an Owner-controlled `agent-ready` label authorizes
  pickup. Automatic pickup requires a separately implemented runner with one claimant
  per Issue; an arbitrary new Issue is not an execution grant.

## Staging and fast Preview plan (proposed, not a live-state claim)

1. **Verify target first.** Inventory current Public/Admin runtime and data adapters,
   deployed SHA, existing Preview resources and workflow permissions. Keep canonical
   Public UI and independent apps/admin. Match staging to the verified release target;
   do not create a second migration or assume older AWS/Cloudflare notes are current.
2. **Provision isolated integration staging.** Reuse a suitable existing isolated
   resource after verification. For a Cloudflare/Supabase target, use separate staging
   Worker resources and a separate database/Auth project; verify the Admin deploy
   adapter before choosing its hosting. For an AWS target, use its corresponding
   isolated staging runbook. Owner approves resource/cost setup once. Seed synthetic
   data and sandbox external side effects; preserve existing media URL contracts.
3. **Automate PR Preview as a separate implementation task.** Build/test the PR SHA,
   publish scoped Preview artifacts, and report URLs, SHA, artifact digest and checks
   to the PR. Use a trusted workflow with staging-only secrets; never expose secrets
   to untrusted fork code. Keep existing catalogue checkpoint/recovery workflows intact.
   The existing catalogue-public-preview-v2 workflow is manual and Owner-gated;
   it is not a general autonomous per-PR Preview pipeline.
4. **Control shared state.** Serialize integration deployments/migrations; use isolated
   PR datasets/schemas where supported or a queued exclusive staging slot. Apply only
   to the preauthorized staging target. Reset synthetic fixtures with scoped scripts;
   no production data copies. Prevent indexing and restrict staging access.
5. **Acceptance suite.** Exercise public navigation/PDP/variants, persisted guest
   cart/order and retry idempotency, staff login and permission denial, media and
   affected CMS flows. Validate desktop/mobile rendering, logs and runtime identity.
   Preview must run the affected backend flows, not only static pages.
6. **Promote predictably.** After Owner review, preserve the tested artifact where
   supported; if merge or environment-bound build changes it, validate the resulting
   candidate before release. Approve Production separately, smoke test, retain the
   previous artifact and a data-safe rollback plan. Expire unused Previews/fixtures.

Staging is ready when an assigned test Issue reaches a reachable Public/Admin
Preview with matching SHA, passing applicable integration/browser checks, isolated
writes and no Production credentials; subsequent updates need no repeated access
requests within the approved scope. Record setup evidence and outstanding blockers
in the setup Issue, rather than creating another general process document.

### Automatic PR Preview: concrete setup

Source workflows: `pr-preview-build.yml`, `pr-preview-publish.yml`,
`pr-preview-cleanup.yml` under `.github/workflows/`. Every PR builds Public and
Admin without provider secrets. After the publisher is merged into the default
branch, successful current PR builds publish a Public Worker. Admin is build-only:
this pipeline does not claim hosted Admin/Auth/order integration acceptance.
Existing quality and deterministic checks remain mandatory and independent.

Owner setup, in order:

1. In Cloudflare, prepare a dedicated Preview account with no Production resources,
   enable its workers.dev subdomain and record account ID/subdomain. Published PR
   code is untrusted and URLs are public; use only synthetic/public data. Select a
   budget and quotas before activation. Do not attach Production bindings/secrets.
2. Create an API token scoped only to that account with Workers Scripts Edit and
   Account Settings Read as required by Wrangler. Keep the value in a password/secret
   manager; do not put it in this file, an Issue or chat.
3. GitHub repository Settings → Environments → create `pr-preview`. Add secret
   `PREVIEW_CLOUDFLARE_API_TOKEN`, variables `PREVIEW_CLOUDFLARE_ACCOUNT_ID` and
   `PREVIEW_WORKERS_SUBDOMAIN` (the label before `.workers.dev`, without URL scheme).
   Permit the default branch's trusted publication/cleanup workflows. To avoid a
   prompt per PR, this isolated environment must not require a reviewer; keep
   Production's reviewer requirement. Restrict who may change environment settings.
4. Settings → Actions: allow the referenced GitHub-owned actions and workflow token
   permissions used here (Actions read, PR write for publication). Keep default token
   permissions read-only; grant writes only in the publisher. Preserve GitHub's fork
   execution approval policy. Fork builds may need initial maintainer approval and
   a missing PR association must fail closed. No cloud token is provided to PR builds.
5. Review/merge the workflow PR first. Push a harmless commit to a test PR to trigger
   build → publish. Verify the bot comment URL, source SHA, noindex smoke, required CI
   and real rendering. Close the PR and verify its `dpg-pr-N` Worker is removed.
   Existing PRs need a new synchronize event; failed runs remain visible in Actions.
6. PR #291 currently owns the Phase 2 Admin deploy adapter/integration candidate;
   inspect its current state and reuse that work instead of creating another adapter.
   For full Admin/backend staging, provision the separately approved Admin hosting
   and isolated Auth/database, then add an integration pipeline. Fake build-time
   Supabase values in this pipeline are placeholders, not working credentials.

The publisher reads the artifact as data, replaces deployment configuration with
an allowlist and installs pinned Wrangler outside the candidate. It never runs
candidate package scripts with deployment credentials. Failed identity/noindex
smoke does not count as a usable Preview. Inspect both Preview workflow runs when
no success comment appears; run the failed stage again after fixing setup.

Preview setup references: [GitHub workflow_run security](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run),
[Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/).
Local validation on this branch: Public and Admin builds, isolated Wrangler dry-run,
HTTP homepage 200 with source SHA/noindex, and health `synthetic-fixture` mode.
Hosted publication and cleanup remain unverified until setup and workflow activation.
