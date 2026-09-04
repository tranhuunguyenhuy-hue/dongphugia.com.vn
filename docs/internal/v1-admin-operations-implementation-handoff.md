# V1 Admin Operations — Implementation Handoff

**Status:** Owner-review candidate; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Figma page:** `02 — ADMIN — Operational Wireframes` (`31:11`)  
**Admin review index:** `182:2`  
**Linear:** LEO-572, LEO-581, LEO-571, LEO-573

> [!IMPORTANT]
> Do **not** implement this document yet. Coding may start only after 100% of launch-critical Public + Admin wireframes are Owner-approved and the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.
>
> The Admin page is currently prepared for Owner review. It is not approved/frozen yet.

## 1. Purpose

This is the durable implementation handoff for `admin.dongphugia.vn`.

V1 Admin is a **desktop-first operational control plane** for the exact Public V1 catalogue, commerce, Quote, Content/Campaign and Contact Request domains. Admin must operate the same canonical data and lifecycle semantics seen on Public; it must not become a parallel data model or inherit legacy Admin behavior as authority.

The established Admin visual/interaction language is intentionally operational:

- persistent left navigation;
- top context/search bar;
- dense resource list/table + contextual inspector where useful;
- focused create/edit/detail screens;
- explicit state chips and task actions;
- restrained neutral UI with orange operational accent;
- desktop-first V1. **No separate mobile Admin wireframe system is required for this phase.**

## 2. Authority and conflict rules

For Admin implementation, use this authority order:

1. Owner's newest explicit decisions.
2. Current frames on Figma page `02 — ADMIN — Operational Wireframes` (`31:11`).
3. This handoff.
4. The domain handoff that owns the underlying Public/business truth:
   - PDP/Family System;
   - Retail Order;
   - Quote;
   - Content/Contact.
5. Relevant ADRs, especially ADR 0017, 0020 and 0021.
6. Existing canonical V1 schema/services where not superseded.
7. Legacy Production/Admin only as migration/reference evidence.

If an older Admin screen, schema note or service behavior conflicts with a newer approved domain contract, do not silently preserve the older behavior.

## 3. Current Figma authority — 32 operational states

Structural QA on 2026-09-05: **32/32 current Axx frames have no missing fonts, root-boundary overflow or frame-to-frame overlap.** This is layout QA only; Owner approval is still required.

### 3.1 Auth & Access — `01 — AUTH & ACCESS` (`182:7`)

- `31:653` — A01 Admin Login.
- `31:667` — A02 Invite Acceptance / Set Password.
- `31:679` — A03 Forgot Password.
- `31:687` — A04 Reset Password.
- `31:697` — A05 Unauthorized.
- `31:705` — A06 Disabled Staff / Access Denied.

### 3.2 Dashboard — `02 — DASHBOARD` (`182:13`)

- `31:713` — A07 Admin Dashboard.

### 3.3 Catalogue Operations — `03 — CATALOGUE OPERATIONS` (`182:16`)

- `31:729` — A08 Product List.
- `31:741` — A09 Product Create / Edit / Detail.
- `930:11` — A09B Product Sellable Options / Colours.
- `31:761` — A10 Family Management.
- `31:771` — A11 Category Management.
- `31:781` — A12 Brand Management.
- `31:789` — A13 Specs / Filter Metadata.
- `31:799` — A14 Media / Documents.

### 3.4 Orders — `04 — ORDERS` (`182:20`)

- `31:811` — A15 Order List.
- `31:821` — A16 Order Detail / `NEW` commercial-confirmation state.
- `931:26` — A16B Order Detail / `CONFIRMED` Bank Transfer state.

### 3.5 Quote / Sales — `05 — QUOTE / SALES` (`182:24`)

- `31:835` — A17 Quote Request List.
- `31:843` — A18 Quote Request Detail / READ ONLY.
- `31:853` — A19 Negotiated Quote Create / Edit.
- `31:869` — A20 Share Quote State.
- `31:879` — A21 Quote → Order Confirmation.

### 3.6 Marketing / Content + Campaign — `06 — MARKETING / CONTENT + CAMPAIGN` (`182:31`)

- `31:889` — A22 Content List.
- `31:899` — A23 Content Editor.
- `933:2` — A24 Campaign List.
- `933:139` — A25 Campaign Editor.

