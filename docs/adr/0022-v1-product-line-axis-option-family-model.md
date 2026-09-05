---
status: accepted
implementation_gate: V1 WIREFRAME APPROVED / FROZEN
supersedes: ADR 0017 family/configuration/retailer-package model
---

# V1 Product Line / Axis / Option Family Model

## Decision

Owner-approved terminology: **Family = Dòng sản phẩm** in user-facing Admin/UI.

V1 has two catalogue cases:

1. **Standalone Product** — a canonical Product/PDP that does not belong to a Dòng sản phẩm.
2. **Product in a Dòng sản phẩm** — a canonical Product/PDP that participates in one ordered, dependent selection tree.

A Product may belong to **zero or one** Dòng sản phẩm.

A Dòng sản phẩm is navigation/selection structure only. It owns no price, SKU, availability, inventory, SEO identity or standalone Public route.

## Canonical selection model

A Dòng sản phẩm defines **1 to 3 ordered Axes**. Each Axis has:

- a custom user-facing label, e.g. `Loại nắp`, `Model`, `Bộ sản phẩm`, `Màu`, `Kích thước`;
- optional semantic type for consistency/analytics;
- deterministic order.

Each Axis contains Options. Options are dependent on the previously selected Option, so the system represents only valid paths; it must not generate a Cartesian combination matrix.

Canonical flow:

`Dòng sản phẩm → Trục 1 → Lựa chọn → [Trục 2 → Lựa chọn] → [Trục 3 → Lựa chọn] → Product and/or exact sellable SKU`

A later Axis appears only when valid for the current path.

## Product and SKU identity

One manufacturer model remains one canonical Product and one canonical PDP.

A selection path may:

- resolve to another Product: Public navigates to that Product's canonical PDP/URL;
- keep the same Product and resolve to another exact sellable SKU: Public stays on the same PDP/URL while SKU/price/availability/media may change.

Therefore Product identity and exact sellable SKU identity are distinct concepts in V1. A Product may have one or more sellable SKUs.

Examples:

### TOTO MS885

`Dòng MS885 → Trục Loại nắp → Nắp điện tử → Trục Model → WASHLET S7 → Product MS885DW11 → exact SKU`

### TOTO TBG10302

`Dòng TBG10302 → Trục Bộ sản phẩm → Bộ tay sen 108ZR → canonical Product for that sellable configuration → Trục Màu → Đen mờ → exact SKU`

Every final sellable configuration must be backed by a real canonical Product/SKU record. V1 no longer needs a Family-selector-specific `retailer_package` target for these choices.

## Public eligibility

A Dòng sản phẩm becomes a meaningful Public selector when it has at least two valid selectable terminal paths. Eligibility is **not** defined as “at least two Product members”, because a valid Dòng may differentiate multiple SKUs of one Product.

## Admin mental model

Admin should manage the same structure the customer sees:

- Product identity/PDP;
- exact sellable SKU records;
- optional Dòng sản phẩm membership;
- ordered Trục → Lựa chọn tree;
- target mapping to Product/SKU;
- Public preview of the resulting selector.

Do not expose legacy schema terms such as Configuration Group / Configuration as the primary staff mental model.

## M0/M1/M2 compatibility and required amendments

The platform architecture remains valid, but the historical M0/M1 Family representation is superseded.

Keep:

- Supabase `dpg_v1` as canonical authority;
- one manufacturer model = one Product = one canonical PDP;
- zero/one Dòng per Product;
- no standalone Dòng public route;
- Product/Order/Quote canonical snapshot and idempotency rules;
- separate Public/Admin app boundaries;
- fixed staff roles/capability model;
- Bunny media authority and backup/recovery architecture;
- deterministic import/provenance/quarantine rules.

Supersede after global wireframe freeze through additive/corrective migrations and service updates:

- fixed `product_family_configuration_groups` as the Family navigation model;
- membership/group sort order as the Public selector source;
- `product_family_navigation_eligibility` based on Product count;
- one-SKU-per-Product assumption represented by `products.sku` as the only sellable identity;
- Family-selector `Configuration` / `retailer_package` target model from ADR 0017;
- any Public/Admin service, backup manifest, import mapping or test that hard-codes those obsolete Family tables as the final runtime contract.

Historical migrations remain immutable evidence. Do not rewrite or delete completed M1/M2 migrations. Implement the new model additively after the global implementation gate.

## Required post-freeze implementation shape

Exact SQL/table names are intentionally deferred until implementation review, but the domain must support:

- Dòng sản phẩm records;
- Product membership with max one Dòng per Product;
- 1–3 ordered Axis definitions per Dòng;
- dependent Option nodes / valid parent-child paths;
- optional semantic type per Axis;
- exact target resolution to Product and/or sellable SKU;
- one-to-many sellable SKUs per Product;
- optional SKU-specific price/availability/media where approved by the final Product/SKU commerce contract;
- deterministic Public selector projection;
- exact selected Product/SKU snapshots in Cart/Quote/Order.

## Migration safety

At the time of this decision, isolated Preview `dongphugia-runtime` contains the M1/M2 `dpg_v1` schema but no canonical Product/Family catalogue rows. This materially lowers data-migration risk: the architecture can be amended before catalogue rollout instead of transforming live V1 catalogue data.

## Implementation gate

This ADR records the approved architecture only. It does **not** authorize schema/application coding.

No implementation begins until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
