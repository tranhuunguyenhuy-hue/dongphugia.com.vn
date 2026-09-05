# V1 Product Line / Axis / Option — M0–M2 Impact Audit

**Status:** Owner-approved architecture amendment; implementation blocked until `V1 WIREFRAME APPROVED / FROZEN`  
**Date:** 2026-09-05  
**Authority:** Owner decision + ADR 0022

## 1. Executive conclusion

The new Product Line (`Family = Dòng sản phẩm`) / Axis / Option model is technically implementable on the current New Production foundation.

It does **not** require changing the platform topology, Auth model, Public/Admin application split, Bunny media provider, transactional Order/Quote model, or backup architecture.

It **does** supersede the historical M0/M1 Family data representation and requires additive schema/service/import/backup amendments after the global wireframe freeze.

The current isolated `dongphugia-runtime` Preview has the M1/M2 `dpg_v1` schema but no canonical Product/Family catalogue rows, so there is no live V1 catalogue dataset to migrate at this stage.

## 2. New canonical model

- Standalone Product: canonical Product/PDP, no Dòng sản phẩm.
- Product in Dòng: Product belongs to at most one Dòng sản phẩm.
- Dòng has 1–3 ordered Axes.
- Axis label is custom; optional semantic type is allowed.
- Options are dependent on the previous Option and form valid selection paths.
- Final path resolves to canonical Product and/or exact sellable SKU.
- Product change changes canonical PDP/URL.
- SKU-only change stays on the same Product/PDP.
- Dòng owns no SKU/price/stock/SEO/public route.
- Family-specific `retailer_package` target is removed; configurations such as TBG10302 + 108ZR must be represented by real canonical Product/SKU records.

### Locked Product/SKU inheritance — 05/09/2026

The previously open Product-vs-SKU commerce question is now resolved by Owner decision.

Product is the default source for price/sale/online-discount, indicative availability/status and default media.

A sellable SKU may define its own values for:

- price / sale / online-discount fields;
- availability/status;
- media/gallery mapping.

When a SKU-specific value is absent, runtime falls back to the Product value. Effective value resolution must be deterministic and visible in Admin as `Kế thừa Sản phẩm` vs `Dùng giá trị riêng`.

## 3. M0 impact

### LEO-556 — V1 page inventory / IA

**Impact: compatible.**

Keep Product/PDP routes and no standalone Family/Dòng route. No route inventory change is required.

### LEO-557 — canonical domain/data architecture

**Impact: material supersession in Family clauses.**

Keep:

- one manufacturer model = one Product = one PDP;
- Product belongs to zero/one Family/Dòng;
- Family/Dòng owns no commerce or SEO identity;
- no fabricated Products;
- Brand/Category/typed attribute/provenance contracts.

Supersede:

- `Family → optional Configuration Group → Product membership` as the complete selector model;
- public navigation eligibility based on at least two Product members;
- assumption that one Product has only one sellable SKU identity.

New authority: ADR 0022.

### LEO-558 — Public rendering/search/media architecture

**Impact: architecture compatible; projection contract amendment required later.**

Cloudflare/Supabase/Bunny topology remains valid. Search/public projections must include exact sellable SKUs and the Dòng Axis/Option selector projection rather than relying only on Product SKU + old Family group tables.

Search/Public data access must resolve effective SKU values using SKU-specific values first and Product fallback when the SKU field is absent.

### LEO-559 — Admin/Auth boundary

**Impact: compatible.**

Separate Public/Admin apps, fixed roles, RLS, direct authorized publishing and generic `catalogue.*` capabilities remain valid. No role model redesign is required.

### LEO-579 — wireframes

**Impact: synchronized Public semantics; Admin flow redesigned again from Owner feedback.**

Public PDP visual patterns remain largely unchanged and now use Dòng → Trục → Lựa chọn → Product/SKU semantics.

The previous Product/Dòng Admin candidate was not approved. A new review candidate now optimizes three real staff jobs:

1. search/manage Product;
2. create Product through Product → SKU → optional Dòng → publish;
3. create/manage Dòng through a visual Trục/Lựa chọn builder with direct PDP preview.

Current review nodes are documented in `docs/internal/v1-admin-product-line-redesign-review.md`.

## 4. M1 impact

### LEO-560 — raw legacy source

**Impact: compatible.**

Raw/reference clone remains migration evidence only.

### LEO-561 — canonical schema

**Impact: direct schema conflict, additive correction required after freeze.**

Current baseline has:

- `product_families`;
- `product_family_configuration_groups`;
- `product_family_memberships` with optional `configuration_group_id`;
- `products.sku` as one unique SKU per Product;
- `product_family_navigation_eligibility` based on Product-member count.

Required amendment:

- retain or evolve `product_families` as Dòng records;
- replace fixed Configuration Group navigation with 1–3 Axis definitions + dependent Options;
- add explicit exact sellable SKU records so one Product may own multiple SKUs;
- support nullable SKU-specific pricing/availability fields with Product fallback;
- support SKU-specific media references/mappings with Product-media fallback;
- map Option paths to Product and/or exact SKU;
- replace public selector eligibility with valid selectable terminal-path eligibility;
- preserve max-one-Dòng-per-Product constraint.

