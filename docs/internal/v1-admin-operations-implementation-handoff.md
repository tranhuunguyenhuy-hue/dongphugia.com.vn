# V1 Admin Operations — Implementation Handoff

**Status:** Owner-review candidate; Product/Dòng architecture synchronized; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Admin page:** `02 — ADMIN — Operational Wireframes` (`31:11`)  
**Architecture:** ADR 0022 + domain handoffs

> [!IMPORTANT]
> No schema/service/application implementation may begin until 100% launch-critical Public + Admin wireframes are Owner-approved and the Owner says exactly **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Purpose

This is the current durable handoff for `admin.dongphugia.vn`.

Admin is a desktop-first operational surface over the same canonical domains used by Public. It must not create a parallel catalogue, Order, Quote, Content or Contact model.

User-facing Admin copy is Vietnamese. Internal field names/enums may remain technical in schema/service docs but should not leak into staff UI.

## 2. Authority

Use this order:

1. newest Owner decisions;
2. current Figma page `02 — ADMIN — Operational Wireframes`;
3. this handoff;
4. current domain handoffs and ADR 0022/0020/0021;
5. canonical M0–M2 platform/security architecture where not superseded;
6. legacy Production/Admin only as migration evidence.

Historical Family/Configuration/retailer-package Admin designs are not authority.

## 3. Current Admin inventory — 31 operational states

### Auth & Access

- `31:653` — A01 Login
- `31:667` — A02 Invite Acceptance
- `31:679` — A03 Forgot Password
- `31:687` — A04 Reset Password
- `31:697` — A05 Unauthorized
- `31:705` — A06 Disabled Staff

### Dashboard

- `31:713` — A07 Dashboard

### Product / Catalogue operations

- `31:729` — A08 Product List
- `31:741` — A09 Product Create/Edit/Detail
- `930:11` — A09B Sản phẩm · SKU bán được
- `1015:2` — A09C Sản phẩm · Chưa có Dòng sản phẩm
- `31:761` — A10 Dòng sản phẩm / Trục / Lựa chọn
- `1012:85` — A10B Tạo Dòng sản phẩm từ Sản phẩm
- `31:799` — A14 Hình ảnh & tài liệu

The former A11 Category Management, A12 Brand Management and A13 Specs/Filter Metadata Management are **OUT of Admin V1** and removed from current Figma/navigation.

This does not remove canonical Category/Brand data or Public Category/Brand experiences.

### Retail Orders

- `31:811` — A15 Order List
- `31:821` — A16 Order Detail / NEW
- `931:26` — A16B Order Detail / CONFIRMED Bank Transfer

### Quote / Sales

- `31:835` — A17 Quote Request List
- `31:843` — A18 Quote Request Detail / immutable
- `31:853` — A19 Negotiated Quote Create/Edit
- `31:869` — A20 Share Quote
- `31:879` — A21 Quote→Order Confirmation

### Marketing / Content + Campaign

- `31:889` — A22 Content List
- `31:899` — A23 Content Editor
- `933:2` — A24 Campaign List
- `933:139` — A25 Campaign Editor

### Staff & Roles

- `31:937` — A26 Staff List
- `31:947` — A27 Invite Staff
- `31:959` — A28 Staff Detail

### Customer Care

- `934:2` — A29 Yêu cầu tư vấn

### Managed Commerce Configuration

- `934:135` — A30 Managed Bank Transfer configuration

## 4. Application and Auth boundary

Admin and Public remain separate application surfaces over shared canonical services/data.

V1 fixed staff roles, combinable:

- Product
- Sales
- Marketing
- Admin

No custom role builder.

UI hiding is never authorization. Existing Supabase Auth/RLS/service-boundary architecture remains authoritative and must be extended to new domain tables after global freeze.

## 5. Dashboard

A07 is operational triage, not advanced BI.

Useful summaries:

- Retail Orders needing action;
- pending Quote Requests;
- Products needing publish-quality attention;
- new Contact Requests;
- quick links to operational queues.

Do not grow this into CRM/analytics platform scope.

## 6. Product operations — current Owner model

### 6.1 Product identity

One manufacturer model = one canonical Product = one canonical PDP.

A Product may be:

- standalone; or
- member of exactly one Dòng sản phẩm.

A09 manages Product identity, canonical Brand/primary Category references, commerce defaults, readiness and links to SKU/Dòng/media workflows.

Admin V1 does **not** provide separate CRUD for Category, Brand or Spec/Filter definitions. Existing approved canonical references may still be displayed/selected according to final implementation data source.

### 6.2 Sellable SKU records

A09B is generic **SKU bán được** management, not a special colour subsystem.

A Product may own one or more exact sellable SKUs.

A SKU may carry the exact approved state required for commerce, including where applicable:

- SKU identity;
- display option label such as Chrome/Đen mờ;
- price/sale/online discount behavior under the final Product/SKU commerce contract;
- availability;
- media mapping;
- public/sellable state.

Product remains the PDP/SEO identity. SKU-only switching does not create another Product/PDP.

### 6.3 Dòng sản phẩm

User-facing `Family` is **Dòng sản phẩm**.

Dòng owns no price, SKU, stock, SEO identity or standalone Public route.

A Dòng defines 1–3 ordered dependent Trục lựa chọn. Each Trục has:

- custom display label;
- optional semantic type;
- deterministic order;
- Lựa chọn values constrained by the selected parent path.

Terminal paths map to real canonical Product and/or exact sellable SKU.

No Cartesian option generation.

No Family-selector-specific `retailer_package` target.

### 6.4 A10 mental model

