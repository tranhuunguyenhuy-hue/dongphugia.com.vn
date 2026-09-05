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

### LEO-559 — Admin/Auth boundary

**Impact: compatible.**

Separate Public/Admin apps, fixed roles, RLS, direct authorized publishing and generic `catalogue.*` capabilities remain valid. No role model redesign is required.

### LEO-579 — wireframes

**Impact: requires synchronized Public semantic + Admin UX update.**

Public PDP visual patterns can largely remain, but the data semantics must change from Configuration Group/Configuration/Colour/retailer_package to Dòng → Trục → Lựa chọn → Product/SKU.

Admin Product/Dòng management must be redesigned around the same Axis/Option mental model.

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
- Product/SKU terminal targets.

Ambiguous axis/option/product/SKU mappings must be quarantined instead of guessed.

## 5. M2 impact

### LEO-563 — Public/Admin app + CI Preview foundation

**Impact: compatible.**

No platform/app topology change.

### LEO-564 — Auth/RLS/services

**Impact: service/RLS extension required; security architecture unchanged.**

Current M2 applies attribution/RLS/service logic to old Family tables. After freeze, the new Dòng/Axis/Option/SKU tables require equivalent least-privilege RLS, attribution, idempotent Admin mutation services and reviewed Public projections.

Order/Quote snapshot architecture remains valid because line snapshots already store Product/SKU identity fields. Guest/staff services must resolve authoritative commerce from the selected exact SKU rather than trusting client input.

### LEO-565 — media + backup/recovery

**Impact: additive mapping/manifest amendment required; provider architecture unchanged.**

Keep Bunny object authority, immutable media, product image profile and encrypted backup/restore system.

Add:

- SKU-specific media mapping where a selected SKU changes gallery/media;
- Dòng/Axis/Option/SKU tables to backup manifest and semantic restore validation;
- remove old Family-group tables from future runtime authority once migration is complete, while preserving historical migration evidence.

## 6. Commerce implications

The new model strengthens rather than breaks Order/Quote history:

- Cart/Quote/Order must preserve exact selected Product + SKU;
- Product-target selection may change PDP;
- SKU-target selection does not change canonical PDP;
- historical snapshots remain immutable after Product/SKU changes.

A follow-up commerce clarification is required before implementation to define which price/availability/media fields are Product defaults versus SKU-specific overrides. This must be resolved in the final Product/SKU implementation handoff; it does not block the architectural feasibility of Axis/Option.

## 7. Public/Admin wireframe impact

### Public

- MS885 already visually expresses two dependent axes: seat type → model.
- TBG10302 should be reinterpreted as `Bộ sản phẩm → Màu`, with every terminal configuration backed by real Product/SKU data.
- `retailer_package` wording/semantics must be removed.
- Visual layout may stay substantially the same; annotations/contracts must change.

### Admin

Current Family editor is superseded.

Required mental model:

1. Product and exact sellable SKU management.
2. Optional membership in one Dòng sản phẩm.
3. Add/reorder 1–3 Trục lựa chọn.
4. Add dependent Lựa chọn under the selected parent path.
5. Map path outcome to Product/SKU.
6. Preview the resulting Public PDP selector.

No separate Colour subsystem should be presented as a special Family concept; `Màu` is one possible Axis label/semantic type.

## 8. Safe implementation sequence after global freeze

1. Freeze final Public/Admin wireframes and Axis/Option terminology.
2. Review exact schema delta against current `dpg_v1`.
3. Add new Product SKU + Dòng Axis/Option structures through additive migration.
4. Backfill only approved sample/curated data; do not infer ambiguous mappings.
5. Add RLS/service/public projection contracts.
6. Update deterministic importer.
7. Update media mapping and backup/restore manifests.
8. Update Search/Filter/Public PDP data access.
9. Update Cart/Quote/Order intake to resolve exact SKU authoritatively.
10. Run isolated Preview migration and end-to-end acceptance before any Production activation.

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
