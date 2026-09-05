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

This handoff defines the final Admin operating model for the already-approved Public PDP Family Selector.

The critical distinction remains:

**Product Family membership is not the Public selector card.**

Public selector choices are explicit ordered Configurations under a Family.

Canonical data chain:

**Product membership → Family → optional Configuration Group → Configuration → target → optional Colour → Public PDP Family Selector**

Canonical staff flow is intentionally simpler than the schema:

**Product → optional Family → selector cards that look like PDP → edit selected card → preview PDP**.

## 2. Public PDP authority

Admin must produce the already-approved Public behavior; Public must not be redesigned for Admin implementation convenience.

Relevant approved Desktop states:

- `717:2` — TBG10302 base manufacturer Configuration / Chrome.
- `717:182` — same Product/Configuration / Đen mờ.
- `717:362` — retailer package `Bộ tay sen 108ZR`.
- `717:542` — manufacturer Configuration navigating to another Product/PDP.

Relevant mobile states are in approved section `05 — PDP MOBILE — APPROVED FAMILY SYSTEM`.

The Admin selector-card rail in A10 is deliberately shaped to resemble the Public `Bộ sản phẩm` selector so staff edits the object they actually expect customers to see.

## 3. Figma Admin authority

### A09 — Product with Family

Node: `31:741`

A09 shows the Product-centered view:

- current Family;
- current PDP selector choice targeting this Product;
- Product colour/SKU summary;
- direct actions into Family and colour management.

Family and selector mapping are visible in a compact `Cấu trúc hiển thị trên PDP` card rather than exposed as normalized database concepts.

### A09B — Product colour/SKU sub-flow

Node: `930:11`

A09B is Product-owned sellable colour/finish management for a manufacturer Product.

Current fixture:

- Family: `TBG10302`;
- Configuration: `Không gồm tay sen`;
- target: `TBG10302VA`;
- colours: Chrome / Đen mờ.

Changing colour keeps one canonical Product/PDP while selecting exact sellable SKU, price, availability and media.

A09B must not be reused as a retailer-package colour editor.

### A09C — Product without Family

Node: `1015:2`

A09C proves Family is optional.

A Product with no Family remains a valid canonical Product/PDP.

If staff decides the Product belongs in a Family selector, the UI offers two explicit actions:

1. `Tạo nhóm từ Sản phẩm này` → A10B.
2. `Thêm vào nhóm có sẵn`.

No implicit Family or selector Configuration is created merely because the Product exists.

### A10 — Family / PDP Selector editor

Node: `31:761`

A10 is the operational authority for selector composition.

Its primary section is an ordered rail of cards that visually mirrors the Public PDP selector. Each Admin card corresponds to exactly one Public selector Configuration.

Staff can:

- inspect cards in Public order;
- reorder cards;
- select a card;
- edit the selected card;
- add a manufacturer Product or retailer package choice;
- preview Public PDP.

Selected-card business fields:

- display label;
- choice type;
- target Product/package;
- selector thumbnail;
- optional colour mapping;
- optional selector group;
- Public state;
- Selectable state.

Family membership is displayed in a separate panel below. Optional Configuration Groups are progressive disclosure and remain off for simple Families such as TBG10302.

### A10B — guided Family creation from Product

Node: `1012:85`

A10B optimizes the most common create path without collapsing domain semantics.

One compact flow performs three explicit operations:

1. create Family identity;
2. add the current Product as first member;
3. create the first selector Configuration targeting that Product.

The user sees a preview of the first selector card before finishing. After creation, the flow lands in A10 for additional choices/reordering.

Even if one backend transaction persists all three operations, membership and selector Configuration remain different relationships.

## 4. Data/behavior mapping

### Family membership

Membership answers only:

> Which canonical manufacturer Products belong to this Family?

Membership must not own selector label/order/thumbnail/public state.

Membership alone must not render a Public selector card.

### Configuration

Configuration is the exact Public selector card.

Runtime fields include:

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
- target-derived effective/display price or contact-price state.

Only public/selectable Configurations appear in the Public Family Selector.

### `manufacturer_product` target

- points to one canonical Product/PDP;
- selecting another manufacturer Product Configuration navigates to that Product's canonical PDP;
- Product owns model identity and default commerce truth;
- Product colour/sellable options are managed in Product scope through A09B.

### `retailer_package` target

- package is a Configuration target, not a manufacturer Product;
- package components reference canonical Products;
- component references do not become Family members;
- package creates no standalone manufacturer Product/PDP/SEO identity;
- package price remains server-derived from canonical component commerce data unless a future explicit package-discount rule is approved;
- package-level colour mapping must be explicit and must never be inferred automatically from component colours.

## 5. Why the Admin flow is PDP-first

The previous table-first Family editor exposed internal concepts before showing what they produced. The final flow reverses that order:

1. show the same selector-card mental model customers see;
2. let staff select/reorder/add a card;
3. edit the selected card's details;
4. keep membership and optional grouping secondary;
5. preview Public PDP.

This is a UX decision only; the normalized Family/Configuration architecture remains unchanged.

## 6. Admin validation/readiness rules

A Configuration must not become Public/selectable if any required selector dependency is unresolved.

Validate at minimum:

- valid Family;
- valid optional group belonging to same Family;
- valid target according to `target_kind`;
- target compatibility with Family;
- non-empty selector label;
- deterministic ordering;
- usable thumbnail;
- valid public/selectable state;
- target commerce/display-price state resolvable;
- manufacturer Product colour options valid when applicable;
- package component identity complete;
- package colour mapping explicit when package colour is exposed.

Family itself is optional for Products that do not need selector navigation.

## 7. Implementation invariants for Codex

1. Do not render selector cards from Product-Family membership directly.
2. Do not make assigning a Product to a Family automatically publish a selector choice.
3. Runtime Family Selector reads the unified Configuration model.
4. A10B may submit Family + membership + first Configuration together, but backend/domain logic must preserve them as separate relationships.
5. Do not duplicate Product business truth into Configuration.
6. Do not make `retailer_package` a Product.
7. Do not promote package components to Family members.
8. Do not infer package colours from component colours.
9. Do not use A09B Product colour records as package colour records.
10. Do not change approved Public PDP behavior to simplify Admin implementation.
11. Do not restore Category/Brand/Spec-Filter management as a prerequisite for Family/PDP implementation; those Admin modules are out of V1.

## 8. Acceptance tests after global freeze

Implementation must prove:

- Product without Family remains valid and no selector rail is fabricated;
- assigning membership without a Configuration creates no Public selector card;
- A10B creates Family membership and first Configuration separately while presenting one guided user flow;
- a public/selectable manufacturer Configuration renders one selector card and routes to its canonical Product/PDP;
- inactive/non-selectable Configuration is excluded from Public;
- optional Configuration Group assignment controls the correct Public group/tab where groups exist;
- reorder in A10 deterministically changes Public selector order;
- selector label and thumbnail map to the Public model card;
- manufacturer Product colour change keeps the same canonical PDP while changing exact SKU/media/commerce state;
- retailer package renders through the same selector-card UI without becoming a Product;
- package components remain component references only;
- package colour appears only when explicitly mapped;
- Retail Cart and Quote snapshots preserve exact selected Product/colour/package identity.

## 9. Related authority

Read together with:

- `docs/internal/v1-pdp-family-system-implementation-handoff.md`
- `docs/internal/v1-admin-operations-implementation-handoff.md`
- `docs/adr/0017-v1-pdp-family-system-and-retailer-packages.md`
- `docs/adr/0020-v1-product-pricing-contract.md`
- final approved Figma PDP + Admin frames.