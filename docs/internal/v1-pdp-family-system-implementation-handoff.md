# V1 PDP + Family System — Implementation Handoff

**Status:** Owner-approved design contract; implementation blocked until global wireframe freeze  
**Owner approval date:** 2026-09-04  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma file:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes`  
**Figma file key:** `LbiwIXMaip9LJ5jIauMNof`

> [!IMPORTANT]
> Do **not** implement this document yet. Coding may start only after the Owner explicitly says:
> **`V1 WIREFRAME APPROVED / FROZEN`**.
>
> Until that exact global approval exists, this document is a durable implementation handoff and architecture input only.

## 1. Purpose

This document is the canonical implementation handoff for the approved V1 Product Detail Page (PDP) and Product Family experience. It captures the decisions that must survive the design-to-code handoff so Codex does not infer behavior from legacy Production variant fields, old UI, or stale architecture notes.

The approved system must support, with one reusable UI/data contract:

1. Manufacturer model families such as TOTO `MS885`.
2. Manufacturer configuration families such as `TBW0740`.
3. A Product with multiple sellable colours/finishes on one PDP.
4. Retailer-created packages such as `TBG10302VA + DGH108ZR` as a valid Family Configuration target.
5. Large families with optional Configuration Groups.
6. Desktop and mobile parity.

This document intentionally separates **manufacturer Product identity**, **Family navigation**, **sellable colour options**, and **retailer packages**. Legacy Production often mixes those concepts under one `variant_group`; V1 must not.

## 2. Authority and conflict rules

For this scope, authority order is:

1. Owner's newest explicit decisions.
2. Approved Figma PDP sections/screens listed below.
3. This implementation handoff.
4. ADR `0017-v1-pdp-family-system-and-retailer-packages.md`.
5. Existing canonical V1 schema/ADR where not superseded.
6. Linear implementation issues after they are updated from this contract.
7. Production legacy data only as migration evidence.

If an older document says that all package/BOM concepts are OUT V1, that Family can only contain Product memberships, or that every colour SKU must become a Product/PDP, that older statement is superseded for this scope.

The invariant **one manufacturer model = one Product = one canonical PDP** remains valid. Colour/finish sellable options do not create a new Product/PDP. A `retailer_package` is not a manufacturer Product.

## 3. Approved Figma authority

### 3.1 Desktop

Section: **`04 — PDP DESKTOP — APPROVED FAMILY SYSTEM`** (`741:2`)

Approved states:

| Node | Screen | Purpose |
| --- | --- | --- |
| `577:2` | D08A — MS885DT8 / Product Info | Main manufacturer Product PDP + Family selector |
| `577:217` | D08B — Family selector / Nắp điện tử | Configuration Group interaction |
| `666:2` | D08C — Trong hộp bao gồm | Included-items tab |
| `680:90` | D08D — Thông số kỹ thuật | Technical specs tab |
| `680:318` | D08E — Tài liệu kỹ thuật | Technical documents tab |
| `717:2` | D09S-A — TBG10302 / Không gồm tay sen / Chrome | Base Configuration + colour |
| `717:182` | D09S-B — TBG10302 / Đen mờ | Same Configuration/PDP, different colour option |
| `717:362` | D09S-C — TBG10302 / Bộ tay sen 108ZR | `retailer_package` Configuration target |
| `717:542` | D09S-D — TBW0740 | Manufacturer Configuration → another Product/PDP |

Supporting approved design/data material inside the same section:

- `717:842` — **SPEC — FAMILY SYSTEM V1 — Standardized**
- `736:2` — **AUDIT — FAMILY SYSTEM · Production Mapping Readiness**
- `649:3` — **SPEC — PDP Family Selector · V1 Data Contract + Import Mapping**

### 3.2 Mobile

Section: **`05 — PDP MOBILE — APPROVED FAMILY SYSTEM`** (`744:2`)

Approved states:

| Node | Screen | Purpose |
| --- | --- | --- |
| `744:3` | M08A — MS885DT8 / Product Info | Main mobile PDP |
| `752:2` | M08B — MS885 / Nắp điện tử | Mobile Configuration Group interaction |
| `752:135` | M09A — TBG10302 / Chrome | Base Configuration + colour |
| `754:2` | M09B — TBG10302 / Đen mờ | Same PDP, different colour |
| `754:140` | M09C — TBG10302 / Bộ tay sen 108ZR | Mobile retailer package state |
| `754:284` | M09D — TBW0740 | Mobile manufacturer Configuration state |

Do not re-interpret old/rejected D09 explorations as current authority.

## 4. Canonical Family System

The reusable V1 hierarchy is:

**Family → optional Configuration Group → Configuration → optional Colour**

### 4.1 Family

A Family groups closely related commercial choices that users reasonably compare from one PDP context.

A Family itself has:

- no standalone public Family page;
- no price;
- no availability;
- no independent SEO Product identity;
- no generated/fabricated Product members.

### 4.2 Configuration Group — optional

Configuration Group exists only to organize a large Family.

Example `MS885`:

- Nắp đóng êm
- Nắp rửa cơ
- Nắp điện tử

Rules:

- Do not create a group if there is only one meaningful group.
- Tab/group count is **derived from current public/selectable Configurations**, not from the number of models expected in a manufacturer catalogue.
- Catalogue gaps are import/curation evidence only and must not inflate UI counts.

### 4.3 Configuration — the selectable Family card

Configuration is the canonical selectable card in the Family selector.

A Configuration target has exactly one of two kinds:

- `manufacturer_product`
- `retailer_package`

The same UI component renders both kinds. The data/commerce semantics differ behind the UI.

Each Configuration needs at minimum:

- stable configuration ID;
- `family_id`;
- optional `configuration_group_id`;
- `target_kind`;
- target FK (`product_id` or `retailer_package_id`);
- `selector_label`;
- thumbnail;
- effective/display price or contact-price state;
- deterministic `sort_order`;
- public/selectable state.

### 4.4 Manufacturer Product target

A manufacturer Configuration points to a canonical Product.

Rules:

- one manufacturer model = one Product = one canonical PDP;
- selecting a different manufacturer Configuration navigates to that Product's PDP;
- Product owns canonical model identity, Brand, primary Category, PDP slug, specs, docs and default commerce state;
- Configuration only organizes/navigation; it must not duplicate Product business truth.

Examples:

- MS885 seat/model choices;
- TBW07401A `Có vòi xả bồn` ↔ TBW07402A `Không vòi xả bồn`;
- TBW07003A `Gắn tường` ↔ TBW07003A1 `Gắn trần` after legacy normalization.

### 4.5 Retailer package target

`retailer_package` is an approved V1 Configuration target.

It represents a bundle assembled by Đông Phú Gia from canonical Products, for example:

- base mixer `TBG10302VA`;
- hand shower `DGH108ZR`;
- any other explicitly included canonical Product components.

Rules:

- package must never masquerade as a manufacturer model;
- package components do not automatically become Family members;
- package composition must reference canonical Product/component IDs, not only free-text labels or slash-concatenated legacy SKUs;
- no independent manufacturer Product record is created for the package;
- no independent Product SEO identity is created for the package;
- UI uses the same Family Configuration card as manufacturer targets;
- a shareable selected-package state may exist, but canonical Product SEO remains with the manufacturer Product context;
- retailer package pricing is server-derived from canonical component commerce data unless a future explicit package-discount rule is approved. V1 must not silently import arbitrary legacy combo prices as a new pricing engine.

## 5. Colour/finish rule

Owner decision:

> **Colour stays on the same PDP. Do not create a separate PDP for each colour.**

Colour is an optional sellable option under the selected manufacturer Configuration/Product (or package where explicitly supported).

When the user changes colour:

- canonical Product/PDP identity remains the same;
- selected sellable SKU changes;
- displayed price may change;
- sale price may change;
- online discount amount may change;
- availability may change;
- gallery must move to/show media mapped to that colour;
- Add to Cart must submit the exact selected sellable SKU/option;
- Quote snapshots must capture the selected SKU/colour;
- search may match alternate colour SKUs but route to the canonical Product PDP, optionally with selected-colour state;
- colour does not create another Product or standalone SEO page.

A published/selectable colour option must have deterministic colour identity and enough media/commerce data to avoid a misleading selector.

## 6. Family selector UI contract

D08 is the visual/component authority.

### 6.1 Configuration Group tabs

Use only when meaningful.

Approved visual language:

- one continuous tab bar;
- active surface is white, visually connected to the bar;
- active underline;
- inactive tabs are text on the common background;
- horizontal overflow/scroll is allowed on mobile where necessary.

### 6.2 Configuration model cards

All PDP domains reuse the same card anatomy:

- thumbnail;
- `selector_label`;
- SKU for manufacturer Product, or clear package target identity for retailer package;
- effective price / `Liên hệ giá`;
- current-state badge `✓`;
- horizontal rail when the Family is larger than the viewport.

Do not create a separate bundle selector, colour-family selector, or domain-specific variant system.

### 6.3 Colour selector

Colour is a secondary row below Configuration.

Each option may show:

- colour swatch;
- display label;
- optional price delta/effective price when useful.

The selected state must be unambiguous without relying on colour alone.

## 7. PDP page contract

### 7.1 Main order

The approved PDP hierarchy is:

1. Global navigation/search.
2. Breadcrumb.
3. Product gallery.
4. Product title.
5. Brand + Model/SKU identity.
6. Family selector: Configuration Group → Configuration → Colour.
7. Current price + regular price when on sale.
8. Online discount row when applicable.
9. Canonical highlight chips.
10. Quantity + Add to Cart.
11. Add to Quote.
12. Compact purchase policy summary.
13. Product Information.
14. Similar Products.
15. Contact Request.
16. Footer.

Desktop and mobile use the same information model; only presentation changes.

### 7.2 Pricing

Current approved pricing contract:

- `price` = regular selling price;
- `sale_price` = optional lower promotional selling price;
- `voucher_online_discount_amount` = optional additional fixed online discount;
- displayed current price = `sale_price ?? price`;
- online discount is displayed separately as **auto-applied**, not checkbox/claim behavior;
- there is no generic coupon/voucher engine in V1.

If the selected sellable option has no retail price:

- show `Liên hệ giá`;
- do not create a payable Retail Cart line with an unknown amount;
- Quote and Contact Request remain available;
- implementation may hide/disable retail Add-to-Cart while preserving the approved page layout hierarchy.

### 7.3 Highlight chips

Highlights must be deterministic canonical fields/attributes, not parsed marketing copy.

Example MS885:

- `1 khối`
- `4.5L / 3L`
- `Tâm xả 305 mm`

Technology labels such as `CeFiONtect` or `Tornado` require an explicit canonical feature mapping before being used as structured PDP highlights.

### 7.4 Purchase policy summary

Compact summary only:

- Bảo hành;
- Lắp đặt;
- Giao nhận.

Claims must be based on actual Product/manufacturer/service policy data, not a generic promise copied from legacy PDP copy.

### 7.5 Product Information

Desktop uses four tabs; mobile uses four accordions:

1. Thông tin sản phẩm
2. Thông số kỹ thuật
3. Trong hộp bao gồm
4. Tài liệu kỹ thuật

`Trong hộp bao gồm` is not the same concept as a retailer package. A manufacturer Product may ship with non-retail components/accessories. That physical box-content data requires its own canonical structure.

### 7.6 Similar Products

Approved selection rule:

1. same canonical `primary_category_id`;
2. public/selectable Products only;
3. exclude the current Product;
4. exclude Products in the current Family;
5. prefer same Brand;
6. then prefer price proximity;
7. max 5 results;
8. for a package state, use the base manufacturer Product/category context and do not surface package components as “similar” merely because they are components.

## 8. Required V1 schema amendments

Current V1 already contains:

- `product_families`;
- `product_family_configuration_groups`;
- `product_family_memberships`.

That is enough for the old Product-only MS885 model, but not for the approved standardized Family System. The following amendments are required after global wireframe freeze.

### 8.1 `product_family_configurations` — new canonical selector entity

Recommended fields:

- `id`
- `family_id` FK
- `configuration_group_id` nullable FK
- `target_kind` enum: `manufacturer_product | retailer_package`
- `product_id` nullable FK
- `retailer_package_id` nullable FK
- `selector_label` text
- `sort_order`
- `is_active`
- timestamps / provenance metadata as appropriate

Constraints:

- exactly one target FK must be populated according to `target_kind`;
- target cannot belong to another incompatible Family;
- deterministic order within Family/group;
- duplicate target in one Family is prohibited.

Existing `product_family_memberships` should be deterministically backfilled into `manufacturer_product` Configuration rows. Runtime Family selector reads the unified Configuration model, not a union of unrelated legacy concepts.

**Important:** the earlier interim idea `product_family_memberships.selector_label` is superseded. Once `product_family_configurations` exists, `selector_label` belongs to the Configuration.

### 8.2 Product colour/sellable options

Add a canonical colour-option structure, e.g. `product_color_options`.

Recommended fields:

- `id`
- `product_id`
- canonical colour/finish option FK or controlled key
- `label`
- exact sellable `sku`
- `sort_order`
- `is_default`
- `price`
- `sale_price` nullable
- `voucher_online_discount_amount` nullable
- availability state
- publication/selectable state
- provenance

Rules:

- one default option when colour options exist;
- exact SKU is unique at the sellable-option level;
- colour-specific price/availability belongs to the colour option when it differs;
- Product remains the PDP/SEO identity.

Extend Product media with nullable colour-option ownership/tagging so Gallery can select the correct media set. A selectable colour must have a deterministic primary image/media mapping.

### 8.3 Retailer package entities

Add canonical `retailer_packages` and `retailer_package_items`.

`retailer_packages` should include at minimum:

- stable package key;
- display label;
- base/context Product when applicable;
- active/public/selectable state;
- provenance/curation metadata.

`retailer_package_items` should include:

- `retailer_package_id`;
- canonical `product_id`;
- optional selected colour/sellable-option ID when package fixes a specific option;
- quantity;
- sort order.

A package eligible for Retail Cart must have all required component identities resolved. Free-text-only package composition is not publishable commerce data.

### 8.4 Product identifiers/aliases

Add a canonical identifier/alias structure, e.g. `product_identifiers`, to handle manufacturer code lineages such as A/V/B and legacy aliases without duplicating Product records.

Recommended fields:

- `product_id`;
- `identifier_type` (`SKU`, `MODEL`, `LEGACY_SKU`, `MANUFACTURER_ALIAS`);
- normalized `identifier`;
- `is_canonical`;
- source/provenance reference.

Do not infer alias equivalence from string similarity alone.

### 8.5 Included-items data

Add canonical Product box-content data separate from retailer packages, e.g. `product_included_items`.

It may reference a canonical child Product where appropriate, but must also support manufacturer-supplied components that are not separately sold Products.

Required fields include:

- parent `product_id`;
- optional child Product ID;
- normalized/display label;
- quantity;
- sort order;
- source/provenance;
- resolution status where migration evidence is incomplete.

## 9. Retailer package commerce rules

V1 supports `retailer_package` as a Family Configuration, but it does **not** introduce a generic bundle/promotion engine.

For V1:

- package contents are explicit and ordered;
- package effective price is server-derived from current canonical component prices;
- package-specific arbitrary discount/override is OUT unless separately approved later;
- component online-discount amounts may be aggregated only by an explicit deterministic server rule;
- if a required component is not currently retail-sellable or has no usable price, the package cannot create a Retail Cart line and falls back to Quote/Contact behavior;
- Cart/Order snapshots must preserve the component breakdown even if UI presents one package Configuration.

Do not migrate slash-concatenated legacy SKU text as a new canonical Product SKU.

## 10. Production → V1 mapping rules

### 10.1 Source authority

For manufacturer facts:

1. official manufacturer catalogue/page;
2. approved DPG canonical curation;
3. legacy Production/source mappings as evidence;
4. third-party retailer data only as supporting evidence, never manufacturer authority.

For TOTO, official TOTO published catalogues are the primary authority.

### 10.2 Never trust these legacy fields as canonical identity by themselves

Do not create Family/Product identity directly from:

- `variant_group`
- `variant_group_id`
- `variant_options.product_id`
- `variant_type`
- slash-composed SKU strings
- `is_master`
- names parsed from free text

Known issue: some legacy `variant_options.product_id` values are source/HITA IDs, not `public.products.id`.

### 10.3 Classification pipeline

For each legacy group/member:

1. Resolve Brand and manufacturer identity.
2. Resolve canonical manufacturer model/Product.
3. Resolve identifier aliases/revisions.
4. Decide Family.
5. Decide Configuration label/group.
6. Classify target as `manufacturer_product` or `retailer_package`.
7. Extract colour/finish as a sellable option, not a Product, when it is only a colour difference.
8. Resolve package components to canonical Products.
9. Map media to Product + colour option.
10. Map price/availability to the correct sellable entity.
11. Quarantine any ambiguous/conflicting record rather than guessing.

### 10.4 Current Production readiness snapshot

Read-only audit captured 2026-09-04:

- 17,739 public PDP records;
- 2,016 legacy variant groups;
- 1,305 groups / 5,610 public members are conservative auto-map candidates;
- 109 groups / 710 members mix manufacturer Product + retailer package;
- 61 groups / 238 members are package-only groups;
- 169 groups / 777 members require colour normalization;
- 44 groups / 358 members cross Product type/category and require review;
- 1 invalid multi-brand group (`26900`) mixes GROHE + Hansgrohe and must never migrate as one Family;
- 247 orphan groups and 80 singleton groups do not need a public Family selector;
- 609 public combo Products have no normalized Family group.

Public combo component readiness:

- 1,300 public combo records total;
- 70 have no package-item rows;
- 434 are fully resolvable from current SKU/text evidence;
- 521 are partially resolvable;
- 275 have no resolvable component under the current audit method.

These counts are migration evidence, not stable runtime business metrics. Re-audit at implementation time.

## 11. Required mapping fixtures

Codex must use these fixtures to prove the importer/runtime model before broad migration.

### 11.1 MS885 — large manufacturer Family

Expected model:

- Family `MS885`;
- Configuration Groups: `Nắp đóng êm`, `Nắp rửa cơ`, `Nắp điện tử`;
- each selectable manufacturer model is a Product/PDP Configuration;
- group count = current public/selectable Configurations only;
- no fabricated Product for catalogue gaps.

### 11.2 TBG10302 — Product + retailer package + colour

Expected normalized shape:

- Family `TBG10302`;
- base Configuration `Không gồm tay sen` → manufacturer Product;
- package Configurations such as `Bộ tay sen 108ZR` → `retailer_package`;
- Colour is secondary to the selected Configuration;
- colour does not create PDPs;
- legacy slash SKUs are migration evidence, not canonical manufacturer Product identity.

### 11.3 TBW0740 — manufacturer Configuration

Expected normalized shape:

- same Family;
- `Có vòi xả bồn` and `Không vòi xả bồn` are distinct manufacturer Products/PDPs;
- optional Colour exists below each Configuration where supported.

### 11.4 TBW07003A — legacy group that mixes configuration + colour

Legacy may appear as one `color` group but contains:

- `TBW07003A` = gắn tường;
- `TBW07003A1` = gắn trần;
- multiple colour suffixes for each.

V1 must normalize to:

**Family → Configuration (`Gắn tường | Gắn trần`) → Colour**.

### 11.5 Group `26900` — hard reject fixture

Legacy group mixes GROHE and Hansgrohe Products. Import must split/reclassify or quarantine. It must never become one V1 Family.

## 12. Runtime Family-selector read contract

Public PDP should receive one normalized view model, conceptually:

```text
family
  id
  key
  name
  groups[]?                 // optional
  configurations[]
    id
    group_id?
    selector_label
    target_kind             // manufacturer_product | retailer_package
    target
      product_id? / package_id?
      canonical_url_state
      thumbnail
      effective_price_state
    colour_options[]?
      id
      label
      swatch
      sku
      price state
      availability
      media set
