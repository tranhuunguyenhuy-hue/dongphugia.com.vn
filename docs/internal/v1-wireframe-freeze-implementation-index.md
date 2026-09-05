# Dong Phu Gia V1 — Wireframe Freeze / Implementation Index

**Status:** Master source-of-truth index for final Owner review  
**Date:** 2026-09-05  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)

> [!IMPORTANT]
> This document does **not** open implementation. No Codex/application/schema implementation may start until 100% launch-critical Public + Admin wireframes are Owner-approved and the Owner says exactly **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Authority order

1. newest Owner decisions;
2. current approved/reviewable Figma authority;
3. current domain handoffs and ADRs;
4. completed M0–M2 architecture where not superseded;
5. legacy Production only as evidence.

ADR 0022 supersedes the old Family/Configuration/retailer-package selector model.

## 2. Current Product/Dòng architecture

User-facing `Family` = **Dòng sản phẩm**.

Two Product cases:

- standalone Product;
- Product belonging to one Dòng sản phẩm.

Rules:

- one manufacturer model = one Product = one canonical PDP;
- Product belongs to zero or one Dòng;
- Dòng owns no commerce/SEO/standalone route;
- Dòng has 1–3 ordered dependent Trục lựa chọn;
- Axis labels are custom with optional semantic type;
- each Axis has dependent Lựa chọn values;
- terminal path maps to real Product and/or exact sellable SKU;
- Product-changing choice changes PDP/URL;
- SKU-only choice stays on the same PDP;
- Màu is one possible Axis;
- no Family-selector-specific `retailer_package` target.

Reference examples:

- MS885: `Loại nắp → Model → Sản phẩm`;
- TBG10302: `Bộ sản phẩm → Sản phẩm → Màu → SKU`.

## 3. Public route/page inventory

Launch-critical Public routes remain:

- `/`
- `/tim-kiem`
- `/danh-muc/{...slug}`
- `/thuong-hieu`
- `/thuong-hieu/{brandSlug}`
- `/san-pham/{productSlug}`
- `/gio-hang`
- `/thanh-toan`
- `/dat-hang/thanh-cong`
- `/bao-gia`
- `/bao-gia/yeu-cau`
- `/bao-gia/{publicToken}`
- `/cam-nang`
- `/cam-nang/huong-dan/{slug}`
- `/cam-nang/cam-hung/{slug}`
- `/cam-nang/tu-van-mua/{slug}`
- content-owned Landing route
- `/showroom`
- `/ho-tro/{slug}`

There is no standalone Dòng sản phẩm route.

## 4. Public Figma authority

Page: `01 — PUBLIC — Responsive Wireframes`.

Sections:

- Global/Entry — navigation + Homepage
- Search
- Catalogue/Discovery — Category/Brand
- `04 — PDP DESKTOP — APPROVED DÒNG SẢN PHẨM SYSTEM` (`741:2`)
- `05 — PDP MOBILE — APPROVED DÒNG SẢN PHẨM SYSTEM` (`744:2`)
- `06 — RETAIL ORDER` (`181:29`)
- `07 — QUOTE` (`917:2`)
- `08 — CONTENT / SHOWROOM / SUPPORT` (`920:2`)

### PDP authority

Desktop key states:

- `577:2`, `577:217`, `666:2`, `680:90`, `680:318`
- `717:2`, `717:182`, `717:362`, `717:542`

Mobile key states:

- `744:3`, `752:2`, `752:135`, `754:2`, `754:140`, `754:284`

Visual interaction remains approved; semantics and embedded spec annotations are synchronized to ADR 0022.

### Retail Order authority

Desktop Cart/Checkout/Confirmation and Mobile M10–M12 remain Owner-approved.

