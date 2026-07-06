# PRD: Catalog Taxonomy v2

Last updated: 2026-07-04

## Summary

Catalog Taxonomy v2 creates a stable internal product classification model for Dong Phu Gia. The goal is to stop using crawled source taxonomy as the public structure of the site, while preserving all product data already collected from Hita and other sources.

The new model separates:

- **Taxonomy**: where a product belongs in the catalog.
- **Attributes/facets**: how a customer filters or compares products.
- **External mappings**: how Hita categories, breadcrumbs, URLs, and labels translate into Dong Phu Gia taxonomy.

This is a foundation change. It must be rolled out additively, with audit and compatibility layers first, before any destructive cleanup.

## Goals

- Use Dong Phu Gia taxonomy as the source of truth for listing, PDP URLs, SEO paths, sitemap, and crawler/import decisions.
- Keep Hita taxonomy behind an anti-corruption mapping layer.
- Ensure every public or listable product has a valid primary taxon.
- Prevent listing cards from linking to invalid PDP paths.
- Support long-term SEO with stable canonical URLs and redirect coverage.
- Support scalable UX flows: technical category pages, need-based landing pages, and clean filter/facet behavior.
- Preserve existing crawl/import data: source URL, Hita product ID, SKU, price, specs, media, documents, variants, visibility, and active status.

## Non-Goals

- Do not delete existing `categories`, `subcategories`, `product_type`, or `product_sub_type` fields during the first migration.
- Do not recrawl all brands as part of the taxonomy migration itself.
- Do not redesign frontend listing UI in this phase.
- Do not turn every filter combination into an indexable SEO page.
- Do not redirect spam or hacked URLs to product/category pages.

## Domain Language

| Term | Meaning |
|---|---|
| Catalog taxon | A durable internal node in Dong Phu Gia catalog taxonomy. |
| Primary taxon | The main catalog home of a product. Used for canonical listing/PDP context. |
| Secondary taxon | Additional catalog placement for cross-selling or multi-category relevance. |
| Source taxonomy | The taxonomy from an external site such as Hita. It is not trusted as DPG taxonomy. |
| External mapping | A reviewed rule that maps Hita breadcrumb/category/source URL to a DPG taxon. |
| Attribute | A normalized product characteristic derived from specs/crawler/manual data. |
| Facet | A customer-facing filter built from normalized attributes. |
| Use-case landing | A curated SEO/UX page based on customer intent, not the product's primary taxonomy. |

## Target Bounded Contexts

### Core Catalog Context

Owns:

- catalog taxonomy
- product primary/secondary assignments
- canonical product paths
- listing eligibility
- SEO inclusion

### External Source Context

Owns:

- Hita source URL
- Hita product ID
- Hita breadcrumb/category labels
- crawl run artifacts

Integration rule:

External source data must be translated through `external_taxonomy_mappings` before it can affect public taxonomy.

### Product Attribute Context

Owns:

- normalized attribute keys and values
- filter/facet candidates
- raw specs preservation

Raw specs remain available for PDP display and audit. Normalized attributes are derived data.

## Proposed Schema

### `catalog_taxons`

Internal taxonomy tree.

| Field | Type | Purpose |
|---|---|---|
| `id` | int | Primary key. |
| `parent_id` | int nullable | Parent taxon. Null for root categories. |
| `kind` | varchar | `category`, `family`, `type`, `collection`, `use_case`. |
| `slug` | varchar | Stable slug within parent. |
| `name` | varchar | Display name. |
| `canonical_path` | varchar | Full public path, for example `/thiet-bi-ve-sinh/bon-cau`. |
| `seo_title` | varchar nullable | SEO title override. |
| `seo_description` | varchar nullable | SEO description override. |
| `is_indexable` | boolean | Whether this taxon can be indexed. |
| `is_listing_enabled` | boolean | Whether this taxon has a listing page. |
| `sort_order` | int | Manual ordering. |
| `status` | varchar | `active`, `draft`, `deprecated`. |
| `created_at` | timestamp | Audit. |
| `updated_at` | timestamp | Audit. |

Suggested indexes:

- unique `(parent_id, slug)`
- unique `canonical_path`
- index `(kind, status)`
- index `(is_listing_enabled, is_indexable)`

### `product_taxon_assignments`

Product-to-taxonomy assignments.

| Field | Type | Purpose |
|---|---|---|
| `product_id` | int | Product. |
| `taxon_id` | int | Catalog taxon. |
| `role` | varchar | `primary`, `secondary`, `related`. |
| `confidence` | numeric/int | Confidence score. |
| `source` | varchar | `manual`, `backfill`, `hita_mapping`, `rule`. |
| `created_at` | timestamp | Audit. |
| `updated_at` | timestamp | Audit. |

Invariants:

- A product may have only one `primary` assignment.
- Every product with `publication_status='public'` and `pdp_visibility='public'` must have one `primary` assignment.
- Every product with listable visibility must have one `primary` assignment.

### `external_taxonomy_mappings`

Anti-corruption layer for Hita and future sources.

| Field | Type | Purpose |
|---|---|---|
| `source` | varchar | `hita`, `manual_import`, etc. |
| `source_breadcrumb` | text nullable | Source breadcrumb text. |
| `source_category_slug` | varchar nullable | Source category slug if known. |
| `source_url_pattern` | text nullable | URL pattern/rule. |
| `target_taxon_id` | int | DPG target taxon. |
| `confidence` | numeric/int | Mapping confidence. |
| `mapping_rule` | text/json | Human-readable rule or matcher config. |
| `reviewed` | boolean | Whether this mapping was approved. |
| `created_at` | timestamp | Audit. |
| `updated_at` | timestamp | Audit. |

