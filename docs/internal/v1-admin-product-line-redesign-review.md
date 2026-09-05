# V1 Admin Product / Dòng — Redesign Review Contract

**Status:** OWNER REVIEW — not approved/frozen  
**Date:** 2026-09-05  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Admin page:** `02 — ADMIN — Operational Wireframes` (`31:11`)  
**Architecture:** ADR 0022

> [!IMPORTANT]
> These screens replace the prior unapproved Product/Family Admin flow as the current review candidate. They do **not** authorize implementation. No coding before `V1 WIREFRAME APPROVED / FROZEN`.

## 1. Owner feedback driving the redesign

The prior Admin Product/Family wireframes were **not approved** because the flows did not match staff needs closely enough.

The redesigned experience must optimize for three real jobs:

1. find and manage an existing Product;
2. create a Product, including its sellable SKUs and optional Dòng relationship;
3. create and manage Dòng sản phẩm structures that map directly to the Public PDP selector.

The UI must be understandable without requiring staff to understand database schema terminology.

## 2. Locked Product/SKU inheritance decision

A Product owns the default values used by its PDP.

A sellable SKU may define its own:

- price / sale / online-discount values;
- availability/status;
- media/gallery mapping.

When a SKU-specific value is not declared, it **falls back to the Product value**.

Admin must show this explicitly as either:

- `Kế thừa Sản phẩm`; or
- `Dùng giá trị riêng`.

Public PDP and commerce use the effective resolved value for the selected Product + SKU.

## 3. Current review candidate — Figma nodes

### Existing Product discovery / management

- `1051:4` — **A08R — Tìm kiếm & quản lý Sản phẩm**
- `1051:196` — **A09R — Sản phẩm / Tổng quan**

Flow:

`Tìm tên/model/SKU → lọc → mở Sản phẩm → quản lý SKU / Dòng / media / PDP / xuất bản`

The list exposes the information staff need to identify the correct record quickly: image, Product/model, SKU count, effective starting price, Dòng and Public state.

The Product workspace is the central operating page. It provides direct paths to SKU management, Dòng management, media/documents and Public PDP preview.

### Create Product

- `1051:394` — **A09N1 — Tạo Sản phẩm / Thông tin cơ bản**
- `1051:549` — **A09N2 — Tạo Sản phẩm / SKU & Kế thừa**
- `1051:733` — **A09N3 — Tạo Sản phẩm / Dòng & Xuất bản**

Flow:

`Thông tin Sản phẩm → SKU bán được → optional Dòng → kiểm tra PDP → xuất bản`

Step 1 creates the canonical Product identity and Product-level default commerce state.

Step 2 creates exact sellable SKUs. Each SKU visibly chooses whether price, availability and media inherit from Product or use its own value.

Step 3 makes Dòng optional. Staff can leave the Product standalone, add it to an existing Dòng, or create a new Dòng. A publication-readiness checklist and PDP preview are visible before publish.

### Create / manage Dòng sản phẩm

- `1051:909` — **A10R — Danh sách Dòng sản phẩm**
- `1051:1066` — **A10C — Tạo Dòng sản phẩm**
- `1051:1231` — **A10E — Quản lý Dòng / Trục / Lựa chọn / Xem trước PDP**

Flow:

`Tìm Dòng → mở Dòng` or `Tạo Dòng → chọn Product đầu tiên → tạo Trục + Lựa chọn đầu tiên → mở cùng trang quản lý Dòng`.

There is one consistent Dòng editor rather than separate schema-first editors.

The Dòng editor uses three visible concepts:

1. **Sản phẩm trong Dòng** — which canonical Products are allowed in this Dòng;
2. **Cấu trúc lựa chọn trên PDP** — ordered dependent Trục and Lựa chọn;
3. **Xem trước PDP** — the exact customer-facing selector/effective Product/SKU state.

Each Lựa chọn answers one direct question: **sau khi khách chọn lựa chọn này, kết quả là Sản phẩm hoặc SKU nào?**

## 4. Direct Public PDP mapping

### TBG10302

Admin:

`Trục 1 Bộ sản phẩm → Lựa chọn → Sản phẩm đích → Trục 2 Màu → Lựa chọn → SKU`

Public:

`Bộ sản phẩm → Màu`, while Product-changing choices navigate to the canonical Product PDP and SKU-only choices remain on the current PDP.

### MS885

Admin/Public use the same engine:

`Loại nắp → Model → Sản phẩm`

Later Trục options are dependent on the selected parent path; no Cartesian combination generation.

## 5. UX principles locked for further review

- Search accepts Product name, manufacturer model and SKU.
- Product creation uses progressive steps rather than one dense schema form.
- Product can publish without a Dòng.
- Product belongs to at most one Dòng.
- Adding a Product to a Dòng does not automatically create a PDP choice.
- Dòng creation from a Product pre-fills that Product instead of creating a second management model.
- Staff-facing UI uses Vietnamese; technical schema enums do not appear in controls.
- SKU inheritance source is always visible.
- Dòng editor shows the same choice order and dependency the customer will see.
- Public preview is available directly from Product and Dòng workflows.

## 6. Old frames

The prior unapproved Product/Dòng frames remain temporarily on the Figma canvas at reduced opacity and are renamed `SUPERSEDED` for audit/comparison only. They are not current review authority.

They may be deleted after the Owner approves the replacement flow.

## 7. Structural QA

Current redesigned review candidate:

- 8/8 new states: `0` root-boundary failures;
- 8/8 new states: `0` missing fonts;
- user-facing technical-English audit: `0` hits for the reviewed forbidden schema/implementation vocabulary;
- approved Public PDP visual layouts were not redesigned by this Admin change.

## 8. Remaining Owner gate

This Product/Dòng Admin slice is **OWNER REVIEW**.

Do not convert this document into an implementation contract until Owner approval. Global project implementation remains blocked until the exact phrase:

`V1 WIREFRAME APPROVED / FROZEN`
