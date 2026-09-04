# Dong Phu Gia V1 — Wireframe Freeze / Implementation Index

**Status:** Master design-to-implementation index prepared for final Owner review  
**Date:** 2026-09-05  
**Audience:** Owner, ChatGPT coordinator, Codex, maintainers  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)

> [!IMPORTANT]
> This document does **not** open implementation. No Codex/application/schema implementation may start until 100% of launch-critical Public + Admin wireframes are Owner-approved and the Owner says exactly **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Purpose

This file is the top-level index Codex must read after global wireframe freeze. It maps every launch-critical V1 experience to its Figma authority and durable implementation handoff so Codex does not derive product behavior from legacy Production UI or stale code.

## 2. Canonical launch-critical Public page inventory

Public route/page types:

- Homepage `/`.
- Search `/tim-kiem`.
- Category/Subcategory `/danh-muc/{...slug}`.
- Brand Index `/thuong-hieu`.
- Brand Page `/thuong-hieu/{brandSlug}`.
- Product/PDP `/san-pham/{productSlug}`.
- Retail Cart `/gio-hang`.
- Guest Checkout `/thanh-toan`.
- Order Confirmation `/dat-hang/thanh-cong`.
- Quote Cart `/bao-gia`.
- Quote Request `/bao-gia/yeu-cau`.
- Shareable Quote `/bao-gia/{publicToken}`.
- Content Hub `/cam-nang`.
- Guide detail `/cam-nang/huong-dan/{slug}`.
- Inspiration detail `/cam-nang/cam-hung/{slug}`.
- Buying Guide detail `/cam-nang/tu-van-mua/{slug}`.
- flexible Landing Page route owned by Content record.
- Showroom / Contact `/showroom`.
- generic Support `/ho-tro/{slug}`.

Family remains an on-PDP navigation/data concept; it has no standalone Public Family page.

## 3. Canonical Admin modules

Admin host: `admin.dongphugia.vn`.

Launch-critical modules:

- Auth & access states.
- Dashboard.
- Product/Catalogue.
- sellable colour/SKU options.
- Categories / Brands / Family configurations / Specs / Media.
- Retail Orders + commercial confirmation/payment operations.
- Quote Requests / negotiated Quotes / share / Quote→Order.
- Contact Requests / CSKH.
- Marketing Content.
- Campaign merchandising.
- Users & fixed roles.
- narrow Managed Commerce Configuration.

Admin is **desktop-first operational UI**. The canonical phase does not require a separate mobile Admin IA/screen set.

## 4. Figma authority

### 4.1 Public page `01 — PUBLIC — Responsive Wireframes`

Current launch-critical sections:

- `01 — GLOBAL / ENTRY` — Global Navigation + Homepage.
- `02 — SEARCH` — Search states.
- `03 — CATALOGUE / DISCOVERY` — Category/Brand discovery.
- `04 — PDP DESKTOP — APPROVED FAMILY SYSTEM` — Desktop PDP.
- `05 — PDP MOBILE — APPROVED FAMILY SYSTEM` — Mobile PDP.
- `06 — RETAIL ORDER` (`181:29`) — Desktop/Mobile Retail Cart, Checkout, Order Confirmation.
- `07 — QUOTE` (`917:2`) — Desktop/Mobile Quote Cart, Quote Request and Shareable Quote.
- `08 — CONTENT / SHOWROOM / SUPPORT` (`920:2`) — Desktop/Mobile Content, Landing, Showroom/Contact and Support.

### 4.2 Admin page `02 — ADMIN — Operational Wireframes` (`31:11`)

The established Admin page is the visual/structural authority. The discarded temporary generic Admin section is **not** implementation authority.

Admin review index: `182:2`.

Current coverage: **32 Axx operational states**, grouped into:

- `182:7` Auth & Access — A01–A06.
- `182:13` Dashboard — A07.
- `182:16` Catalogue Operations — A08–A14 + A09B.
- `182:20` Orders — A15–A16B.
- `182:24` Quote / Sales — A17–A21.
- `182:31` Marketing / Content + Campaign — A22–A25.
- `182:36` Staff & Roles — A26–A28.
- `264:302` Customer Care — A29.
- `934:132` Managed Configuration — A30.

Admin structural QA on 2026-09-05: **32/32 current Axx frames have no missing fonts, root-boundary overflow or frame-to-frame overlap.** Owner approval is still pending.

Reference/obsolete screens never override current frames.

## 5. Current review status

Already Owner-approved/final within their slices:

- PDP Desktop + Mobile Family System.
- Retail Cart / Guest Checkout / Order Confirmation Desktop + Mobile.

Prepared for final Owner review in this wireframe-completion phase:

- Quote Desktop + Mobile.
- Content / Landing / Showroom / Support Desktop + Mobile.
- Admin A01–A30 operational page, including newly aligned Catalogue, Orders, Campaign, Customer Care and Managed Configuration states.

Slice completion does not open implementation before the global freeze phrase.

## 6. Durable implementation handoffs

Codex must read the relevant handoff before implementation.

### PDP / Family

`docs/internal/v1-pdp-family-system-implementation-handoff.md`

Core boundaries:

- one manufacturer model = one Product = one canonical PDP;
- Family → optional Configuration Group → Configuration → optional Colour;
- Configuration target = manufacturer Product or `retailer_package`;
- colour stays on same PDP and selects exact sellable option;
- no standalone Family page.

