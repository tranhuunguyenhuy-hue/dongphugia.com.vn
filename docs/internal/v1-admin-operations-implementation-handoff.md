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
- dense resource lists where useful;
- focused create/edit/detail screens;
- explicit state chips and task actions;
- restrained neutral UI with orange operational accent;
- desktop-first V1; no separate mobile Admin IA in this phase.

All **staff-facing UI copy is Vietnamese**. Internal field names/enums remain implementation details and must not leak back into the UI.

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

## 3. Current Figma authority — 31 operational states

Structural QA on 2026-09-05: **31 current Axx frames are root-boundary clean and have no missing fonts.** Catalogue states listed below were additionally cross-checked against the approved Public PDP Family Selector.

### 3.1 Auth & Access — `01 — AUTH & ACCESS` (`182:7`)

- `31:653` — A01 Admin Login.
- `31:667` — A02 Invite Acceptance / Set Password.
- `31:679` — A03 Forgot Password.
- `31:687` — A04 Reset Password.
- `31:697` — A05 Unauthorized.
- `31:705` — A06 Disabled Staff / Access Denied.

### 3.2 Dashboard — `02 — DASHBOARD` (`182:13`)

- `31:713` — A07 Admin Dashboard.

### 3.3 Product operations — `03 — CATALOGUE OPERATIONS` (`182:16`)

Current V1 authority is intentionally reduced to Product-centered operations:

- `31:729` — A08 Product List.
- `31:741` — A09 Product Create / Edit / Detail — Product already linked to Family.
- `930:11` — A09B Product Sellable Options / Colours — Product sub-flow.
- `1015:2` — A09C Product / no Family — explicit create-or-join entry state.
- `31:761` — A10 Family Management / PDP Selector editor.
- `1012:85` — A10B guided Family creation from a Product.
- `31:799` — A14 Media / Documents — Product sub-flow.

Removed from V1 Admin authority:

- A11 Category Management.
- A12 Brand Management.
- A13 Specs / Filter Metadata Management.

Category, Brand and filter/spec metadata may still exist as canonical catalogue data used by Public pages and Product records, but **V1 Admin does not provide CRUD/management modules for them**.

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

Collection remains OUT OF V1.

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

Public and Admin remain separate application surfaces even where they share canonical services/data. Admin does not create a second copy of Product, pricing, Order, Quote, Content or Contact Request truth.

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

- **Product:** Product, sellable colour/SKU, Family/PDP-selector, media/documents and publish-readiness operations.
- **Sales:** Retail Orders, commercial confirmation/payment operations, Quote Requests, negotiated Quotes, Quote→Order.
- **Marketing:** Guide/Inspiration/Buying Guide/Landing content and Campaign merchandising.
- **Admin:** staff/fixed-role assignment, managed commerce configuration and broad access according to canonical RLS/service rules.

Product role does **not** imply V1 Category/Brand/Spec-Filter administration.

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

## 7. Product operations — final Owner-review flow

Admin Product management is designed from the approved Public PDP backwards. The staff mental model should be:

**Product → colour/SKU → optional Family → PDP selector choices → media/documents → preview → publish**.

Do not expose the underlying normalized schema as the primary UX.

### 7.1 A08 Product List

A08 prioritizes information required to understand the resulting PDP:

- Product/model;
- Family + current PDP selector choice;
- colour/SKU state;
- current price;
- publication/readiness state.

Useful operational filters include `Chưa có nhóm`, `Cần xử lý` and publication state.

From the list, staff can go directly to:

- Product detail;
- the Family/PDP selector currently controlling that Product.

Category/Brand columns are no longer the primary management surface.

### 7.2 A09 Product editor — Product with Family

A09 manages manufacturer Product truth including:

- Product/model identity;
- canonical Brand and primary Category references shown as source data, not Admin-managed domains;
- `price` = regular public selling price;
- `sale_price` = optional current promotional selling price;
- `voucher_online_discount_amount` = optional fixed online-order discount;
- indicative availability;
- media/documents;
- publication/readiness state.

The editor provides Product-centered sub-flows:

- Tổng quan;
- Màu & SKU;
- Nhóm sản phẩm;
- Hình ảnh & tài liệu;
- Xuất bản.

