---
status: proposed
---

# Lock the canonical V1 domain and data architecture

LEO-557 defines the New Production model that LEO-561 and LEO-562 must
implement. Supabase PostgreSQL is the only canonical V1 data authority. Legacy
Prisma tables, routes, UI, SQLite migrations, and import payloads are migration
evidence only; they cannot remain as a second write or read model.

## A. Canonical domain model

### Catalogue

- A **Product** is one manufacturer model, one commercial identity, and one
  PDP. SKU/model and slug are unique. A published Product has exactly one
  Brand, one primary leaf Category, a positive retail price, indicative
  Availability, approved media, and Product-level provenance.
- A **Brand** is a first-class catalogue entity with its own public page. Brand
  names copied into Product, Content, Quote, or Order records are snapshots or
  editorial text, never Brand authority.
- A **Category** is a node in one adjacency-list tree. The four depth-0 sector
  roots are `Thiết bị vệ sinh`, `Gạch ốp lát`, `Thiết bị nước`, and
  `Thiết bị bếp`. A Product references one active leaf through
  `primary_category_id`; ancestor membership is derived from the tree. V1 has
  no secondary-category assignment table.
- A **Family** groups alternative, related Products. A Product belongs to zero
  or one Family. Optional Configuration Groups organize real distinctions
  inside that Family. Family owns no price, availability, publication state,
  SEO identity, or standalone public V1 page. Missing expected models are
  import/curation gaps, never fabricated Products.
- A **Collection** is an ordered, many-to-many, manually curated Product group.
  It has editorial title, slug, summary, media, publish state, and explicit
  memberships. It has no query, predicate, or rules engine in V1.

The initial taxonomy is navigation-oriented and may use a third or fourth level
only when the node is a durable product kind with enough launch content. Brand,
price, colour, material, dimensions, style, installation, room, and use case are
facets, not Category branches.

| Sector root | Canonical level-1 groups | Allowed deeper product-kind examples |
| --- | --- | --- |
| Thiết bị vệ sinh | Bồn cầu; Nắp bồn cầu; Lavabo; Vòi chậu; Sen tắm; Bồn tắm; Bồn tiểu; Gương phòng tắm; Thoát sàn; Phụ kiện phòng tắm; Thiết bị công cộng | Bồn cầu liền khối/hai khối/treo tường/thông minh; nắp thường/rửa cơ/điện tử; lavabo đặt bàn/âm bàn/treo tường; sen tay/sen cây/âm tường |
| Gạch ốp lát | Gạch lát nền; Gạch ốp tường; Gạch trang trí & mosaic; Gạch ngoài trời | Only a stable product kind; size, finish, material and room remain facets |
| Thiết bị nước | Máy nước nóng; Máy lọc nước; Máy bơm nước; Bồn chứa nước; Thiết bị & phụ kiện đường nước | Máy nước nóng trực tiếp/gián tiếp/năng lượng mặt trời when catalogue volume justifies navigation |
| Thiết bị bếp | Chậu rửa bếp; Vòi bếp; Bếp nấu; Máy hút mùi; Máy rửa chén; Lò bếp; Phụ kiện bếp | Bếp từ/điện-hồng ngoại/gas and lò nướng/vi sóng when the distinction is manufacturer-confirmed |

Tile products with several declared applications still receive one
manufacturer-supported primary group; all other applications are multi-valued
facets. An ambiguous primary category blocks publication instead of being
guessed.

### Commerce

- A **Quote Request** is the immutable customer-submitted intent: contact and
  project context plus requested Product-line snapshots, requested quantity,
  and customer note.
- A **Quote** is the Sales-negotiated commercial offer produced from one Quote
  Request. V1 permits at most one current Quote per request and no revision
  history. It is editable while `DRAFT` or `ISSUED`, uses optimistic versioning,
  and becomes immutable when `CONVERTED`, `CANCELLED`, or `EXPIRED`.
- A **Shareable Quote** is a read-only projection of an issued Quote addressed
  by a high-entropy opaque token. Store only the token hash; Admin-only notes
  are never included.
