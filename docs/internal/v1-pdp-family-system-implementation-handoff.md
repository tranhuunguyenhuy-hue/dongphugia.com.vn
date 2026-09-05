# V1 PDP + Dòng sản phẩm — Implementation Handoff

**Status:** Owner-locked design/architecture contract; implementation blocked until global wireframe freeze  
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

## 3. Product vs SKU behavior

Product identity and exact sellable SKU identity are distinct.

A selection may resolve to another Product:

- navigate to that Product's canonical PDP/URL;
- preserve the Dòng context and selected path where appropriate.

A selection may resolve only to another SKU of the current Product:

- remain on the same canonical PDP/URL;
- change exact SKU;
- price/sale/online-discount may change according to the final approved Product/SKU commerce contract;
- availability may change;
- gallery/media may change;
- Cart/Quote must preserve the exact selected SKU.

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
- server revalidates authoritative price/availability at Cart/Checkout/Quote boundaries;
- Retail Cart and Quote Cart preserve exact selected Product + SKU identity;
- Order/Quote historical snapshots remain immutable after later catalogue changes.

## 8. Search and routing

Search may match a Product model or alternate sellable SKU.

Routing rules:

- Product target → canonical Product PDP;
- SKU target within Product → canonical Product PDP with selected-SKU state where supported;
- no standalone Dòng route;
- no separate colour SEO page.

## 9. Admin dependency

Admin must manage the same mental model customers see:

1. canonical Sản phẩm/PDP;
2. one or more exact sellable SKUs under the Product;
3. optional membership in one Dòng sản phẩm;
4. 1–3 ordered Trục lựa chọn;
5. dependent Lựa chọn paths;
6. terminal mapping to Product and/or SKU;
7. Public PDP preview.

Current Admin authority:

- `31:741` — A09 Product;
- `930:11` — A09B Sản phẩm · SKU bán được;
- `1015:2` — A09C Sản phẩm chưa có Dòng;
- `31:761` — A10 Dòng sản phẩm / Trục / Lựa chọn;
- `1012:85` — A10B Tạo Dòng sản phẩm từ Sản phẩm;
- `31:799` — media/documents.

## 10. Import / provenance rules

Legacy Production `variant_group`, combo/package and colour metadata are evidence only.

Import/curation must explicitly establish:

- Dòng identity;
- ordered Axis definitions;
- optional semantic type;
- dependent Option paths;
- Product membership;
- exact sellable SKU records;
- Product/SKU terminal targets.

Ambiguous mappings must be quarantined. Never guess by parsing model strings alone.

## 11. M0–M2 compatibility

Keep the New Production platform architecture. ADR 0022 supersedes only the old Family/SKU representation.

Historical migrations stay immutable. After global freeze, implementation uses additive/corrective migrations and equivalent RLS/service/import/media/backup updates.

See:

- `docs/adr/0022-v1-product-line-axis-option-family-model.md`;
- `docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`.

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
9. every terminal sellable path resolves to a real Product/SKU;
10. no `retailer_package` selector target is required;
11. exact Product/SKU survives Cart, Quote and Order snapshots;
12. Desktop and Mobile share one domain contract.

## 13. Gate

This handoff records current authority but does not authorize implementation.

No schema/service/application coding until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
