---
status: accepted
implementation_gate: V1 WIREFRAME APPROVED / FROZEN
---

# Standardize V1 PDP Family System and allow retailer packages as Family Configurations

## Context

The original V1 architecture defined Family as Product-only related-model navigation and treated Product package/BOM structures as out of scope. PDP wireframing and a Production audit exposed a broader, recurring catalogue pattern:

- manufacturer model/configuration choices;
- optional Configuration Groups for large families;
- colour/finish SKUs that should remain on one PDP;
- retailer-created packages composed from canonical Products;
- legacy `variant_group` records that mix those concepts.

Keeping separate UI/data models for each pattern would make the catalogue difficult to scale and would preserve legacy ambiguity.

## Decision

V1 uses one standardized hierarchy:

**Family → optional Configuration Group → Configuration → optional Colour**

A Configuration target is exactly one of:

- `manufacturer_product`
- `retailer_package`

### Manufacturer Product

One manufacturer model remains one canonical Product and one canonical PDP. Selecting another manufacturer Configuration navigates to that Product's PDP.

### Colour

Colour/finish is a sellable option on the same Product/PDP. Selecting colour may change SKU, price, availability and gallery media, but it does not create another Product/PDP or independent SEO identity.

### Retailer package

A retailer-created package is a valid Configuration target. It is composed from canonical Products and is not a manufacturer Product. It uses the same Family-selector UI but retains package/component semantics in data and commerce snapshots.

### Configuration Group

Configuration Group is optional and exists only to organize large Families such as MS885 seat types. UI counts are derived from current public/selectable Configurations, not catalogue-expected models.

## Family membership vs Public selector Configuration

`product_family_membership` and Public Family-selector Configuration are related but **not the same concept**.

- Membership means a canonical manufacturer Product belongs to a Family for catalogue organization and validation.
- Membership alone must **not** render a Public PDP selector card.
- A Public selector card exists only when an explicit Configuration targets that Product/package and the Configuration is public/selectable.
- Runtime Family selector reads the ordered Configuration model, not the membership table directly.
- Package component references never become Family members merely because a `retailer_package` uses them.

This distinction is required so Admin cannot accidentally publish a selector choice merely by assigning a Product to a Family.

## Admin → Public selector operational contract

The canonical Admin Family editor must expose the fields that directly determine the approved PDP Family Selector:

- Family membership separately from selector Configurations;
- optional `configuration_group_id`;
- `selector_label`;
- `target_kind`;
- target Product/package;
- thumbnail;
- deterministic ordering/reorder behavior;
- public state;
- selectable state;
- a Public PDP selector preview/linkage that makes the resulting selector card understandable before publish.

For a `manufacturer_product` target, Product sellable colour options remain Product-owned and may be managed through the Product colour/sellable-option UI.

For a `retailer_package` target, any package-level colour choice must be **explicitly mapped** for that package/Configuration. Do not infer package colours automatically from component Product colours. A package colour mapping must never be implemented by reusing another Product's colour editor as if the package were that Product.

## Schema consequences

After the global V1 wireframe freeze, schema work must add a unified Configuration entity that can target Product or retailer package, plus canonical colour/sellable options and retailer package composition. Product media must support colour-option mapping. Product identifier aliases are required for manufacturer/legacy code lineages without duplicating Products.

The detailed implementation contract is:

`docs/internal/v1-pdp-family-system-implementation-handoff.md`

Admin-specific mapping is additionally documented in:

`docs/internal/v1-family-admin-pdp-selector-linkage.md`

## Superseded clauses from ADR 0016

For this scope, ADR 0016 is superseded where it states or implies that:

- Family runtime membership can only point directly to Product;
- all package/BOM concepts are categorically out of V1;
- colour SKU differences should require separate Product/PDP identity;
- legacy Product package structures can simply be deprecated without a canonical replacement where approved retailer-package Configurations require them.

The following ADR 0016 principles remain valid:

- one manufacturer model = one Product = one canonical PDP;
- no fabricated Products for missing models;
- Family owns no independent Product SEO/price authority;
- legacy `variant_group`, `variant_options`, `is_master` and similar fields are migration evidence only;
- ambiguous manufacturer facts are quarantined rather than guessed.

## Production migration rule

Do not copy legacy variant groups directly. Migration must first resolve manufacturer identity, then normalize:

- Family;
- optional Configuration Group;
- Configuration target kind;
- Colour options;
- retailer-package components;
- media and pricing for the selected sellable option.

Known invalid multi-brand group `26900` is a hard-reject fixture.

## Implementation gate

This ADR records an Owner-approved design/architecture decision but does not authorize coding yet.

No implementation may begin until the Owner explicitly says:

**`V1 WIREFRAME APPROVED / FROZEN`**