- An **Order** is either a retail checkout snapshot or an atomic snapshot of a
  converted Quote. Catalogue changes cannot rewrite Order lines.

Retail payment methods are exactly `COD` and `BANK_TRANSFER`. Payment states
are exactly `UNPAID`, `PARTIALLY_PAID`, `PAID`, and `REFUNDED`. Manual payment
transactions are the monetary authority; `payment_status` is a transactionally
maintained projection. `REFUNDED` means at least one refund is recorded, while
paid/refunded amounts preserve whether that refund is partial or full without
adding another V1 status.

## B. Key invariants

1. One model equals one Product equals one PDP; no master/child Product or
   generated variant can replace that identity.
2. Every published Product has one Brand and exactly one active primary leaf
   Category. Category ancestors are derived; facets and Collections cannot
   change canonical classification.
3. Every published Product has a positive `retail_price`. Optional manufacturer
   `list_price`/MSRP is reference information. V1 has no public price fallback,
   sale-price stack, promotion engine, or price guessed from legacy fields.
4. A Product can belong to at most one Family; a Family has at least two real
   Product members before related-model navigation is public. Family and
   Configuration Group never own commerce or PDP state.
5. Collection membership is explicit, ordered, and human-authored. Replaying
   an import cannot silently add or remove curated membership.
6. Each Attribute Definition has one value type and canonical unit. Product
   values use exactly that typed representation. JSON cannot duplicate a typed
   value.
7. Manufacturer facts require Product-level source provenance. Unknown or
   conflicting facts stay null/quarantined; they are never inferred from model
   names, SKU patterns, sibling Products, or marketing copy.
8. Public Product eligibility is one deterministic database-backed gate shared
   by Admin, Public, Search, sitemap, and import reporting. A score may explain
   completeness but cannot override a failed required condition.
9. Quote Request lines, issued Quote lines, and Order lines retain immutable
   Product identity and monetary snapshots. Their nullable Product FK is only
   a navigation link.
10. Quote-to-Order conversion is one PostgreSQL transaction, concurrency-safe,
    idempotent, and unique per Quote. It reads negotiated Quote snapshots, not
    mutable Product prices.
11. Content references canonical Products, Categories, and Brands by FK and
    never copies their business facts as Content authority.

## C. Typed attributes and filters

Use four normalized concepts:

1. `attribute_definitions`: stable key, label, value type (`text`, `number`,
   `boolean`, `enum`, `multi_enum`), canonical unit/dimension, and validation.
2. `attribute_options`: controlled options and aliases for enum values.
3. `category_attribute_policies`: Category plus Attribute Definition, PDP
   visibility/order, filterability/order, and publish requirement tier
   (`none`, `launch`, `deep`). This is configured data, not a runtime filter
   builder.
4. `product_attribute_values`: Product plus Attribute Definition and exactly
   one typed value column (or ordered option rows for `multi_enum`), source
   quality, and timestamps. Database checks enforce the definition's type.

Numbers are stored in canonical units and formatted for display separately.
Range filters use numeric columns; enum filters use option FKs; boolean filters
use booleans. Free text may appear on the PDP but is not filterable by default.

Sanitary examples include `mounting_type`, `toilet_construction`, `flush_type`,
`trap_type`, `rough_in_mm`, `water_per_flush_l`, `bowl_shape`,
`bidet_seat_compatible`, `width_mm`, `depth_mm`, `height_mm`,
`minimum_pressure_bar`, `finish`, and `warranty_months`. The applicable subset
is selected per leaf Category; a lavabo is not forced to carry toilet fields.

The same mechanism extends without schema changes:

- Tile: `width_mm`, `length_mm`, `thickness_mm`, `material`, `finish`,
  `application` (multi-enum), `water_absorption_pct`, `slip_rating`,
  `coverage_m2_per_box`.
- Water: `capacity_l`, `power_w`, `flow_l_min`, `head_m`, `pressure_bar`,
  `energy_source`.