The previous Collection frames are removed from current V1 Admin authority. Collection remains OUT OF V1.

### 3.7 Staff & Roles — `07 — STAFF & ROLES` (`182:36`)

- `31:937` — A26 Staff List.
- `31:947` — A27 Invite Staff.
- `31:959` — A28 Staff Detail.

### 3.8 Customer Care — `08 — CUSTOMER CARE / CONSULTATION` (`264:302`)

- `934:2` — A29 Consultation Requests.

### 3.9 Managed Configuration — `09 — MANAGED CONFIGURATION` (`934:132`)

- `934:135` — A30 Managed Commerce Configuration.

## 4. Application boundary

Admin host: `admin.dongphugia.vn`.

Public and Admin remain separate application surfaces even where they share canonical services/data.

Admin does not create a second copy of Product, pricing, Order, Quote, Content or Contact Request truth. Admin reads/writes the same canonical domains through protected service boundaries.

## 5. Authentication and fixed roles

No staff self-signup.

Use the existing canonical Supabase Auth/RLS/service-boundary architecture.

V1 fixed roles, assignable in combination:

- `Product`;
- `Sales`;
- `Marketing`;
- `Admin`.

No custom role builder in V1.

Role intent:

- **Product:** catalogue/Product/Family/spec/media/readiness operations.
- **Sales:** Retail Orders, commercial confirmation/payment operations, Quote Requests, negotiated Quotes, Quote→Order.
- **Marketing:** Guide/Inspiration/Buying Guide/Landing content and Campaign merchandising.
- **Admin:** staff/fixed-role assignment, managed commerce configuration and broad access according to canonical RLS/service rules.

UI hiding is not authorization. Server-side permission/RLS enforcement remains mandatory.

## 6. Dashboard contract

A07 is intentionally lightweight operational triage, not BI.

Launch-critical summaries include:

- new Retail Orders / Orders needing staff action;
- pending Quote Requests;
- Products needing catalogue/publish-quality attention;
- new Contact Requests needing CSKH follow-up;
- quick links into the corresponding operational modules.

Do not expand into analytics/CRM dashboards.

## 7. Product / Catalogue operations

Catalogue Admin must respect the approved PDP/Family handoff.

### 7.1 Canonical Product editor

A09 manages manufacturer Product truth including:

- Product/model identity;
- Brand;
- primary Category;
- `price` = regular public selling price;
- `sale_price` = optional current promotional selling price;
- `voucher_online_discount_amount` = optional fixed online-order discount;
- indicative availability;
- specs/attributes;
- media;
- technical documents;
- publication/readiness state.

Effective current Product price remains `sale_price ?? price`; the online discount is a Product-level V1 incentive, not a generic coupon engine.

### 7.2 Sellable colour / finish options

A09B is the explicit Admin state for the approved rule:

> Colour/finish stays on the same Product and same canonical PDP.

Each sellable option can own/override the exact sellable SKU and relevant commerce/media state, including:

- deterministic colour/finish identity;
- exact sellable SKU;
- price/sale price/online discount where supported by the canonical option model;
- availability;
- mapped gallery/media;
- public/selectable state.

Changing colour must never create another manufacturer Product/PDP/SEO page.

Public dependency:

`PDP colour selection → exact sellable option → Retail Cart / Quote snapshot preserves exact SKU + colour`.

### 7.3 Family System

A10 implements the same hierarchy as Public PDP:

**Family → optional Configuration Group → Configuration → optional Colour**

A Configuration target is exactly one of:

- `manufacturer_product`;
- `retailer_package`.

Family itself has no independent price, availability or standalone Public page.

For `retailer_package`:

- composition references canonical Product/component IDs;
- UI can expose the package as one Family Configuration;
- package does not become a manufacturer Product or independent SEO identity;
- package pricing is server-derived from canonical component commerce data unless a future explicit pricing rule is approved.

Do not reintroduce legacy `variant_group` semantics or simple Product-membership-only Family management.

### 7.4 Category, Brand, Specs, Media

A11–A14 remain operational editors for canonical taxonomy, Brand metadata, typed specs/filter metadata and managed media/documents.

Admin must not copy Product business truth into Content or Campaign records.

## 8. Product publication/readiness

A08/A09 surface actionable readiness rather than silently publishing incomplete catalogue data.

