# V1 PDP + Dòng sản phẩm — Implementation Handoff

**Status:** Owner-locked Public design/architecture contract; Admin Product/Dòng replacement is OWNER REVIEW; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Architecture:** ADR 0022

> [!IMPORTANT]
> Do **not** implement this document yet. Coding may start only after 100% of launch-critical Public + Admin wireframes are Owner-approved and the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Purpose

This is the current implementation handoff for Product Detail Pages and the V1 related-product selection system.

User-facing terminology is:

- **Family = Dòng sản phẩm**;
- **Axis = Trục lựa chọn**;
- **Option = Lựa chọn**.

The historical `Family → Configuration Group → Configuration → Colour / retailer_package` model is superseded. Do not derive implementation from ADR 0017 or old Family annotations.

## 2. Core catalogue model

V1 has two valid Product cases.

### Standalone Product

A canonical Product/PDP that does not belong to a Dòng sản phẩm.

### Product in a Dòng sản phẩm

A canonical Product/PDP that participates in an ordered dependent selector.

Rules:

- one manufacturer model = one canonical Product = one canonical PDP;
- a Product belongs to zero or one Dòng;
- Dòng has no price, SKU, stock, availability, SEO identity or standalone Public route;
- Dòng exists only to organize related choices on PDP;
- a Dòng defines 1–3 ordered dependent Trục lựa chọn;
- Axis display label is custom per Dòng and may have an optional semantic type;
- each Trục has Lựa chọn values;
- later Trục values depend on the previous selected Lựa chọn;
- runtime must expose only valid curated paths, never Cartesian combinations;
- every sellable terminal path resolves to a real canonical Product and/or exact real sellable SKU.

Canonical shape:

`Dòng → Trục 1 → Lựa chọn → [Trục 2 → Lựa chọn] → [Trục 3 → Lựa chọn] → Sản phẩm / SKU`

## 3. Product vs SKU behavior — locked

Product identity and exact sellable SKU identity are distinct.

A selection may resolve to another Product:

- navigate to that Product's canonical PDP/URL;
- preserve the Dòng context and selected path where appropriate.

A selection may resolve only to another SKU of the current Product:

- remain on the same canonical PDP/URL;
- change exact SKU;
- effective price/sale/online-discount may change;
- availability/status may change;
- gallery/media may change;
- Cart/Quote must preserve the exact selected SKU.

### Product-default / SKU-specific inheritance

Owner decision 05/09/2026:

- Product provides the default price/sale/online-discount values, indicative availability/status and default media;
- a sellable SKU may define its own value for those fields and its own media mapping;
- when a SKU-specific value is absent, runtime falls back to the Product value;
- SKU-specific media mapping, when present, replaces Product media for the selected SKU; otherwise Product media is used.

Effective resolution must be deterministic and server-authoritative. UI may communicate the source as `Kế thừa Sản phẩm` or `Dùng giá trị riêng`.

`Màu` is not a separate Family subsystem. It is one possible Trục label/semantic type.

## 4. Approved Public examples

### 4.1 MS885 — two dependent axes

Mental model:

`Dòng MS885 → Loại nắp → Model → Product → SKU`

Example:

`Nắp điện tử → WASHLET S7 → MS885DW11 → exact sellable SKU`

The second Trục only shows models valid for the selected seat type.

Desktop authority includes:

- `577:2` — D08A Product Info;
- `577:217` — D08B Nắp điện tử interaction;
- `666:2` — included items;
- `680:90` — technical specs;
- `680:318` — technical documents.

### 4.2 TBG10302 — Product axis then SKU axis

Mental model:

`Dòng TBG10302 → Bộ sản phẩm → canonical Product → Màu → exact SKU`

Examples shown in the approved PDP pattern:

- `Không gồm tay sen` → a real canonical Product;
- `Bộ tay sen 104ZR` → a real canonical Product;
- `Bộ tay sen 108ZR` → a real canonical Product;
- when the selected Product has multiple colour SKUs, `Màu` appears as the next Trục.

There is no Family-selector-specific `retailer_package` target anymore. A sellable 104ZR/108ZR configuration must be represented by approved real Product/SKU data before catalogue rollout. Do not fabricate a manufacturer model code when evidence is missing.

Desktop authority:

- `717:2` — D09S-A, Bộ sản phẩm → Product, Chrome;
- `717:182` — D09S-B, same Product/PDP with another SKU colour;
- `717:362` — D09S-C, Bộ tay sen 108ZR as Product target + Màu;
- `717:542` — D09S-D, Model → Product example.

Mobile authority:

- `744:3`, `752:2`, `752:135`, `754:2`, `754:140`, `754:284`.

Approved section names are now:

- `04 — PDP DESKTOP — APPROVED DÒNG SẢN PHẨM SYSTEM` (`741:2`);
- `05 — PDP MOBILE — APPROVED DÒNG SẢN PHẨM SYSTEM` (`744:2`).

## 5. Selector rendering contract

The visual patterns already approved remain authority. The data semantics underneath them are ADR 0022.

For every visible Trục:

