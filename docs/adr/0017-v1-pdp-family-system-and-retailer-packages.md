---
status: superseded
superseded_by: ADR 0022
implementation_gate: V1 WIREFRAME APPROVED / FROZEN
---

# Standardize V1 PDP Family System and allow retailer packages as Family Configurations

> **SUPERSEDED — 05/09/2026.** Owner has replaced this `Family → optional Configuration Group → Configuration → optional Colour` / `retailer_package` model with ADR 0022: **Dòng sản phẩm → 1–3 ordered dependent Axes → Options → canonical Product and/or exact sellable SKU**. Keep this file as historical design evidence only. Do not implement its Configuration/retailer-package schema.

## Context

The original V1 architecture defined Family as Product-only related-model navigation and treated Product package/BOM structures as out of scope. PDP wireframing and a Production audit exposed a broader, recurring catalogue pattern:

- manufacturer model/configuration choices;
- optional Configuration Groups for large families;
- colour/finish SKUs that should remain on one PDP;
- retailer-created packages composed from canonical Products;
- legacy `variant_group` records that mix those concepts.

Keeping separate UI/data models for each pattern would make the catalogue difficult to scale and would preserve legacy ambiguity.

## Historical decision

ADR 0017 previously defined:

**Family → optional Configuration Group → Configuration → optional Colour**

with Configuration targets `manufacturer_product` or `retailer_package`.

That decision is no longer current authority.

## What remains valid

The following principles survive into ADR 0022:

- one manufacturer model = one canonical Product = one canonical PDP;
- a Product may belong to at most one Family/Dòng sản phẩm;
- Family/Dòng owns no independent Product SEO/price/availability authority and has no standalone public route;
- colour/SKU-only switching may remain on the same canonical PDP;
- legacy `variant_group`, `variant_options`, `is_master` and similar fields are migration evidence only;
- ambiguous manufacturer facts are quarantined rather than guessed;
- missing manufacturer Products/SKUs are never fabricated.

## What is superseded

Do not implement from this ADR:

- `Configuration Group` as the standardized Family navigation abstraction;
- `Configuration` as the public selector-card entity;
- `retailer_package` as a Family selector target;
- Family membership vs Configuration as separate staff-facing workflow concepts;
- Colour as a special Family layer outside the generic selection-axis system.

Current authority is:

`docs/adr/0022-v1-product-line-axis-option-family-model.md`

and the synchronized impact audit:

`docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`

## Historical migration note

Do not rewrite historical M1/M2 migrations created under ADR 0016/0017-era assumptions. After global wireframe freeze, use additive/corrective migrations and service updates to introduce the ADR 0022 model.

## Implementation gate

No implementation may begin until the Owner explicitly says:

**`V1 WIREFRAME APPROVED / FROZEN`**