Historical LEO-561 migration must not be rewritten. Use a new additive/corrective migration after global freeze.

### LEO-562 — deterministic import/publish-quality pipeline

**Impact: importer mapping must be amended.**

Keep deterministic replay, provenance, quarantine and no-inference rules.

Replace old Family/group membership import mapping with explicit curation/import of:

- Dòng identity;
- Axis definitions;
- dependent Options/valid paths;
- canonical Product membership;
- exact sellable SKU records;
- Product/SKU terminal targets;
- explicit Product-default vs SKU-specific commerce/media values when supported by evidence.

Ambiguous axis/option/product/SKU mappings or ambiguous override ownership must be quarantined instead of guessed.

## 5. M2 impact

### LEO-563 — Public/Admin app + CI Preview foundation

**Impact: compatible.**

No platform/app topology change.

### LEO-564 — Auth/RLS/services

**Impact: service/RLS extension required; security architecture unchanged.**

Current M2 applies attribution/RLS/service logic to old Family tables. After freeze, the new Dòng/Axis/Option/SKU tables require equivalent least-privilege RLS, attribution, idempotent Admin mutation services and reviewed Public projections.

Guest/staff services must resolve authoritative commerce from the selected Product + exact SKU. Effective values use SKU-specific data when present, otherwise Product fallback. Client-provided price/status/media source is never authority.

Order/Quote snapshot architecture remains valid because historical lines preserve resolved commercial state and Product/SKU identity.

### LEO-565 — media + backup/recovery

**Impact: additive mapping/manifest amendment required; provider architecture unchanged.**

Keep Bunny object authority, immutable media, product image profile and encrypted backup/restore system.

Add:

- SKU-specific media mapping where a selected SKU changes gallery/media;
- deterministic Product-media fallback when the SKU has no media mapping;
- Dòng/Axis/Option/SKU tables and SKU override fields/mappings to backup manifest and semantic restore validation;
- remove old Family-group tables from future runtime authority once migration is complete, while preserving historical migration evidence.

## 6. Commerce implications — resolved

The new model strengthens rather than breaks Order/Quote history.

Locked rules:

- Product provides default price/sale/online-discount, availability and media;
- SKU may provide its own values;
- missing SKU value falls back to Product;
- Product-target selection may change PDP;
- SKU-target selection does not change canonical PDP;
- Cart/Quote/Order must preserve exact selected Product + SKU;
- server resolves and snapshots the **effective** commercial values at the relevant boundary;
- historical snapshots remain immutable after Product/SKU changes.

There is no longer an unresolved architecture question about whether SKU may own price/status/media. It may, with Product fallback when absent.

## 7. Public/Admin wireframe impact

### Public

- MS885 visually expresses dependent axes: seat type → model.
- TBG10302 is `Bộ sản phẩm → Product → Màu → SKU`, with every terminal configuration backed by real Product/SKU data.
- SKU-only changes may update effective price, availability and gallery on the same PDP.
- `retailer_package` wording/semantics are removed.

### Admin

Current review candidate replaces the prior unapproved Product/Dòng flow.

Required mental model:

1. search/open Product quickly by name/model/SKU;
2. manage Product-level defaults;
3. manage one-or-more exact sellable SKUs and see `Kế thừa Sản phẩm` vs `Dùng giá trị riêng`;
4. optionally add the Product to one Dòng;
5. create/reorder 1–3 Trục and dependent Lựa chọn;
6. map each outcome to Product/SKU;
7. preview the exact Public PDP selector/effective state.

Current Figma review nodes: `1051:4`, `1051:196`, `1051:394`, `1051:549`, `1051:733`, `1051:909`, `1051:1066`, `1051:1231`.

## 8. Safe implementation sequence after global freeze

1. Freeze final Public/Admin wireframes and Axis/Option/SKU inheritance terminology.
2. Review exact schema delta against current `dpg_v1`.
3. Add new Product SKU + Dòng Axis/Option structures through additive migration.
4. Add Product-default / nullable SKU-override commerce and media contract.
5. Backfill only approved sample/curated data; do not infer ambiguous mappings.
6. Add RLS/service/public projection contracts.
7. Update deterministic importer.
8. Update media mapping and backup/restore manifests.
9. Update Search/Filter/Public PDP data access.
10. Update Cart/Quote/Order intake to resolve exact Product/SKU and effective values authoritatively.
11. Run isolated Preview migration and end-to-end acceptance before any Production activation.

## 9. Non-regression rules

Do not change:

- Public/Admin app separation;
- Supabase as canonical data authority;
- Bunny as media authority;
- Cloudflare delivery topology;
- one Product = one manufacturer model = one canonical PDP;
- one Product belongs to at most one Dòng;
- no standalone Dòng route;
- no fabricated Product/SKU records;
- deterministic provenance/quarantine;
- immutable Quote/Order snapshots;
- global coding gate.

## 10. Gate

This audit and ADR update are design/architecture documentation only. They do not authorize schema/application implementation.

Implementation remains blocked until the Owner says exactly:

`V1 WIREFRAME APPROVED / FROZEN`