Authorized roles may publish directly; V1 does not introduce a heavyweight approval workflow.

Implementation should reuse current canonical publish-quality rules and extend them only where the approved Product/Family/sellable-option contracts require additional checks.

## 9. Retail Orders operations

Admin must use exactly the Retail Order lifecycle:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` is an allowed terminal branch according to canonical service rules.

Do not restore old Admin lifecycle labels such as `Preparing` or `Shipped` as current V1 authority.

### 9.1 Order list

A15 supports operational filtering by current lifecycle/payment status and distinguishes temporary/pending commercial amount from a confirmed final total.

### 9.2 Order detail before confirmation

A16 shows the `NEW` state with:

- immutable ordered line snapshots;
- exact selected Product / colour-SKU / retailer package identity;
- customer/delivery snapshot;
- payment method/status;
- optional installation-support intent;
- shipping fee pending state;
- installation fee pending/not-applicable state;
- final total `not yet confirmed`;
- action to record customer contact / progress toward commercial confirmation.

**Pending fee is not confirmed `0đ`.**

### 9.3 Commercial confirmation

Staff confirms stock/fees/final total before the Order becomes `CONFIRMED`.

The final commercial total must be deterministic and persisted as historical Order truth.

### 9.4 Bank Transfer after confirmation

A16B proves the post-confirmation contract:

- Order = `CONFIRMED`;
- final total is fixed;
- payment may still be `UNPAID`;
- managed Bank Transfer instructions become customer-actionable only now;
- payment status changes only when receipt is actually recorded.

Admin confirmation itself must **not** mark Bank Transfer paid.

## 10. Quote / Sales operations

The Admin flow is intentionally separated:

**immutable Quote Request → negotiated Quote → tokenized read-only share → optional idempotent Quote→Order**.

### 10.1 Quote Request

A17/A18 show the customer-submitted request as immutable evidence.

Preserve:

- customer/project context;
- requested quantities/notes;
- exact selected Product + colour/sellable SKU or retailer package snapshot.

Sales must not rewrite the original customer request when negotiating commercial terms.

### 10.2 Negotiated Quote

A19 owns Quote-specific commercial terms:

- line negotiated pricing/adjustments;
- Quote notes/terms;
- revisions/version semantics where required by canonical services;
- validity;
- issue/publish state.

Editing Quote pricing must not mutate Product price/sale/online-discount truth.

### 10.3 Public share

A20 uses a public-safe tokenized route:

`/bao-gia/{publicToken}`

Do not expose the internal Quote code as route authority.

The shared customer view is read-only.

### 10.4 Quote → Order

A21 conversion is explicit and idempotent:

- revalidate conversion eligibility;
- create exactly one resulting Order from negotiated commercial snapshots;
- preserve exact Product/colour/package identity and negotiated terms;
- link Quote ↔ resulting Order;
- leave the original Quote Request unchanged;
- retry after a lost response returns the same Order rather than duplicating it.

## 11. Contact Request / Customer Care

A29 operates the dedicated Contact Request domain created by approved Public consultation entry points.

Public intake persists:

- required name;
- required phone;
- optional message/consultation need;
- source page / entry point;
- created timestamp.

Admin lifecycle is intentionally small:

`NEW → CONTACTED → CLOSED`

Admin actions:

- inspect contact/message/source/time;
- mark CONTACTED;
- close request.

Contact Request is **not Quote Request** and this module is not a CRM, lead-scoring, assignment, notification or marketing-automation system.

## 12. Marketing Content

A22/A23 manage the approved Content types:

- Guide;
- Inspiration;
- Buying Guide;
- Landing Page.

Use validated ordered flexible blocks and canonical Product/Category/Brand references. Marketing may control editorial presentation, but referenced canonical catalogue/commerce facts remain owned by their source domains.

No Blog-only CMS authority.

## 13. Campaign merchandising

A24/A25 replace the obsolete Collection Admin concept.

Campaign manages only:

- internal Campaign identity;
- banner/media;
- manually selected ordered canonical Products;
- Homepage placement;
- `Draft / Published / Archived` state;
- Homepage preview/publish/archive actions.

Campaign has no standalone Public route in current V1.

Campaign is explicitly:

- **not Collection**;
- **not a coupon/promotion/pricing-rules engine**;
- not allowed to override canonical Product pricing.

Homepage Product cards continue reading price/sale/online-discount semantics from canonical Product commerce data.

## 14. Users & fixed roles

A26–A28 support:

- staff list;
- invite/create through supported Auth tooling;
- multi-role assignment using the fixed V1 roles;
- disable/access state as allowed by current Auth/service boundaries.

Do not expose public signup, custom roles, arbitrary permission-matrix building or organization management.

## 15. Managed Commerce Configuration

A30 is deliberately narrow.

Current launch-critical use: Bank Transfer customer instructions required by the approved Retail Order flow.

Managed fields may include the configured:

- bank name;
- account holder;
- account number;
- optional branch/note;
- transfer-content template;
- customer-facing instruction copy.

Exposure rule:

- `NEW / CONTACTED`: Public must not expose these instructions or request transfer;
- `CONFIRMED`: final total + managed instructions may become actionable;
- payment remains `UNPAID` until receipt is recorded.

Do not expand A30 into a generic settings/CMS engine without a new approved requirement.

## 16. Desktop-first Admin boundary

The canonical Admin wireframe set is desktop-first because this is a high-density staff operational workspace.

Do not invent a separate mobile Admin product or duplicate every Axx state into mobile-only screens during V1 implementation.

Normal responsive hardening for practical smaller desktop/tablet widths may be implemented using the same domain semantics and permissions, but it is not a second information architecture or feature set.

## 17. Explicit Admin exclusions

V1 Admin does not include:

- Wishlist;
- Collection;
- custom roles;
- CRM;
- procurement/supplier management;
- warehouse/fulfilment engine;
- appointment booking;
- notification center;
- generic automation builder;
- advanced DAM;
- advanced BI;
- coupon/promotion/pricing-rules engine;
- separate mobile Admin IA.

## 18. Acceptance criteria after global freeze

Implementation must prove at minimum:

1. Admin host requires authentication.
2. Fixed-role permissions are enforced server-side/RLS, not only hidden in UI.
3. Product editor writes canonical `price / sale_price / voucher_online_discount_amount` semantics.
4. Sellable colour options remain on one Product/PDP and preserve exact SKU/media/commerce state.
5. Family Admin supports optional groups + `manufacturer_product` / `retailer_package` Configuration targets.
6. No Collection/Wishlist Admin capability is exposed.
7. Orders use `NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED` and pending-vs-confirmed fee semantics.
8. Bank instructions are unavailable before CONFIRMED and come from managed configuration afterward.
9. Order line history preserves immutable Product/colour/package snapshots.
10. Quote Request remains immutable; negotiated Quote pricing is Quote-specific.
11. Shareable Quote is tokenized/read-only; Quote→Order is snapshot-preserving and idempotent.
12. Contact Request uses `NEW / CONTACTED / CLOSED` and remains distinct from Quote Request.
13. Content editor supports Guide/Inspiration/Buying Guide/Landing flexible blocks + canonical references.
14. Campaign is Homepage merchandising only and cannot override Product prices.
15. Staff can receive one or more fixed roles; no custom-role builder exists.
16. Bank Transfer configuration is managed rather than hard-coded.
17. Final implementation matches the established page-02 Admin operational shell/style rather than the discarded temporary Admin wireframes.

## 19. Codex implementation sequence after global freeze

1. Read the master wireframe/implementation index.
2. Read this Admin handoff plus the PDP, Retail Order, Quote and Content/Contact handoffs.
3. Audit only relevant current Admin/Auth/service code read-only.
4. Map current routes/components/services to the A01–A30 authority above.
5. Report exact reusable code, stale assumptions, schema/service deltas and tests needed.
6. Do not start coding from the gap report alone where material schema/architecture decisions remain unresolved.
7. After Coordinator/Owner approval, implement shared Admin shell/Auth/permission guards.
8. Implement Catalogue/Product/Family/sellable options.
9. Implement Retail Order operations and commercial confirmation.
10. Implement Quote Request/Quote/share/Quote→Order.
11. Implement Contact Request queue.
12. Implement Content/Campaign.
13. Implement Users/Roles + narrow Managed Commerce Configuration.
14. Add permission, lifecycle, idempotency and cross-Public/Admin acceptance tests.
15. Do not broaden scope.