selected_configuration_id
selected_colour_option_id?
```

Frontend must not reconstruct this hierarchy by parsing SKU/name/legacy variant fields.

## 13. Gallery contract

Gallery media is Product-owned, optionally scoped to a colour option.

On colour change:

- selected colour's PRIMARY media becomes the main gallery image;
- gallery thumbnails update/select the media mapped to that colour;
- generic Product media may remain as fallback editorial/support media only when semantically valid;
- no cross-colour image should be presented as if it represented the selected colour;
- a colour option without required primary media is not publish-ready for selector exposure.

## 14. Cart, Quote and Order snapshots

### Manufacturer Product

Retail Cart/Quote captures:

- Product ID;
- selected colour/sellable-option ID if any;
- exact SKU;
- display name/selector label snapshot;
- selected colour label snapshot;
- current price snapshot;
- quantity.

### Retailer package

Retail Cart/Quote captures:

- package ID/configuration ID;
- package display label snapshot;
- component Product IDs and exact component sellable-option/SKU selections;
- per-component quantity and monetary snapshots;
- total server-derived package amount.

Order must remain reconstructable after catalogue/package changes.

## 15. Search and SEO

- Manufacturer Product owns canonical PDP URL and SEO identity.
- Colour option does not create a new indexable PDP.
- Alternate colour SKU can be indexed by search as an identifier and route to the Product PDP with optional selected-colour UI state.
- `retailer_package` must not be represented as a manufacturer Product for SEO/schema.org.
- A package selection may have shareable UI state, but canonical Product SEO stays with the underlying manufacturer Product context unless a later explicit merchandising/SEO decision changes this.
- Family has no standalone public page in V1.

## 16. PDP responsive acceptance criteria

### Shared

- One normalized Family component contract drives Desktop and Mobile.
- No Wishlist/Collection controls.
- No Showroom CTA on Product unless a separate inventory/showroom feature explicitly proves display availability.
- Online discount is auto-applied presentation, never an opt-in checkbox.
- Retail Cart and Quote remain separate flows.

### Desktop

Must match approved D08/D09 Desktop states, including:

- gallery + commerce layout;
- Family cards/tabs;
- four information tabs;
- Similar Products;
- Contact Request.

### Mobile

Must match approved M08/M09 states, including:

- approved mobile global navigation/search;
- swipe-friendly gallery/thumbnail row;
- horizontally scrollable Family/configuration rails;
- colour selector beneath Configuration;
- four information accordions;
- horizontal Similar Products rail;
- approved mobile Contact Request and footer.

## 17. Import acceptance criteria

Implementation is not accepted unless automated tests prove:

1. Replays are deterministic/idempotent.
2. Legacy variant IDs never become Product FKs without explicit source mapping.
3. One manufacturer Product belongs to at most one Family.
4. Configuration target-kind constraints are enforced in DB.
5. Colour SKU selection never creates an extra Product/PDP.
6. Gallery follows selected colour deterministically.
7. Retailer package components resolve to canonical Product IDs before retail publication.
8. Package components are preserved in Cart/Order snapshots.
9. Family/group counts ignore catalogue gaps, hidden members and quarantined records.
10. Cross-brand group `26900` cannot migrate as one Family.
11. TBG10302 normalizes Product/package/colour correctly.
12. TBW07003A normalizes configuration-before-colour correctly.
13. MS885 retains the approved grouped Family behavior.
14. Missing/ambiguous manufacturer evidence fails closed.

## 18. Implementation sequence after global freeze

Do not reorder this into UI-first coding.

1. Re-audit current schema and Production counts.
2. Update/supersede stale Family/package clauses in canonical architecture docs.
3. Implement DB schema amendments and constraints.
4. Write deterministic migration/classification report before importing Production data.
5. Implement fixtures/tests for MS885, TBG10302, TBW0740, TBW07003A and invalid `26900`.
6. Implement importer/backfill.
7. Implement normalized Family-selector read model/API.
8. Implement Desktop PDP.
9. Implement Mobile PDP using the same domain/read model.
10. Implement Cart/Quote/Order selected-option/package snapshots.
11. Run migration/read-model/UI acceptance tests.
12. Only then consider broader catalogue migration.

## 19. Things Codex must not do

- Do not copy Production `variant_group` directly into V1 Family.
- Do not create Product/PDP per colour.
- Do not create fake manufacturer Products for retailer packages.
- Do not parse selector labels from SKU at runtime.
- Do not treat third-party retailer metadata as manufacturer authority.
- Do not fabricate missing Family models.
- Do not make Family/Configuration Group own Product price or SEO identity.
- Do not add a generic promotion/coupon/bundle-rules engine.
- Do not expand scope into Combo/BOM authoring beyond the approved explicit `retailer_package` composition required by Family Configurations.
- Do not start implementation until the exact global freeze phrase exists.

## 20. Future Codex kickoff prompt

Use only after Owner says `V1 WIREFRAME APPROVED / FROZEN`:

> Implement the approved V1 PDP + Family System from `docs/internal/v1-pdp-family-system-implementation-handoff.md` and ADR 0017. Start with schema/data-contract amendments and deterministic migration fixtures only; do not code PDP UI until the schema/import tests for MS885, TBG10302, TBW0740, TBW07003A and invalid group 26900 pass. Treat approved Figma sections `04 — PDP DESKTOP — APPROVED FAMILY SYSTEM` and `05 — PDP MOBILE — APPROVED FAMILY SYSTEM` as UI authority. Do not use legacy variant fields as runtime authority and do not expand scope.