Staff operates the same selection structure that customers see.

Examples:

- MS885: `Loại nắp → Model → Sản phẩm`;
- TBG10302: `Bộ sản phẩm → Sản phẩm → Màu → SKU`.

The editor must make dependent paths explicit and give a Public PDP preview.

### 6.5 A10B guided creation

Creating a Dòng from a Product should be low-friction:

1. create Dòng identity;
2. add current Product;
3. create Trục 1;
4. create first Lựa chọn;
5. map it explicitly to current Product;
6. continue in A10.

A Product may later move from standalone to Dòng membership without changing its canonical Product URL/SEO identity.

### 6.6 Public selector eligibility

Do not use Product membership count alone.

A Dòng exposes a meaningful selector when it has at least two valid selectable terminal paths.

## 7. Product media/documents

A14 remains in Admin V1.

Keep canonical Product media/document management and processing state. New architecture adds the later requirement that a sellable SKU may map to specific gallery/media while keeping the Product canonical PDP.

Bunny remains media authority; no provider redesign.

## 8. Product publication/readiness

Authorized Product-role staff may publish directly; no heavyweight approval workflow.

Readiness should ensure Product/SKU/Dòng selector dependencies needed by the published state are complete and non-misleading.

Do not make Dòng mandatory for Product publication. Standalone Product is valid.

## 9. Retail Orders

Canonical lifecycle:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` is a terminal branch.

A16 NEW must preserve:

- exact line snapshot;
- exact selected Product/SKU identity;
- customer/delivery snapshot;
- payment method/status;
- pending shipping/install fees without encoding pending as `0đ`;
- final total not yet confirmed.

Staff confirms commercial total before CONFIRMED.

A16B Bank Transfer:

- Order = CONFIRMED;
- final total fixed;
- payment may remain UNPAID;
- managed transfer instructions become actionable only after CONFIRMED;
- confirmation does not itself mark payment as paid.

## 10. Quote / Sales

Canonical sequence:

`immutable Quote Request → negotiated Quote → tokenized read-only share → optional idempotent Quote→Order`

Rules:

- customer Quote Request snapshot is immutable;
- negotiated pricing belongs to Quote, not Product/SKU;
- public share route `/bao-gia/{publicToken}`;
- Quote→Order creates exactly one Order and is safe to retry;
- exact selected Product/SKU identity is preserved through snapshots.

## 11. Contact Request / CSKH

A29 uses the dedicated Contact Request domain.

Intake:

- required name;
- required phone;
- optional message;
- source page;
- created timestamp.

Admin lifecycle:

`NEW → CONTACTED → CLOSED`

This is not Quote Request and not a CRM.

## 12. Marketing Content

A22/A23 manage:

- Guide;
- Inspiration;
- Buying Guide;
- Landing Page.

Content may reference canonical Product/Category/Brand records but must not duplicate their commerce truth.

## 13. Campaign

A24/A25 manage Homepage merchandising only:

- internal campaign identity;
- banner/media;
- manually selected ordered canonical Products;
- Homepage placement;
- Draft/Published/Archived;
- preview/publish/archive.

Campaign is not Collection and not a pricing/coupon engine.

## 14. Staff / fixed roles

A26–A28 support staff listing/invite/detail and combinations of fixed roles.

No public staff signup, custom role builder, arbitrary permission matrix or organization-management platform.

## 15. Managed Bank Transfer configuration

A30 is narrow, not a generic settings platform.

May manage:

- bank name;
- account holder;
- account number;
- optional branch/note;
- transfer-content template;
- customer-facing instructions.

Do not expose transfer instructions before Order CONFIRMED.

## 16. Explicit Admin V1 exclusions

No:

- Wishlist;
- Collection;
- Category CRUD;
- Brand CRUD;
- Spec/Filter metadata definition UI;
- custom roles;
- CRM;
- procurement/supplier platform;
- fulfilment/logistics engine;
- appointment booking;
- notification center;
- automation builder;
- advanced DAM/BI;
- coupon/pricing-rules engine;
- separate mobile Admin product/IA.

## 17. M0–M2 implementation impact

The current platform/security foundation remains valid. The old Family/SKU schema representation is superseded by ADR 0022.

After global freeze, implementation must use additive/corrective changes for:

- one-to-many sellable SKUs per Product;
- Dòng / 1–3 Axis / dependent Option paths;
- terminal Product/SKU targets;
- revised selector eligibility;
- equivalent RLS/attribution/Admin services/Public projections;
- deterministic importer mapping;
- SKU media mappings;
- backup/restore coverage.

Historical migrations remain immutable.

See `docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`.

## 18. Acceptance criteria after global freeze

At minimum prove:

1. Admin requires authentication and server-side fixed-role authorization.
2. standalone Product can publish without a Dòng.
3. one Product cannot belong to more than one Dòng.
4. Product supports multiple exact sellable SKUs.
5. Dòng supports 1–3 dependent Axes and valid-path filtering.
6. Admin preview matches approved MS885/TBG10302 Public selector behavior.
7. invalid option combinations cannot become sellable.
8. exact Product/SKU identity is preserved in Cart/Quote/Order.
9. Category/Brand/Spec management UI is absent from Admin V1.
10. Retail lifecycle and Bank Transfer timing match approved Public flow.
11. Quote Request remains immutable and Quote→Order idempotent.
12. Contact Request remains separate from Quote.
13. Campaign remains merchandising only.
14. no custom roles/Collection/Wishlist are exposed.
15. current page-02 Admin visual shell is followed.

## 19. Gate

No implementation until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