- use its custom display label;
- show only Lựa chọn values valid under the current parent path;
- deterministic order is explicit, not inferred from price or SKU;
- selected state is visually unambiguous;
- horizontal scrolling is allowed when required by the approved responsive layout.

A Lựa chọn may display:

- thumbnail;
- concise label;
- target Product/model context where useful;
- effective customer price/contact-price state where approved;
- current state.

The selector must not infer business meaning by parsing SKU strings or Product names.

## 6. Dòng eligibility

A Product can exist perfectly well without a Dòng.

A Dòng should render a meaningful Public selector only when it has at least two valid selectable terminal paths.

Do not use the historical rule `>= 2 Product memberships` as Public selector eligibility. One Product may legitimately have multiple sellable SKU paths, and a Dòng may mix Product-changing and SKU-only paths.

## 7. Commerce and historical snapshot rules

The selector is navigation to canonical commerce identities, not a free configurator.

- no runtime construction of arbitrary component combinations;
- no fabricated Product/SKU;
- final selection must resolve to authoritative Product/SKU data;
- effective commerce/media state resolves from SKU-specific value first, then Product fallback;
- server revalidates authoritative effective price/availability at Cart/Checkout/Quote boundaries;
- Retail Cart and Quote Cart preserve exact selected Product + SKU identity;
- Order/Quote snapshots preserve the resolved commercial values used at creation/confirmation;
- historical snapshots remain immutable after later Product/SKU changes.

## 8. Search and routing

Search may match a Product model or alternate sellable SKU.

Routing rules:

- Product target → canonical Product PDP;
- SKU target within Product → canonical Product PDP with selected-SKU state where supported;
- no standalone Dòng route;
- no separate colour SEO page.

Search/PDP projections must resolve effective price/status using SKU-specific values where present and Product fallback otherwise.

## 9. Admin dependency — current OWNER REVIEW replacement

The previous Admin Product/Dòng candidate was not approved by Owner and is superseded for review.

The replacement is designed around three staff jobs: search/manage Product, create Product, create/manage Dòng.

Current review nodes:

### Search/manage Product

- `1051:4` — A08R Tìm kiếm & quản lý Sản phẩm;
- `1051:196` — A09R Sản phẩm / Tổng quan.

### Create Product

- `1051:394` — A09N1 Tạo Sản phẩm / Thông tin cơ bản;
- `1051:549` — A09N2 Tạo Sản phẩm / SKU & Kế thừa;
- `1051:733` — A09N3 Tạo Sản phẩm / Dòng & Xuất bản.

### Create/manage Dòng

- `1051:909` — A10R Danh sách Dòng sản phẩm;
- `1051:1066` — A10C Tạo Dòng sản phẩm;
- `1051:1231` — A10E Quản lý Dòng / Trục / Lựa chọn / Xem trước PDP;
- `31:799` — A14 Hình ảnh & tài liệu remains reused.

Admin must make Product-default vs SKU-specific inheritance visible and provide direct Public PDP preview from Product/Dòng workflows.

Detailed review contract: `docs/internal/v1-admin-product-line-redesign-review.md`.

## 10. Import / provenance rules

Legacy Production `variant_group`, combo/package and colour metadata are evidence only.

Import/curation must explicitly establish:

- Dòng identity;
- ordered Axis definitions;
- optional semantic type;
- dependent Option paths;
- Product membership;
- exact sellable SKU records;
- Product/SKU terminal targets;
- Product-default and SKU-specific commerce/media values only when evidence supports ownership.

Ambiguous mappings or ambiguous SKU override ownership must be quarantined. Never guess by parsing model strings alone.

## 11. M0–M2 compatibility

Keep the New Production platform architecture. ADR 0022 supersedes only the old Family/SKU representation.

Historical migrations stay immutable. After global freeze, implementation uses additive/corrective migrations and equivalent RLS/service/import/media/backup updates.

See:

- `docs/adr/0022-v1-product-line-axis-option-family-model.md`;
- `docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`;
- `docs/internal/v1-admin-product-line-redesign-review.md`.

## 12. Acceptance criteria after global freeze

Implementation must prove at minimum:

1. standalone Product works without a Dòng;
2. one Product cannot belong to more than one Dòng;
3. each Dòng supports 1–3 ordered Axes;
4. later Axis options are correctly constrained by the earlier selected path;
5. MS885 behaves as `Loại nắp → Model → Product`;
6. TBG10302 behaves as `Bộ sản phẩm → Product → Màu → SKU`;
7. Product-changing choice navigates to canonical target PDP;
8. SKU-only choice keeps the same PDP and switches exact SKU/state;
9. SKU-specific price/status/media overrides Product when present;
10. missing SKU-specific value falls back to Product deterministically;
11. every terminal sellable path resolves to a real Product/SKU;
12. no `retailer_package` selector target is required;
13. exact Product/SKU and resolved commerce values survive Cart, Quote and Order snapshots;
14. Desktop and Mobile share one domain contract.

## 13. Gate

This handoff records current authority but does not authorize implementation.

No schema/service/application coding until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