Import rule:

- `reviewed=true` mappings may be used for production import.
- Unreviewed or missing mappings must go to staging/manual review.

### `product_attribute_values`

Normalized attributes/facets. Raw `products.specs` remains untouched.

| Field | Type | Purpose |
|---|---|---|
| `product_id` | int | Product. |
| `attribute_key` | varchar | Stable key, for example `flush_type`. |
| `attribute_label` | varchar | Display label, for example `Kiểu xả`. |
| `value` | text | Display value. |
| `value_slug` | varchar | Filter-safe slug. |
| `source` | varchar | `specs`, `crawler`, `manual`. |
| `confidence` | numeric/int | Confidence score. |
| `created_at` | timestamp | Audit. |
| `updated_at` | timestamp | Audit. |

Invariants:

- Specs are source data; attribute values are derived data.
- Attribute extraction must be repeatable.
- Facet URLs must not create uncontrolled indexable URL combinations.

## Target Taxonomy v1

### Thiết Bị Vệ Sinh

- `bon-cau`
- `nap-bon-cau`
- `lavabo`
- `voi-chau`
- `sen-tam`
- `bon-tam`
- `bon-tieu`
- `phu-kien-phong-tam`
- `guong-phong-tam`
- `ga-thoat-san`
- `may-say-tay`

### Thiết Bị Bếp

- `chau-rua-chen`
- `voi-rua-chen`
- `phu-kien-chau-rua-chen`
- `bep-dien-tu`
- `bep-gas`
- `may-hut-mui`
- `may-rua-chen`
- `lo-nuong`
- `phu-kien-bep`
- `thiet-bi-bep-khac`

`phu-kien-chau-rua-chen` is intentionally separate from `phu-kien-bep` because it supports a specific shopping journey around sinks and kitchen faucets.

### Vật Liệu Nước

- `may-nuoc-nong`
- `loc-nuoc`
- `bon-chua-nuoc`
- `may-bom-nuoc`
- `phu-kien-vat-lieu-nuoc`

### Gạch Ốp Lát

- `gach-op-lat`
- `gach-op-tuong`
- `gach-lat-nen`
- `gach-trang-tri`
- `gach-inax-ecocarat`

INAX/EcoCarat tile products belong to `gach-op-lat`, not a separate top-level category.

## SEO Policy

- Canonical domain: `https://www.dongphugia.com.vn`.
- Canonical product URL shape remains `/<category>/<taxon>/<product-slug>`.
- Product slugs must not depend on Hita trailing IDs.
- Old product URLs must 301 to canonical URLs when they represent real products.
- Spam/hacked URLs should remain 404 or 410.
- Use-case landing pages may be indexable only when curated and valuable.
- Faceted URLs should generally canonicalize or noindex unless explicitly promoted as SEO landings.
- Inactive/discontinued real products may remain live and indexable if they have search value and accurate commerce state.

## Migration Requirements

1. Add schema first; do not drop old fields.
2. Seed taxons before assigning products.
3. Dry-run product assignments before writing.
4. Backfill primary taxons for all public/listable products.
5. Keep legacy fields in sync during transition.
6. Update app reads through a compatibility layer.
7. Update crawler/importer to use `external_taxonomy_mappings`.
8. Generate and verify redirects/sitemap after path changes.

## Acceptance Criteria

- `public/listable products without primary taxon = 0`.
- `public/listing cards with invalid PDP route = 0`.
- `duplicate canonical paths = 0`.
- `products count before/after = unchanged`.
- `is_active count before/after = unchanged`, unless a separate approved task changes it.
- `source_url` and `hita_product_id` preserved.
- Raw specs preserved.
- Product media and documents preserved.
- Sitemap contains only canonical URLs.
- Old valid product URLs redirect to canonical URLs.
- Pipeline refuses production import when no reviewed taxonomy mapping exists.

## Rollback Strategy

Because v2 is additive:

- App can temporarily read legacy `category_id`, `subcategory_id`, and `product_type`.
- New taxonomy tables can remain unused if rollout is paused.
- Backfill assignments can be deleted/rebuilt from source data.
- Redirect artifact can be regenerated from the DB.
- No product content fields should be overwritten by taxonomy migration.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong primary taxon | Bad SEO and UX routing | Dry-run, confidence score, manual review list. |
| Listing 404 | Bad UX and SEO crawl waste | Gate: no listable product without canonical path. |
| Faceted URL explosion | SEO dilution | Index only curated landings; canonical/noindex dynamic filters. |
| Hita taxonomy leak | Messy DPG structure | Require reviewed external mappings. |
| Redirect gaps | Ranking loss | Generate redirect map from old URLs before deploy. |
| Cache staleness | Production appears inconsistent | Revalidate product/listing/sitemap tags after rollout. |

## Current Architecture Score

DDD score: 7/10.

The domain concepts are emerging clearly, but external source taxonomy still leaks into product/category fields.

DDIA score: 7/10.

The data layer has useful raw source data and visibility fields, but taxonomy is not yet separated from derived/imported data. The additive model raises this to 9/10 once mapping, invariants, and read-only audit gates are in place.