- Kitchen: dimensions/cut-out dimensions, `power_w`, `burner_count`,
  `capacity_l`, `place_settings`, `noise_db`, `energy_rating`.

JSONB is allowed only for immutable raw/import payloads, quarantine evidence,
non-authoritative metadata, and validated Content Block payloads. The legacy
`products.specs` JSON, `product_attribute_values`, and normalized spec tables
must not all survive as public truth; LEO-561 keeps one typed value model and
LEO-562 maps every legacy representation into it or quarantines the conflict.

## D. Content architecture

Use one `content_entries` aggregate with a required type:
`GUIDE`, `INSPIRATION`, `BUYING_GUIDE`, or `LANDING_PAGE`. Common structured
fields include title, slug, excerpt, hero media, SEO fields, author/editor,
publication state/timestamps, and optimistic `version`. Landing Page alone owns
an allowlisted `route_path`; it may not collide with the fixed routes approved
by LEO-556.

`content_blocks` are ordered children with a closed V1 `block_type` vocabulary
and a JSONB payload validated against that block type on every write. Initial
types may cover rich text, heading, media, quote/callout, Product grid, Category
links, Brand links, CTA, and specifications/table. Unknown block types or
invalid payloads fail closed.

Use normalized `content_product_references`,
`content_category_references`, and `content_brand_references`, each with role,
order, and optional block ID. These FKs drive related content and block
materialization. A block may control editorial presentation, but Product name,
price, availability, Category, and Brand are resolved from canonical data at
read time. The existing Blog lifecycle, versioning, publication readiness,
idempotency, and managed-media knowledge may be refactored into this aggregate;
`blog_posts` is not a second V1 CMS.

## E. Quote-to-Order transaction contract

Quote Request creation snapshots Product ID (nullable later), SKU/model, name,
Brand label, primary Category label, retail price, indicative Availability,
requested quantity, customer note, and `snapshot_at`. Creating a Quote copies
those facts, after which Sales may add/remove lines and set negotiated quantity,
negotiated unit price, explicit line discount, public line note, and private
line note. Quote header stores project/contact snapshots, public/private notes,
shipping fee, discount total, subtotal, and total; totals are server-derived.

Conversion accepts `quote_id`, `expected_version`, and an `idempotency_key`:

1. Acquire a per-Quote transaction lock and an operation/key advisory lock.
2. Load the Quote and lines in the same transaction; require `ISSUED`, matching
   version, complete snapshots, positive quantities/prices, and consistent
   server-calculated totals.
3. Reserve the idempotency key with a canonical request hash. Same key/same
   request returns the stored Order response; same key/different request fails.
4. Insert one Order with `source_quote_id` under a unique constraint and insert
   Order-line snapshots of Product identity, quantity, negotiated price,
   discount, public note, and calculated totals. Do not reread catalogue price.
5. Mark Quote `CONVERTED`, store `converted_order_id`/time, and commit the
   Order, lines, Quote transition, idempotency result, and bounded audit event
   together.

Concurrent calls therefore create exactly one Order. A different key after a
successful conversion returns the existing conversion outcome rather than
creating another Order. Converted commercial snapshots are immutable; later
Order operations may change lifecycle and payment state, not the negotiated
line facts.

## F. Reuse, refactor, and deprecate

