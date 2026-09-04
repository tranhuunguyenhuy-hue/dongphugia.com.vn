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

- Auth/Login.
- Dashboard.
- Product/Catalogue.
- Categories / Brands / Family.
- Orders.
- Quote Requests / negotiated Quotes / Quote→Order.
- Contact Requests / CSKH.
- Marketing Content.
- Campaign merchandising.
- Users & fixed roles.
- Managed operational configuration.

## 4. Figma section authority

- `01 — GLOBAL / ENTRY` — Global Navigation + Homepage.
- `02 — SEARCH` — Search states.
- `03 — CATALOGUE / DISCOVERY` — Category/Brand discovery.
- `04 — PDP DESKTOP — APPROVED FAMILY SYSTEM` — Desktop PDP.
- `05 — PDP MOBILE — APPROVED FAMILY SYSTEM` — Mobile PDP.
- `06 — RETAIL ORDER` — Desktop/Mobile Retail Cart, Checkout, Order Confirmation.
- `07 — QUOTE` (`917:2`) — Quote Cart, Request, Shareable Quote.
- `08 — CONTENT / SHOWROOM / SUPPORT` (`920:2`) — Content, Landing, Showroom, Support.
- `10 — ADMIN RESPONSIVE` (`921:2`) — launch-critical responsive Admin operations.

Reference/obsolete screens must not override approved/current frames.

## 5. Durable implementation handoffs

Codex must read the relevant handoff before implementation:

### PDP / Family

`docs/internal/v1-pdp-family-system-implementation-handoff.md`

Core boundaries:

- one manufacturer model = one Product = one canonical PDP;
- Family → optional Configuration Group → Configuration → optional Colour;
- Configuration target = manufacturer Product or `retailer_package`;
- colour stays on same PDP and selects sellable option;
- no standalone Family page.

### Retail Order

`docs/internal/v1-retail-order-implementation-handoff.md`

Core boundaries:

- Retail Cart separate Quote Cart;
- Guest Checkout with Review-before-submit;
- COD + bank transfer only;
- Order intake is `RETAIL / NEW / UNPAID`;
- pending shipping/install fee must not be encoded as confirmed zero;
- staff confirms final commercial total;
- bank transfer becomes actionable only after confirmation;
- idempotent retry.

### Quote

`docs/internal/v1-quote-implementation-handoff.md`

Core boundaries:

- Quote Cart separate Retail Cart;
- Quote Request does not create an Order;
- Sales owns negotiated Quote line commercial terms;
- public Quote is tokenized/read-only;
- Quote→Order is authorized, snapshot-preserving and idempotent.

### Content / Contact / Showroom / Support

`docs/internal/v1-content-contact-implementation-handoff.md`

Core boundaries:

- Guide / Inspiration / Buying Guide / Landing;
- validated flexible blocks;
- canonical Product/Category/Brand references rather than copied business truth;
- Campaign separate Collection/pricing engine;
- Contact Request separate Quote Request;
- small CSKH lifecycle only;
- generic static Support page.

### Admin Operations

`docs/internal/v1-admin-operations-implementation-handoff.md`

Core boundaries:

- separate Admin app;
- fixed multi-role permissions;
- Catalogue/Product/Family operations;
- Retail Orders commercial confirmation;
- Quote negotiation/Quote→Order;
- Contact Request queue;
- Content/Campaign publishing;
- Users/Roles/config;
- no CRM/custom-role builder/Collection/Wishlist.

## 6. Existing architecture/ADR authority

At minimum retain and cross-check:

- ADR 0017 — PDP Family System and retailer packages.
- ADR 0020 — V1 Product pricing contract.
- ADR 0021 — Retail Order staff confirmation and pending fees.
- canonical V1 schema/architecture documents for existing baseline behavior.

If a pre-design schema document conflicts with a newer Owner-approved handoff, the newer Owner contract wins and implementation should use additive amendments rather than silently retaining stale semantics.

## 7. Explicit V1 exclusions

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

## 8. Cross-domain invariants

1. Canonical Product data remains the commerce source of truth.
2. Historical Orders/Quotes use immutable commercial snapshots.
3. `retailer_package` never masquerades as a manufacturer model.
4. Retail and Quote flows are separate.
5. Contact Request and Quote Request are separate intents/domains.
6. Campaign is merchandising, not Collection or pricing rules.
7. Public and Admin route/app boundaries remain separate.
8. Server-side permissions/RLS are authoritative; UI hiding is insufficient.
9. Desktop/Mobile are responsive presentations of the same domain contracts.
10. Legacy Production is evidence/reference, not UX/data authority.

## 9. Required implementation workflow for Codex after freeze

For each slice:

1. Read Figma + handoff + relevant ADR.
2. Audit only the existing code/data relevant to that slice.
3. Produce a concise gap report:
   - reusable current code;
   - stale/legacy assumptions;
   - schema delta;
   - service/API delta;
   - Public/Admin UI delta;
   - tests/migration needs.
4. Do **not** start implementation from the gap report alone.
5. Coordinator/Owner reviews the proposed delta where architecture/schema changes are material.
6. Implement in dependency order: domain/schema/service → APIs/actions → UI → tests → migration/fixtures.
7. Prove acceptance criteria against final Figma and handoffs.
8. Do not broaden scope.

## 10. Freeze completion checklist

Before the Owner can safely say `V1 WIREFRAME APPROVED / FROZEN`, verify:

- every launch-critical Public page/state has a reviewable current frame;
- every launch-critical Admin module/action has responsive review coverage;
- obsolete Wishlist/Collection/legacy frames are clearly reference-only;
- Quote, Retail, Contact and Campaign boundaries are consistent across Figma and docs;
- final Sitemap FigJam exists;
- final end-to-end User Flows FigJam exists;
- durable handoffs are synchronized with final node IDs;
- final Figma structural QA has no missing fonts/overflow/root-boundary violations;
- Owner has reviewed and approved all newly completed Quote/Content/Admin wireframes.

Only after that final Owner approval should the exact freeze phrase be issued.