The overview includes a **Cấu trúc hiển thị trên PDP** card showing:

- current Family;
- current selector choice targeting the Product;
- available colours/SKUs;
- direct actions into Family and colour management.

Effective current Product price remains `sale_price ?? price`; the online discount is a Product-level V1 incentive, not a generic coupon engine.

### 7.3 A09C — Product without Family

A09C proves that Family is optional.

A Product can exist and have its canonical PDP without belonging to a Family.

When Family is useful, staff gets exactly two choices:

1. **Tạo nhóm từ Sản phẩm này** → A10B.
2. **Thêm vào nhóm có sẵn** → existing Family assignment.

Do not make Family membership a mandatory Product-readiness condition.

### 7.4 A09B — Sellable colour / finish options

A09B is a Product sub-flow, not a parallel catalogue domain.

Colour/finish stays on the same Product and same canonical PDP.

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

### 7.5 A10 — Family / PDP Selector editor

A10 is deliberately **WYSIWYG-first** and mirrors the approved Public PDP selector.

The primary section is the ordered rail of selector cards. Each Admin card corresponds to exactly one Public selector choice.

Staff can:

- see selector cards in Public order;
- reorder them;
- select a card and edit its display details;
- add another Product or retailer package choice;
- preview the resulting PDP.

The selected-card editor exposes the business concepts, not raw schema names:

- display label;
- choice type: manufacturer Product or retailer package;
- target Product/package;
- selector thumbnail;
- optional colour mapping;
- optional selector group;
- public state;
- selectable state.

Family membership is shown separately below the selector editor and must never be conflated with selector-card creation.

Optional Configuration Groups are progressive disclosure: TBG10302 does not use groups; a staff user only enables grouping when a large Family genuinely needs meaningful tabs on Public PDP.

Canonical hierarchy remains:

**Family → optional Configuration Group → Configuration → optional Colour**.

Configuration target is one of:

- `manufacturer_product`;
- `retailer_package`.

Family itself has no independent price, availability or standalone Public page.

### 7.6 A10B — guided Family creation from Product

A10B is the optimized creation path when staff starts from an ungrouped Product.

One compact form guides three explicit operations:

1. create Family identity;
2. add the current Product as the first Family member;
3. create the first PDP selector Configuration targeting the current Product.

The UX may submit these in one action, but implementation must preserve them as separate domain relationships. Membership alone must never auto-create the selector Configuration.

The first selector card is previewed before completion. After creation, staff lands in A10 to add/reorder other manufacturer Products or retailer packages.

### 7.7 Retailer package rules

For `retailer_package`:

- composition references canonical Product/component IDs;
- UI exposes the package as one Family selector choice;
- package does not become a manufacturer Product or independent SEO identity;
- package pricing is server-derived from canonical component commerce data unless a future explicit pricing rule is approved;
- package colour mapping, when shown, is explicit for that package/Configuration and never inferred from component Product colours.

Do not reintroduce legacy `variant_group` semantics or Product-membership-only Family management.

### 7.8 Media / Documents

A14 remains a Product sub-flow for managed image/gallery/technical-document operations and processing states.

Do not create separate V1 Admin domains for:

- Category management;
- Brand management;
- Spec/filter-schema management.

Product records may display canonical Brand/Category values and Public/Content may reference them, but their management lifecycle is outside V1 Admin scope.

## 8. Product publication/readiness

A08/A09/A09C surface actionable readiness rather than silently publishing incomplete catalogue data.

Family is optional; when a Family exists, its selector mapping must be valid before related selector choices become Public/selectable.

Authorized roles may publish directly; V1 does not introduce a heavyweight approval workflow.

## 9. Retail Orders operations

