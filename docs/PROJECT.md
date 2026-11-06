# Đông Phú Gia — Project handbook

> **Consolidated technical and product reference.** Root `AGENTS.md` is
> sufficient for every new Codex session; open this document **on demand**
> for a task involving implementation decisions, data, architecture, security
> boundaries or release. It replaces fragmented general process manuals,
> outdated wireframe handoffs, duplicate glossaries and speculative roadmaps.
> Snapshot: **2026-11-06**. Dated facts are leads, not live runtime proof.

## 1. Business goal and current work

Đông Phú Gia sells building materials through a Vietnamese catalogue storefront
with product discovery, product detail pages (PDP), manufacturer information,
editorial content, contact/quote flows and staff-confirmed order requests.
Product sectors: **Thiết bị vệ sinh; Gạch ốp lát; Thiết bị nước; Thiết bị bếp**.

**Operational priority:** make `https://www.dongphugia.vn` usable, accurate
and consistent with the approved public UI. Restore listings, PDPs, prices,
media, search, SEO and navigation before speculative capabilities. Protect
customer orders and catalogue integrity.

| Workstream | Tracked work | What to do |
| --- | --- | --- |
| P0 public recovery | [Issue #260](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/260) | Listings, PDP, pricing, media, search, SEO, canonical UI. |
| Phase 2 features | [Issue #270](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/270) | Product-line options, footer parity, guest cart/order, full Admin CMS. |
| Cart / order delivery | [PR #272](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/272) | Separate scoped change; recheck PR state before modifying overlapping code. |
| Delivery / docs cleanup | [PR #282](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/282) | Single Codex context, fewer redundant documents, risk-based workflow. |

These entries are an **as-of-date index**. GitHub Issues/PRs and current
source code give authoritative task status. Never claim a PR is merged, a
Worker is deployed, DNS is cut over or a provider restored from this table
alone. Unrelated catalogue reconciliation (TOTO, INAX, etc.) is its own work,
not an automatic blocker for Public UI restoration.

## 2A. Phase 2 continuation — scope, sequencing and Owner decisions

**Owner request:** [Issue #270](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/270)
is the task authority for restoring the remaining legacy experience in a
**later, independent candidate**. [PR #272](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/272)
is the existing cart/order implementation, not a branch to overwrite casually.
Check live GitHub status, current `main`, task-branch ownership, Preview and
available datasets before editing; avoid simultaneous writes by separate
agents. P0 [#260](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/260)
remained open at this snapshot; do not assume Phase 2 can be deployed until
its actual Production target, P0 state and rollback are confirmed.

**Execution order for a Codex session:**

1. **Inventory (read-only, narrow):** current `apps/public` and
   `apps/admin` runtime seams; legacy components/routes; verified Product/SKU
   groupings; current data/Auth authority; existing PR #272; actual Preview
   readiness. Record only differences necessary for the active Phase 2 slice.
2. **PDP/Dòng:** compare 17 currently tracked groups / 51 Products with
   old catalogue relationships; do not infer siblings from SKU prefixes.
   Test Product-changing versus SKU-only selection, default/override
   price/media/availability, valid dependent axes, canonical URL and
   search/PDP behavior. Provide coverage samples and responsive screenshots.
3. **Footer:** reproduce the approved former Production desktop/mobile
   structure, links, policies and contact actions, with working URLs and
   keyboard/accessibility checks. A screenshot alone does not prove links work.
4. **Cart and Order:** preserve Retail Cart versus Quote Cart. Show
   Product/SKU/quantity and authoritative effective pricing; checkout is
   guest-first, and the current `dpg_app` runtime persists each request as
   `pending` / `unpaid` while it awaits staff confirmation, with an
   idempotency/retry boundary. Keep the lifecycle semantics in ADR 0021.
   Do not display fake submission
   success, treat pending shipping/installation as zero, request bank transfer
   before staff confirms commercial totals, or duplicate an Order on retry.
   Verify browser `cart → checkout → acknowledgment`, database result
   and negative cases. See ADR 0021 for the durable commercial invariants.
5. **Admin/CMS:** distinguish *restoring old functionality* from *adopting
   the separate V1 Admin/Auth design*. Functional inventory spans staff
   login/invite/recovery, dashboard, Product/SKU/line management, media and
   publication readiness, Retail Orders, Quotes/Sales, content/campaigns,
   Contact Requests/customer care, staff/roles and managed bank-transfer
   settings. Restore only the slice the Owner accepts; server-side permission
   denials and module-by-module user flows are required for any activated
   staff operations.

**Owner decisions recorded in #270 (2026-11-04):** complete the separate
`apps/admin` application on the new infrastructure; do not rehost the legacy
monolithic Admin as an interim shortcut. Restore guest cart and order-request
submission first. Each request must be persisted once, acknowledged to the
customer, and available to authorized staff. Staff confirms the commercial
order offline; payment automation is out of this first slice. These decisions
replace the earlier open-choice wording in this section.

**Phase 2 completion boundary:** PR #272 implements the guest cart/order-request
slice and a minimal staff order inbox; it does not complete the full Admin/CMS,
verified PDP variants or footer parity. Keep those as later bounded slices.
The source-level direct Data API/RPC bypass is closed by a Worker-to-function
HMAC boundary, a dedicated least-privilege PostgreSQL login, and database-side
rate limiting. No hosted secret or connection has been configured by that
source change. Applying the migration, provisioning the login, setting hosted
Worker/Function secrets, or deploying either runtime still requires the exact
target backup/restore, Auth/RLS and isolated-Preview gates and Owner approval.
Passing local tests or CI does not clear those gates.

**Design provenance and approval:** older 2026-09 V1 Figma handoffs included
a global `V1 WIREFRAME APPROVED / FROZEN` gate and several review-candidate
screens. Their implementation details are preserved in Git history after
documentation consolidation. The 2026-11 Phase 2 recovery issue separately
authorizes bounded implementation/source restoration; it does **not**
implicitly approve a redesigned V1 schema, production DB mutation, changes
to staff privileges or new Auth rollout. When a chosen slice depends on
unfrozen V1 design, obtain a specific Owner decision before coding its
high-impact contract. Do not use the old global freeze wording as a
ceremonial blocker for independent reversible UI fixes.

**Done evidence for Phase 2:** representative real variant coverage,
before/after desktop/mobile Footer, repeat-safe persisted order without
duplicate, staff capability deny tests and per-module Admin acceptance,
focused CI, actual reachable Preview and Owner review. Any live data/Auth
mutation requires exact target-specific permission, recoverable copy and
rollback proof. Phase 2 Production promotion is a separate GO for the exact
candidate and target; source PR merge does not authorize it.

## 2. Repository / application topology

```text
AGENTS.md                 <- always-loaded Codex context
docs/PROJECT.md           <- this on-demand consolidated handbook
src/app/(public)/         <- established public UI layout and pages
src/components/           <- legacy/public reusable components
src/lib/                  <- legacy services and runtime helpers
apps/public/              <- separate Cloudflare-oriented Public deployable
apps/admin/               <- staff-only Admin deployable
packages/                 <- framework-neutral app contracts
prisma/                   <- legacy database/schema evidence
supabase/, db/            <- newer schema, policies, data migrations
scripts/                  <- domain utilities, tests, build/recovery gates
.github/workflows/        <- CI, preview, promotions and operational jobs
docs/deploy/, docs/adr/   <- narrow executable/decision references only
```

The legacy Public UI's visual hierarchy is an Owner-approved reference.
During Cloudflare migration, preserve the canonical component composition
and adapt data/interactions across runtime boundaries; **do not fork a new
unrelated storefront design** merely to bypass server dependencies.
Cloudflare Public and staff Admin have separate origins, configuration,
runtime, cookies and privileged access. Pure types may be shared; staff
secrets and permission checks are never browser/shared-public resources.

Source history includes both AWS EC2/Coolify/ARM64 Docker/Prisma/PostgreSQL
and Cloudflare Workers/Static Assets/Supabase Data API/RPC. A later plan may
describe Cloudflare as the desired authority while an older baseline describes
AWS as Production. **Resolve actual runtime identity from the live deployment,
DNS, Workers/Coolify and GitHub run evidence before release**. Do not silently
choose a target using historical snapshots.

## 3. Catalogue: canonical identity and publication

- **Product**: one manufacturer model and one canonical PDP/SEO identity.
  Products with different URLs are separate Products.
- **SKU**: exact sellable variant/configuration within a Product; one Product
  can have multiple real SKUs. Snapshot exact Product/SKU when a customer
  requests an order or Quote.
- **Dòng sản phẩm / Product Line**: zero-or-one membership per Product; a
  selection/navigation grouping, not an independently priced product.
- **Trục lựa chọn / Axis**: 1–3 ordered, **dependent** axes per Dòng.
  Only actual valid paths exist; never create a Cartesian matrix or invent
  missing combinations. An option path resolves to an existing Product
  (navigate to its canonical PDP) or a sellable SKU of the current Product
  (same PDP URL). Dòng owns no SKU/price/stock/SEO/availability.
- **SKU override**: SKU-specific price, sale price, online discount,
  availability and media override Product defaults only where explicitly
  supplied; missing SKU values fall back to Product. Resolve effective
  values server-side.
- **Package/BOM** and **Collection** differ from a Product Line: the former is
  an assembly/inclusion relation; the latter is editorial curation.
- **Brand**: manufacturer entity. **Category**: one primary leaf in the
  four-sector taxonomy. Ancestor categories derive from the tree; filters
  for size, colour, style, material, room etc. are attributes/facets rather
  than newly invented category branches.
- **Public Product**: eligible for indexable listing/PDP only when its approved
  category, media, provenance, positive public price and availability/publication
  conditions pass. Do not publish inferred or incomplete records.
- **Availability**: `InStock`, `PreOrder`, `QuoteOnly`, `Discontinued`;
  unknown legacy values require explicit mapping, not silent coercion.
- **Deletion/SEO**: preserve historic Order snapshots and real redirects.
  Only redirect a retired URL to a manually verified equivalent Public
  Product; do not blindly redirect to a category/homepage.

The current selector rules supersede older Product Family / retailer-package
handoffs. For a data-model/selection implementation, consult
[ADR 0022](adr/0022-v1-product-line-axis-option-family-model.md).

## 4. Public pricing and commerce

**Current V1 pricing model:**

```text
display_price  = sale_price ?? price
online_payable = display_price - (voucher_online_discount_amount ?? 0)
```

`price` is the regular Dong Phu Gia public selling price.
`sale_price` is optional, positive and strictly below `price`.
`voucher_online_discount_amount` is an optional extra fixed discount for
online ordering; not a general coupon engine. Unknown price, invalid discount
or insufficient evidence must not become a fabricated selling price. SKU
override follows the same semantics. Preserve price inputs and actual
discounts in immutable order/quote lines.
See [ADR 0020](adr/0020-v1-product-pricing-contract.md).

**Historical Public recovery exception:** a read-only snapshot may display
eligible restored legacy prices sourced from explicitly validated manual/Hita
provenance; such prices are **not** equivalent to confirmed current commerce
prices. Its contract is [ADR 0024](adr/0024-restore-historical-public-prices-on-cloudflare.md).
Public UI must label uncertainty rather than claim confirmation or charge an
unknown amount.

**Retail Order:** guest checkout submits a **request**, not an accepted paid
order. Flow `NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`;
`CANCELLED` is a terminal branch where allowed. Methods: COD and
BANK_TRANSFER. Default payment status is UNPAID. Staff confirms commercial
facts and any unknown shipping/installation fees before final total.
`pending` is semantically different from free `0đ`. Bank-transfer payment
instructions are actionable only after commercial confirmation. A staff
status change never marks money paid without a recorded payment event.
Client-supplied Product/SKU/price is not authoritative.
See [ADR 0021](adr/0021-v1-retail-order-staff-confirmation-and-pending-fees.md).

**Quote Request** stores immutable customer intention and selected Product/SKU
facts. **Quote** is the staff-negotiated offer. A public share token produces
a read-only view; it does not grant edit, Admin or customer-account rights.

## 5. Public UI / content / SEO

- Reuse the existing Public component tree and established design tokens.
  Prefer the effective CSS/Tailwind `@theme` tokens in
  `src/app/globals.css` and existing components to stale mockup values.
  Do not revive old Airbnb-style experiments as a redesign directive.
- Tailwind CSS v4: preserve `@source` declarations; do not add a legacy
  `tailwind.config.js`. Legacy theme reference `brand-500` uses `#2D90AF`
  in the old application guide; verify active tokens in the changed runtime.
- React/Next: Server Components load data; Client Components own interaction;
  await Promise-valued `params`/`searchParams`; validate at boundaries,
  avoid unguarded navigation and preserve server authorization.
- Public pages need keyboard/focus/accessibility, responsive behavior, and
  correct Vietnamese copy. Preserve the approved homepage hero, navigation,
  product cards, listing/PDP, editorial/news and footer presentation.
- Site canonical base is `https://www.dongphugia.vn`. Preserve SEO metadata,
  title template, sitemaps, Product/Breadcrumb/Organization structured data,
  validated 301/410 routing, real canonical PDP URLs and noindex for Preview.
  Avoid treating a historical static export's product count as a live count.
- Publishing Blog Post, category and tag belong to one controlled model.
  Managed Media is media owned and verified for publication, not an
  unverified hotlink. Agents use dedicated Machine Identity and capabilities;
  public routes cannot invoke staff/agent-only publishing actions.

## 6. Data, permissions and media

- **Data authority depends on target:** legacy application used Prisma and
  AWS PostgreSQL; V1 Cloudflare-oriented work uses Supabase PostgreSQL,
  explicit RPC/Edge/service boundaries and RLS. Migration scripts/snapshots
  do not automatically prove a Production cutover. Never mix Preview data
  with live Production or assume two datastores can be written independently.
- Data-changing migrations need an exact source/target, schema/version
  provenance, reversible or recoverable copy, isolation from real customer
  traffic and narrowly scoped approval. An unrelated UI tweak never triggers
  this procedure.
- Separate staff authentication, roles and capabilities from browser-visible
  Public. Keep restricted server-side credentials/authorization, least
  privilege and database RLS. Preserve session/CSP and input validation.
  Never print or check in tokens, service-role keys, API passwords, customer
  details, raw database rows or credential-bearing URLs.
- Bunny-compatible media: media file bytes, CDN URL, database metadata and
  product image references are **different things**. Verify actual object
  availability before changing a domain or rewriting large sets of URLs.
  Preserve known canonical product image identities and existing CSP/Next
  image allowlists unless media changes are explicitly in scope.
- Legacy backup/media inventories and dated zone counts are **historical
  evidence**, not current live access guarantees. Use targeted recovery
  instructions only during a specifically authorized media/data incident.

When work actually touches sensitive boundaries, read just the matching
operational detail, for example [media recovery](deploy/leo-565-media-recovery-baseline.md),
[Supabase security](deploy/supabase-runtime-security-boundary.md),
[isolated staging](deploy/isolated-staging-foundation.md) or
[backup/recovery](deploy/runtime-backup-recovery.md). Do not make them startup
prerequisites for content, layout or ordinary product changes.

## 7. Efficient Codex delivery policy

**Default:** a clear task starts immediately. One focused branch, one PR,
only tests related to the modified scope; full CI is retained when required.
No automatic multi-agent review, formal spec, separate ADR or backup project
for routine changes.

| Risk | Examples | What is enough |
| --- | --- | --- |
| Low | Copy, footer, styling, accessible labels, non-sensitive SEO | Diff + rendered/browser check if visual; relevant tests and required CI; application rollback. |
| Medium | Cart interactions, search/API logic, business behavior | Focused unit/integration tests, affected Preview flow where useful, app rollback and smoke checks. |
| High | Schema/data, payment/order writes, staff permissions, credentials, CDN/DNS or destructive actions | Validate exact target and affected state, scoped recoverable copy/rehearsal, independent risk check when justified, explicit Owner authorization. |

**Pipeline:** `Request → Implement → Focused validate → PR/CI → Owner GO →
Production → Smoke`. Before a source write, check main/related PRs and
task-owned diff. Preview only when it provides useful validation and is
actually reachable. No workflow/PR screenshot proves Production success;
inspect actual deployed version, customer URLs/flows and error metrics.
If automated release supports a single exact-candidate Owner approval, use
it; otherwise respect the existing separate GitHub/runtime gates. Never
self-authorize Production.

A deployable candidate must identify source commit, PR, required CI and
immutable artifact when supported. A rollback uses a known-good application
version; data migrations require their own data-safe plan. If a task is
blocked twice by one method, diagnose and change approach rather than
retrying it indefinitely. Do not convert unrelated technical debt into a
current release blocker.

### Local commands

```sh
npm ci                    # when dependencies required
npm run lint              # relevant application check
npm run typecheck         # type-safe source changes
npm test                  # focused/required repository tests
npm run build:public      # Public build only when needed
npm run build:admin       # Admin build only when needed
```

The root CI quality workflow may run broader checks for changed code;
documentation-only diffs need structural/link checks rather than unrelated
application builds. A merge into `main` does **not** equal a Production
deployment. Record checks as PASS/FAIL/UNKNOWN, never invent a successful gate.

## 8. Operational files retained because automation still depends on them

These are not startup context. Open only one when its workflow or risky
operation directly applies:

- **Isolated PostgreSQL Staging deployment foundation:** [isolated staging](deploy/isolated-staging-foundation.md); the
  [CI-only disposable database fixtures](deploy/staging-db-bootstrap/RUNBOOK.md)
  are **not** a Staging or Production runtime procedure.
- **Migration implementation and budget:** [canonical baseline](deploy/migration-implementation-baseline.md),
  [free-tier policy](deploy/migration-free-tier-policy.md) — migration only.
- **Supabase runtime security:** [security boundary](deploy/supabase-runtime-security-boundary.md);
  authorizations and provider facts must be verified before a database write.
- **Publishing and data recovery:** [publishing runbook](deploy/publishing-api-v1-runbook.md),
  [runtime backup](deploy/runtime-backup-recovery.md),
  [recovery baseline](deploy/leo-565-media-recovery-baseline.md).
- **Source delivery:** use **one standard workflow and risk-proportionate**
  validation/recovery controls from section 7, not separate release tracks.

Some tests validate these files literally by path and key contract wording.
Do not rename/delete an operational reference unless its executable
consumer and rollback procedure are updated together.

## 9. Documentation policy and maintenance

**Only two canonical guide files for humans and Codex:**

1. `AGENTS.md` — all session-critical context, current priorities, module
   map, short workflow and business invariants. Keep under a reasonable
   startup token budget. Codex loads this automatically.
2. `docs/PROJECT.md` — consolidated handbook and reference links for
   deeper technical work. Do not read it routinely.

Other Markdown files are retained **only** where actively referenced by
executable tests, migration scripts, legal/external integration users, or a
specific high-risk operational runbook. Historical superseded ADRs, roadmap
experiments, completed handoff memos and duplicate documentation should be
removed from the working tree once their relevant rules are summarized
here. Git preserves full prior contents in history.

Code and executable schema remain the technical source of truth;
real GitHub Issues/PRs are task state; GitHub Actions/Provider dashboards are
deployment state. Any dated statement in these Markdown files must be
revalidated before it is used to approve a risky action.

**Update protocol:** for a new feature or decision, modify implementation
and update a short relevant section of `AGENTS.md` only if default session
behavior changes; otherwise update just this handbook. Avoid per-issue
documentation. Never duplicate the same policy across multiple Markdown
files. For completed old work, retain PR/commit links rather than copying
whole historical conversations into context.