| Current asset | Decision | V1 treatment |
| --- | --- | --- |
| `product_families`, Configuration Groups, memberships, MS885 migration/tests | Reuse | Preserve real-Product membership, composite family/group integrity, explicit gaps, and no Family commerce/PDP ownership; tighten to at most one Family per Product and allow group only when meaningful. |
| Product visibility/public-price and Quote snapshot tests | Reuse | Preserve fail-closed publication and immutable snapshots; adapt to required positive V1 retail price and no legacy fallback. |
| PostgreSQL migration manifests/checksums/deterministic runner | Reuse | Make these mandatory for clean Supabase migrations and import replay. |
| `brands`, Product media/docs, source mappings/provenance | Refactor | Keep domain knowledge; create clean V1 keys, constraints, provenance, and publish requirements. |
| `catalog_taxons`, taxonomy mappings, assignment knowledge | Refactor | Keep tree/mapping knowledge; rename to canonical Categories and replace plural Product assignments plus parallel category/type tables with `products.primary_category_id`. |
| `spec_definitions`, options, values, `filter_definitions` | Refactor | Merge into one typed Attribute Definition/value model plus Category Attribute Policy. |
| `blog_posts` publishing/version/media controls | Refactor | Generalize to the four typed Content Entries and validated Blocks. |
| `quote_requests`, `quote_items`, Order/Quote RPC transaction controls | Refactor | Split submitted Quote Request from negotiated Quote; preserve snapshots, request hashing, advisory/row locks, and atomic writes. |
| `orders`, `order_items`, manual payment fields | Refactor | Require complete snapshots, `source_quote_id`, constrained lifecycle/payment vocabulary, and payment transactions/projection. |
| Legacy `categories`/`subcategories`/`product_types` plus multiple taxon assignments | Deprecate | Import/reference only; no V1 runtime authority. |
| `products.specs` JSON and `product_attribute_values` duplicate values | Deprecate | Raw migration input only after mapping to the one typed value model. |
| `variant_group`, `variant_group_id`, `variant_options`, `is_master`, variant groups | Deprecate | Never create Product identity or Family membership from these fields without explicit evidence. |
| `price`, `original_price`, `price_display`, sale/discount fallback fields | Deprecate | Import evidence only; V1 retail price is explicit and DPG-owned. |
| SQLite-origin Collection/schema, Blog-only CMS, Product package/BOM fields, legacy route/UI | Deprecate | Not New Production authority and not implemented by LEO-561/562. |

## G. M1 constraints for LEO-561 and LEO-562

LEO-561 must create a clean PostgreSQL/Supabase schema rather than copy the
current Prisma schema. It must use database enums/checks, FKs, unique and
partial indexes to enforce the invariants above; include optimistic versions
on mutable Product, Quote, and Content aggregates; use numeric money with one
currency (`VND`); and expose one publication-eligibility projection/function.
The migration must be deterministic, checksum-controlled, replayable on an
empty database, and contain no Production data or compatibility columns.

LEO-562 must read only from the isolated raw/reference source created by
LEO-560, never dual-write, and produce deterministic source-to-canonical
mappings plus explicit quarantine reasons. It must preserve source identifiers
and Product-level provenance, normalize units/options, reject ambiguous Brand,
primary Category, model, price, Family, and manufacturer facts, and leave
manual Collection membership untouched. Replays must be idempotent and report
counts/checksums for imported, withheld, conflicted, and publishable records.

Publish-quality policy is data-driven but uses a closed implementation:

- **All sectors:** exact model/SKU, Brand, one primary leaf Category, positive
  DPG retail price, indicative Availability, primary image, Product-level
  provenance, no unresolved critical conflict, and required basic selling
  fields.
- **Thiết bị vệ sinh (`deep`):** official manufacturer evidence; exact model
  and imagery; required leaf-specific normalized dimensions, installation,
  water/pressure/flush facts where applicable; Family audit where applicable;
  and technical document/warranty fields when the manufacturer publishes them.
  Missing a deep-required fact blocks publication.
- **Gạch/Nước/Bếp (`launch`):** the global gate plus the minimum Category
  attributes needed to identify, filter, explain, and sell the Product. A
  noncritical manufacturer field may remain null, but an ambiguous identity,
  primary Category, price, safety/sizing fact, or provenance blocks publication.

The importer never turns completeness score, sibling data, aliases, or a
legacy fallback into a pass. LEO-561/562 stop at schema/import/publish-quality
evidence; they do not start Public/Admin application implementation.

## H. Owner decisions

No new Owner-level product, cost, Production, security, or irreversible
architecture decision is required. This record resolves the technical choices
inside the approved Product Charter. Owner review is still the acceptance gate
that changes this ADR from `proposed` to `accepted`; that review does not
authorize LEO-561/562 implementation, merge, deployment, or Production action.