Lifecycle:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` terminal branch.

Bank instructions only become actionable after CONFIRMED.

### Quote authority

Quote Desktop/Mobile remains Owner review candidate.

Canonical flow:

`Quote Cart → Quote Request → immutable request → negotiated Quote → token share → optional idempotent Quote→Order`

### Content / Contact authority

Content/Landing/Showroom/Support Desktop/Mobile remains Owner review candidate.

Contact Request is separate from Quote Request.

## 5. Admin Figma authority — 31 states

Page: `02 — ADMIN — Operational Wireframes` (`31:11`).

Current modules:

- Auth A01–A06
- Dashboard A07
- Product/Catalogue:
  - `31:729` A08 Product List
  - `31:741` A09 Product
  - `930:11` A09B Sản phẩm · SKU bán được
  - `1015:2` A09C Sản phẩm chưa có Dòng
  - `31:761` A10 Dòng / Trục / Lựa chọn
  - `1012:85` A10B Tạo Dòng từ Sản phẩm
  - `31:799` A14 Media/Documents
- Orders A15–A16B
- Quote/Sales A17–A21
- Content/Campaign A22–A25
- Staff/Roles A26–A28
- Customer Care A29
- Managed Commerce Config A30

Removed from Admin V1:

- Category CRUD
- Brand CRUD
- Spec/Filter Metadata definition UI

Public Category/Brand pages and canonical references remain V1 scope.

Admin remains desktop-first; no separate mobile Admin IA.

## 6. Durable handoffs

### Product / Dòng / PDP

`docs/internal/v1-pdp-family-system-implementation-handoff.md`

Current content follows ADR 0022 despite the historical filename.

### Admin ↔ Public Dòng selector

`docs/internal/v1-family-admin-pdp-selector-linkage.md`

Current content follows Dòng / Axis / Option / SKU despite the historical filename.

### Admin Operations

`docs/internal/v1-admin-operations-implementation-handoff.md`

### Retail Order

`docs/internal/v1-retail-order-implementation-handoff.md`

### Quote

`docs/internal/v1-quote-implementation-handoff.md`

### Content / Contact

`docs/internal/v1-content-contact-implementation-handoff.md`

### M0–M2 Product-line impact audit

`docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`

## 7. Architecture / ADR authority

Current:

- ADR 0016 — platform/domain baseline, except Family clauses superseded by ADR 0022
- ADR 0020 — Product pricing contract
- ADR 0021 — Retail Order commercial confirmation/pending fees
- **ADR 0022 — Dòng sản phẩm / Trục / Lựa chọn / Product-SKU model**

Historical only:

- ADR 0017 old Family Configuration/retailer-package model — explicitly superseded by ADR 0022.

Historical M1/M2 migrations remain immutable evidence.

## 8. M0–M2 impact status

Feasibility of ADR 0022 is confirmed.

Preserved:

- Supabase `dpg_v1` canonical authority
- Public/Admin app split
- fixed roles/RLS/service security model
- Cloudflare/Bunny topology
- deterministic provenance/quarantine
- Quote/Order snapshot/idempotency architecture
- encrypted backup/recovery architecture

Requires post-freeze additive amendments:

- one-to-many exact sellable SKU records per Product
- Dòng / Axis / dependent Option structures
- terminal Product/SKU targets
- revised selector eligibility
- importer mappings
- equivalent RLS/services/Public projections
- SKU-specific media mapping
- backup/restore manifests and semantic validation

Direct Preview audit on `dongphugia-runtime` found the old M1/M2 schema but zero canonical catalogue rows in Product/Family tables at the time of the decision, materially lowering migration risk.

## 9. Explicit V1 exclusions

Do not implement/expose:

- Wishlist
- Collection
- mandatory customer account
- customer Order portal
- Compare
- arbitrary configurator/BOM engine
- runtime creation of arbitrary Product combinations
- coupon/promotion/pricing-rules engine
- CRM
- procurement/supplier platform
- logistics/fulfilment platform
- appointment booking
- notification center
- custom role builder
- advanced BI/DAM
- server-side/cross-device/AI personalization
- separate mobile Admin IA
- Admin Category/Brand/Spec-definition CRUD

## 10. Cross-domain invariants

1. canonical Product/SKU commerce data is authoritative;
2. one manufacturer model = one Product = one PDP;
3. Product belongs to maximum one Dòng;
4. Dòng is selection/navigation only;
5. selector exposes only valid curated paths;
6. Product target changes PDP; SKU target does not;
7. exact selected Product/SKU is snapshotted in Retail/Quote/Order;
8. Retail and Quote flows remain separate;
9. Contact and Quote Request remain separate;
10. Campaign is merchandising only;
11. server-side permissions/RLS are authoritative;
12. legacy Production is evidence, not UX/data authority.

## 11. Required implementation sequence after freeze

1. read this index + ADR 0022 + relevant handoff;
2. audit current code/schema only for the chosen slice;
3. propose exact additive schema/service delta;
4. Owner/Coordinator reviews material architecture delta;
5. add Product SKU + Dòng/Axis/Option schema through a new migration;
6. add RLS/services/Public projections;
7. update deterministic importer;
8. update SKU media mapping + backup/recovery coverage;
9. implement Public/Admin UI to frozen Figma;
10. update Cart/Quote/Order authoritative exact-SKU resolution;
11. prove Preview end-to-end acceptance before Production activation.

## 12. Freeze checklist

Before Owner can issue `V1 WIREFRAME APPROVED / FROZEN` verify:

- all launch-critical Public states are reviewable/approved;
- all launch-critical Admin states are reviewable/approved;
- Dòng/Axis/Option/Product-SKU semantics are consistent across Public/Admin/ADR/handoffs;
- old Configuration/retailer-package semantics are absent from current authority;
- Quote and Content/Showroom/Support are Owner-approved;
- final V1 Sitemap FigJam exists;
- final end-to-end User Flows FigJam exists;
- durable handoffs and Linear are synchronized;
- final structural QA has no missing fonts/root overflow;
- Owner explicitly issues the exact freeze phrase.

Until then, implementation remains blocked.
