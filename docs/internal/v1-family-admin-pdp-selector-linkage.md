# V1 Family Admin ↔ Public PDP Selector — Implementation Handoff

**Status:** Admin wireframe clarification prepared and strict-QA reviewed; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Admin page:** `02 — ADMIN — Operational Wireframes` (`31:11`)  
**Public authority:** approved PDP sections `04` / `05`

> [!IMPORTANT]
> This file does not authorize implementation. Coding starts only after the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Purpose

This handoff closes the operational gap between Catalogue Admin and the already-approved Public PDP Family Selector.

The critical rule is:

**Product Family membership is not the Public selector card.**

Public selector choices are created by explicit ordered **Configurations** under the Family.

Canonical chain:

**Product membership → Family → optional Configuration Group → Configuration → target → optional Colour → Public PDP Family Selector**

## 2. Figma Admin authority

### A09 — Product Create / Edit / Detail

Node: `31:741`

A09 now exposes:

- canonical Product `TBG10302VA`;
- explicit Family membership `TBG10302` / `toto:tbg10302`;
- readiness item for `Family / selector mapping`;
- `Preview PDP`;
- Public selector linkage panel showing that membership alone does not create a selector card;
- action to manage the Family selector in A10.

Operational meaning:

- staff may assign/remove Product Family membership here;
- that assignment is catalogue membership only;
- a Public selector choice exists only when an A10 Configuration explicitly targets the Product and is public/selectable.

### A09B — Product Sellable Options / Colours

Node: `930:11`

A09B is Product-owned sellable colour/finish management for the selected `manufacturer_product` Configuration.

Current fixture:

- Family: `TBG10302`;
- Configuration: `01 · Không gồm tay sen`;
- target kind: `manufacturer_product`;
- target: `TBG10302VA`;
- colours: Chrome / Đen mờ;
- exact sellable SKU, price, sale price, online discount, availability and media mapping remain option-level commerce truth.

A09B must not be reused as the package-colour editor for a `retailer_package` Configuration.

### A10 — Family Management

Node: `31:761`

A10 is the operational authority for the Public Family Selector structure.

It exposes separately:

1. Family membership.
2. Optional Configuration Groups.
3. Ordered Configurations / selector cards.
4. Configuration target kind + target.
5. `selector_label`.
6. thumbnail.
7. public/selectable state.
8. group assignment (`None/direct` for the current TBG10302 fixture).
9. optional colour mapping.
10. Public PDP preview.

The inline `PDP Family Selector card preview` (`959:2`) visually proves which card the selected Configuration will render on Public.

## 3. Public PDP authority

Admin must produce the already-approved Public behavior; Public must not be redesigned from Admin implementation convenience.

Relevant approved Desktop states:

- `717:2` — TBG10302 base manufacturer Configuration / Chrome.
- `717:182` — same Product/Configuration / Đen mờ.
- `717:362` — retailer package `Bộ tay sen 108ZR`.
- `717:542` — manufacturer Configuration navigating to another Product/PDP.

Relevant mobile states are in approved section `05 — PDP MOBILE — APPROVED FAMILY SYSTEM`.

## 4. Data/behavior mapping

### Family membership

Membership answers only:

> Which canonical manufacturer Products belong to this Family?

Membership must not contain selector display semantics such as selector label/order/thumbnail after the unified Configuration model exists.

### Configuration

Configuration is the exact Public selector card.

Required runtime fields:

- stable ID;
- `family_id`;
- nullable `configuration_group_id`;
- `target_kind`;
- target FK;
- `selector_label`;
- thumbnail;
- deterministic order;
- public state;
- selectable state;
- effective/display price or contact-price state derived from the target commerce contract.

Only public/selectable Configurations appear in the Public Family Selector.

### `manufacturer_product` target

- points to one canonical Product/PDP;
- selecting another manufacturer Product Configuration navigates to that Product's canonical PDP;
- Product owns Brand/model/category/spec/docs/default commerce truth;
- Product colour/sellable options are managed in Product scope (A09B).

### `retailer_package` target

- package is a Configuration target, not a manufacturer Product;
- package components reference canonical Products;
- component references do not become Family members;
- package creates no standalone manufacturer Product/PDP/SEO identity;
- package price remains server-derived from canonical component commerce data unless a future explicit package-discount rule is approved;
- any package-level colour mapping must be explicit for that package/Configuration and must never be inferred automatically from component colours.

## 5. Admin validation/readiness rules

A Configuration must not become Public/selectable if any required selector dependency is unresolved.

At minimum validate:

- valid Family;
- valid optional group belonging to the same Family;
- valid target according to `target_kind`;
- target compatibility with the Family;
- non-empty `selector_label`;
- deterministic ordering;
- usable selector thumbnail;
- valid public/selectable state;
- target commerce/display-price state resolvable;
- manufacturer Product colour options valid when applicable;
- package component identity complete;
- package colour mapping explicit when package colour is exposed.

## 6. Implementation invariants for Codex

1. Do not render selector cards from `product_family_memberships` directly.
2. Do not make assigning a Product to a Family automatically publish a selector choice.
3. Runtime Family Selector reads the unified Configuration model.
4. Do not duplicate Product business truth into Configuration.
5. Do not make `retailer_package` a Product.
6. Do not promote package components to Family members.
7. Do not infer package colours from component colours.
8. Do not use A09B Product colour records as package colour records.
9. Do not create separate Desktop/Mobile business models; both Public PDP presentations read the same selector contract.
10. Do not change approved Public PDP behavior to simplify Admin implementation.

## 7. Acceptance tests after global freeze

Implementation must prove:

- assigning Product membership without a Configuration creates no Public selector card;
- a public/selectable manufacturer Configuration renders one selector card and routes to its canonical Product/PDP;
- an inactive/non-selectable Configuration is excluded from Public;
- Configuration Group assignment determines the correct Public tab/group where groups exist;
- reorder in Admin deterministically changes selector order;
- selector label and thumbnail map to the Public model card;
- manufacturer Product colour change keeps the same canonical PDP while changing exact sellable SKU/media/commerce state;
- retailer package renders through the same selector-card UI without becoming a Product;
- package components remain component references only;
- package colour appears only when explicitly mapped;
- Retail Cart and Quote snapshots preserve the exact selected Product/colour/package identity.

## 8. Related authority

Read together with:

- `docs/internal/v1-pdp-family-system-implementation-handoff.md`
- `docs/internal/v1-admin-operations-implementation-handoff.md`
- `docs/adr/0017-v1-pdp-family-system-and-retailer-packages.md`
- `docs/adr/0020-v1-product-pricing-contract.md`
- final approved Figma PDP + Admin frames.