### Retail Order

`docs/internal/v1-retail-order-implementation-handoff.md`

Core boundaries:

- Retail Cart separate Quote Cart;
- Guest Checkout with Review-before-submit;
- COD + Bank Transfer only;
- Order intake = `RETAIL / NEW / UNPAID`;
- lifecycle `NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`;
- pending shipping/install fee must not be encoded as confirmed zero;
- staff confirms final commercial total;
- Bank Transfer instructions become actionable only after CONFIRMED;
- idempotent retry.

### Quote

`docs/internal/v1-quote-implementation-handoff.md`

Core boundaries:

- Quote Cart separate Retail Cart;
- Quote Request does not create an Order;
- customer request snapshot is immutable;
- Sales owns negotiated Quote line commercial terms;
- public Quote is tokenized/read-only;
- Quote→Order is authorized, snapshot-preserving and idempotent.

### Content / Contact / Showroom / Support

`docs/internal/v1-content-contact-implementation-handoff.md`

Core boundaries:

- Guide / Inspiration / Buying Guide / Landing;
- validated flexible blocks;
- canonical Product/Category/Brand references rather than copied business truth;
- Contact Request separate Quote Request;
- small CSKH lifecycle only;
- generic Support page;
- Campaign is a separate merchandising domain, not Collection/pricing rules.

### Admin Operations

`docs/internal/v1-admin-operations-implementation-handoff.md`

Core boundaries:

- page `02 — ADMIN — Operational Wireframes` is the Admin Figma authority;
- separate Admin app + fixed multi-role permissions;
- Product canonical pricing + sellable options + Family configurations;
- Retail Order staff commercial confirmation using the Public lifecycle;
- Quote Request / negotiated Quote / token share / idempotent Quote→Order;
- Contact Request queue;
- Content/Campaign publishing;
- Users/fixed roles;
- narrow Bank Transfer managed configuration;
- no CRM/custom role builder/Collection/Wishlist;
- no separate mobile Admin product in this V1 phase.

## 7. Existing architecture / ADR authority

At minimum retain and cross-check:

- ADR 0017 — PDP Family System and retailer packages.
- ADR 0020 — V1 Product pricing contract.
- ADR 0021 — Retail Order staff confirmation and pending fees.
- canonical V1 schema/architecture documents for existing baseline behavior.

If a pre-design schema document conflicts with a newer Owner-approved handoff, the newer Owner contract wins and implementation should use additive amendments rather than silently retaining stale semantics.

## 8. Explicit V1 exclusions

Do not implement or expose current UI for:

- Wishlist.
- Collection/manufacturer Collection normalization.
- mandatory customer account/login portal.
- customer Order dashboard/portal.
- Compare.
- generic Combo/BOM/configurator engine.
- coupon/promotion/pricing-rules engine.
- CRM.
- procurement/supplier platform.
- logistics/fulfilment platform.
- appointment booking.
- notification center.
- custom role builder.
- advanced BI/DAM.
- server-side/cross-device/AI personalization.
- separate mobile Admin IA.

## 9. Cross-domain invariants

1. Canonical Product data remains the commerce source of truth.
2. Colour/finish sellable options remain on one canonical Product/PDP.
3. Historical Orders/Quotes use immutable commercial snapshots.
4. `retailer_package` never masquerades as a manufacturer model.
5. Retail and Quote flows are separate.
6. Contact Request and Quote Request are separate intents/domains.
7. Campaign is Homepage merchandising, not Collection or pricing rules.
8. Public and Admin route/app boundaries remain separate but operate the same domain truth.
9. Server-side permissions/RLS are authoritative; UI hiding is insufficient.
10. Desktop/Mobile Public screens are responsive presentations of the same domain contracts.
11. Legacy Production is evidence/reference, not UX/data authority.

## 10. Required implementation workflow for Codex after freeze

For each slice:

1. Read this master index + relevant Figma frames + handoff + ADR.
2. Audit only existing code/data relevant to that slice.
3. Produce a concise gap report:
   - reusable current code;
   - stale/legacy assumptions;
   - schema delta;
   - service/API delta;
   - Public/Admin UI delta;
   - tests/migration needs.
4. Do **not** start implementation from the gap report alone when material architecture/schema decisions require approval.
5. Coordinator/Owner reviews the proposed delta.
6. Implement in dependency order: domain/schema/service → APIs/actions → UI → tests → migration/fixtures.
7. Prove acceptance criteria against final frozen Figma and handoffs.
8. Do not broaden scope.

## 11. Freeze completion checklist

Before the Owner can safely say `V1 WIREFRAME APPROVED / FROZEN`, verify:

- every launch-critical Public page/state has a reviewable current frame;
- every launch-critical Admin module/action has a current operational frame on page 02;
- obsolete Wishlist/Collection/legacy frames are clearly reference-only or removed from current flows;
- Quote, Retail, Contact and Campaign boundaries are consistent across Public/Admin Figma and docs;
- final Sitemap FigJam exists;
- final end-to-end User Flows FigJam exists;
- durable handoffs are synchronized with final node IDs;
- final structural QA has no missing fonts/overflow/root-boundary violations;
- Owner has reviewed and approved all newly completed Quote/Content/Admin wireframes.

Only after those checks and final Owner approval should the exact freeze phrase be issued.
