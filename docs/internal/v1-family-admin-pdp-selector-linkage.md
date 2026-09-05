# V1 Dòng sản phẩm Admin ↔ Public PDP Selector — Implementation Handoff

**Status:** Owner-locked architecture; Admin wireframes synchronized; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Admin:** page `02 — ADMIN — Operational Wireframes` (`31:11`)  
**Architecture:** ADR 0022

> [!IMPORTANT]
> Do not implement before the Owner says exactly **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Current model

The old Admin distinction between Family membership, Configuration Group, Configuration and special Colour/package handling is superseded.

Current user-facing model:

**Dòng sản phẩm → Trục lựa chọn → Lựa chọn → Sản phẩm/SKU**

Rules:

- a Sản phẩm belongs to zero or one Dòng;
- Dòng owns no commerce or SEO identity;
- each Dòng has 1–3 ordered dependent Trục;
- Axis label is custom and may carry an optional semantic type;
- Lựa chọn of a later Trục depend on the selected path above;
- terminal result maps to a real canonical Sản phẩm and/or exact sellable SKU;
- Product-changing selection changes canonical PDP;
- SKU-only selection stays on the same PDP;
- `Màu` is one possible Trục, not a separate Family subsystem;
- no Family-selector-specific `retailer_package` target remains.

## 2. Admin authority

### A09 — Sản phẩm

Node: `31:741`.

A09 owns canonical Product/PDP identity and commerce defaults. It shows whether the Product is standalone or belongs to one Dòng and gives direct access to:

- exact sellable SKU management;
- Dòng selector management;
- PDP preview;
- media/documents;
- publish/readiness.

Being a member of a Dòng does not automatically create a Public choice. The valid Axis/Option path is explicit.

### A09B — SKU bán được

Node: `930:11` — **A09B — Sản phẩm · SKU bán được**.

This is no longer a colour-only editor.

A Product may have one or more real sellable SKU records. Each SKU can hold the approved exact commerce/media state required for a sellable identity.

Example Product `TBG10302VA`:

- Chrome → exact SKU;
- Đen mờ → exact SKU.

A Dòng Axis such as `Màu` may reference these SKU records. The Product/PDP remains canonical.

### A09C — standalone Product

Node: `1015:2` — **Sản phẩm · Chưa có Dòng sản phẩm**.

A standalone Product is valid. Staff may:

- leave it standalone;
- add it to an existing Dòng;
- create a new Dòng from the Product.

Creating a Dòng later must not destroy the Product's canonical URL/SEO identity.

### A10 — Dòng / Trục / Lựa chọn

Node: `31:761`.

A10 is the operational authority for Public selector structure.

Staff mental model:

1. choose a Dòng;
2. inspect its ordered Trục structure;
3. choose/edit a Lựa chọn under the current parent path;
4. define its result as another Sản phẩm or an exact SKU path;
5. optionally define the next Trục;
6. preview the customer-facing PDP behavior.

Current TBG10302 fixture demonstrates:

`Trục 1 Bộ sản phẩm → Sản phẩm đích → Trục 2 Màu → SKU`

The same engine supports MS885:

`Trục 1 Loại nắp → Trục 2 Model → Sản phẩm`

### A10B — guided creation

Node: `1012:85` — **Tạo Dòng sản phẩm từ Sản phẩm**.

Guided flow:

1. create Dòng identity;
2. add current Sản phẩm as the first member;
3. create Trục 1;
4. create first Lựa chọn;
5. explicitly map the result to the current Sản phẩm;
6. open A10 to add further Trục/Lựa chọn paths.

The wizard may make this feel like one operation, but implementation must persist valid domain relationships deterministically and idempotently.

## 3. Public mapping

### MS885

Public:

`Loại nắp → Model → Sản phẩm/PDP`

Admin must allow:

- Trục `Loại nắp`;
- dependent Trục `Model`;
- different valid Model options for each seat-type option;
- each terminal Model option maps to a real Product.

### TBG10302

Public:

`Bộ sản phẩm → Sản phẩm/PDP → Màu → SKU`

Admin must allow:

- `Bộ sản phẩm` options such as Không gồm tay sen / 104ZR / 108ZR;
- each sellable configuration backed by a real canonical Product;
- optional next Trục `Màu` under Products with multiple sellable SKUs;
- each Màu option maps to an exact SKU of that Product.

Do not recreate the old runtime package target or infer a bundle from component strings.

## 4. Validation rules

A Public path is valid only when its required dependencies resolve.

At minimum validate:

- valid Dòng;
- Product belongs to at most one Dòng;
- Axis order is deterministic and between 1 and 3;
- custom Axis label is non-empty;
- optional semantic type is valid if supplied;
- every child Option is attached to the correct parent path;
- Product target exists and is eligible when path changes Product;
- SKU target belongs to the resolved Product when path changes SKU only;
- Public/selectable state is valid;
- selector label/thumbnail presentation is resolvable where required by Figma;
- no duplicate or impossible terminal path;
- every sellable terminal path resolves to real canonical commerce identity.

## 5. Public eligibility

Do not use Product membership count alone.

A Dòng should expose a Public selector when it has at least two valid selectable terminal paths. This allows:

- multiple Products in one Dòng;
- multiple SKUs of one Product where relevant;
- mixed Product-changing and SKU-only axes.

## 6. Implementation invariants

1. Dòng is not a Product.
2. One Product belongs to maximum one Dòng.
3. Do not generate selector choices directly from membership.
4. Do not generate Cartesian option combinations.
5. Later-axis options must be filtered by the chosen parent path.
6. Do not parse SKU strings to invent Axis or Option meaning.
7. Do not fabricate missing Product/SKU records.
8. Do not duplicate Product business truth into Axis/Option records.
9. SKU-only selection remains on the same Product/PDP.
10. Product-changing selection navigates to canonical target PDP.
11. Desktop and Mobile use the same domain tree.

## 7. M0–M2 compatibility

The current M1 schema is historical baseline, not final selector structure. Historical migrations remain immutable.

After global freeze, additive/corrective work must cover:

- Axis/Option structures;
- one-to-many sellable SKUs per Product;
- terminal Product/SKU mapping;
- revised selector eligibility;
- RLS/service/public projection support;
- importer mappings;
- SKU media mapping;
- backup/restore manifest updates.

See `docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`.

## 8. Acceptance tests after global freeze

Implementation must prove:

- standalone Product renders without Dòng selector;
- a Product cannot join two Dòng;
- Dòng can have 1, 2 or 3 Axes;
- later Axis choices change correctly after parent selection;
- MS885 only shows models valid for the chosen seat type;
- TBG10302 Product choice can expose a dependent colour SKU axis;
- Product target changes URL/PDP;
- SKU target does not change canonical URL/PDP;
- no invalid combination becomes sellable;
- Admin preview matches Public Desktop/Mobile behavior;
- Cart/Quote/Order preserve exact selected Product/SKU.

## 9. Gate

No implementation before the exact Owner phrase:

**`V1 WIREFRAME APPROVED / FROZEN`**