Admin uses exactly:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` is an allowed terminal branch.

A15/A16/A16B must preserve immutable ordered-line snapshots, pending fee semantics, staff-confirmed final total and Bank Transfer instructions only after `CONFIRMED`. Confirmation alone does not mark payment paid.

## 10. Quote / Sales operations

Admin flow:

**immutable Quote Request → negotiated Quote → tokenized read-only share → optional idempotent Quote→Order**.

The original customer request remains immutable. Negotiated Quote commercial terms are Quote-specific and never mutate Product pricing truth. Public share route uses `/bao-gia/{publicToken}`. Quote→Order preserves exact Product/colour/package snapshots and must be idempotent.

## 11. Contact Request / Customer Care

A29 operates the dedicated Contact Request domain.

Lifecycle:

`NEW → CONTACTED → CLOSED`

It remains distinct from Quote Request and is not a CRM/assignment/automation platform.

## 12. Marketing Content

A22/A23 manage:

- Guide;
- Inspiration;
- Buying Guide;
- Landing Page.

Use validated flexible blocks and canonical Product/Category/Brand references. Category/Brand may be referenced by content without adding Category/Brand CRUD back into Admin V1.

## 13. Campaign merchandising

A24/A25 manage Homepage merchandising only:

- Campaign identity;
- banner/media;
- manually ordered canonical Products;
- Homepage placement;
- Draft / Published / Archived state.

Campaign is not Collection and is not a pricing/promotion-rules engine.

## 14. Users & fixed roles

A26–A28 support staff list, invite, fixed multi-role assignment and disable/access state. No public signup, custom-role builder or arbitrary permission matrix.

## 15. Managed Commerce Configuration

A30 remains deliberately narrow. Current launch-critical use is managed Bank Transfer customer instructions. Public cannot expose them before Order `CONFIRMED`; payment remains unpaid until actual receipt is recorded.

## 16. Desktop-first Admin boundary

Do not invent a separate mobile Admin product or duplicate every Axx state into mobile-only screens during V1.

## 17. Explicit Admin exclusions

V1 Admin does not include:

- Wishlist;
- Collection;
- Category management/CRUD;
- Brand management/CRUD;
- Spec/filter metadata management UI;
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
4. Product without Family can remain valid and publishable when all required non-Family readiness checks pass.
5. A09C supports explicit create-new-Family vs join-existing-Family actions.
6. A10B creates Family membership and first selector Configuration as separate domain relationships even if submitted through one guided form.
7. A10 selector-card order/label/thumbnail/public/selectable state maps deterministically to approved Public PDP selector cards.
8. Sellable colour options remain on one Product/PDP and preserve exact SKU/media/commerce state.
9. Family Admin supports optional groups + `manufacturer_product` / `retailer_package` targets.
10. Retailer-package component Products do not become Family members automatically; package colours are explicit.
11. No Category/Brand/Spec-Filter management routes or UI are exposed in V1 Admin.
12. No Collection/Wishlist Admin capability is exposed.
13. Orders use the approved Retail Order lifecycle and pending-vs-confirmed fee semantics.
14. Bank instructions are unavailable before `CONFIRMED` and come from managed configuration afterward.
15. Quote Request remains immutable; Quote share is tokenized/read-only; Quote→Order is snapshot-preserving and idempotent.
16. Contact Request remains distinct from Quote Request.
17. Content/Campaign stay within approved scope.
18. Staff receives only fixed V1 roles.
19. Staff-facing Admin copy follows the Vietnamese Figma authority and does not expose raw schema/internal enum names.
20. Final implementation matches page-02 Admin shell/style and not discarded temporary/legacy Admin UI.

## 19. Codex implementation sequence after global freeze

1. Read the master wireframe/implementation index.
2. Read this Admin handoff plus PDP, Family-linkage, Retail Order, Quote and Content/Contact handoffs.
3. Audit only relevant current Admin/Auth/service code read-only.
4. Map current routes/components/services to the current 31-state authority above.
5. Explicitly identify and exclude any legacy Category/Brand/Spec-Filter Admin implementation from V1 routing/navigation.
6. Report reusable code, stale assumptions, schema/service deltas and tests needed.
7. Do not code from the gap report alone where material schema decisions remain unresolved.
8. After Coordinator/Owner approval, implement shared Admin shell/Auth/permission guards.
9. Implement Product → colour/SKU → Family/PDP-selector → media/docs → publish flow.
10. Implement Retail Order operations and commercial confirmation.
11. Implement Quote Request/Quote/share/Quote→Order.
12. Implement Contact Request queue.
13. Implement Content/Campaign.
14. Implement Users/Roles + narrow Managed Commerce Configuration.
15. Add permission, lifecycle, idempotency and cross-Public/Admin acceptance tests.
16. Do not broaden scope.