# Catalog Taxonomy v2 Legacy Migration Decision-Ready Report

- Branch: `codex/catalog-taxonomy-v2-schema-sync`
- Commit baseline reviewed: `3548dc8`
- Audit mode: DB-backed, read-only
- Inventory source of truth: `docs/handoffs/catalog-taxonomy-v2-legacy-migration-69-cases.csv`
- Raw audit artifacts:
  - `scripts/output/catalog-taxonomy-v2-legacy-migration-audit.json`
  - `scripts/output/catalog-taxonomy-v2-legacy-migration-audit.md`

## Decision Summary

- Total audited cases: `69`
- Product match in DB: `69 / 69`
- Redirect collision with existing DB redirects: `0`
- Redirect chain risk `> 1 hop`: `0`
- Self-loop / abnormal old->new duplication: `0`

## Recommendation

- `Safe to migrate legacy fields now, from a data perspective`: `15`
  - `thiet-bi-ve-sinh -> thiet-bi-bep`: `3`
  - `thiet-bi-ve-sinh -> vat-lieu-nuoc`: `12`
- `Needs app patch before migrate`: `54`
  - all `thiet-bi-ve-sinh -> gach-op-lat`
- `Needs later-phase follow-up, not blocked but lower priority`: `3`
  - the `thiet-bi-ve-sinh -> thiet-bi-bep` rows are all `is_active = false`, so they are safe structurally but lower-value operationally

## What DB Audit Confirmed

- All 69 rows are `publication_status = public`
- All 69 rows are `pdp_visibility = public`
- All 69 rows are `search_visibility = visible`
- All 69 rows are `seo_indexing = index`
- All 69 rows are `sitemap_include = true`
- Stock state is `in_stock` for all 69 rows
- `is_active = true` for `66` rows
- `is_active = false` for `3` rows, all in `thiet-bi-ve-sinh -> thiet-bi-bep`
- `listing_visibility = default` for `68` rows
- `listing_visibility = low_priority` for `1` row:
  - `INAX-255/90-14/POL-B1-B2-B3`

## Safe Now

### 1. `thiet-bi-ve-sinh -> vat-lieu-nuoc` (`12`)

- Current legacy subcategory is already `may-nuoc-nong` for all 12 rows.
- Target legacy root exists and target subcategory exists in DB:
  - `vat-lieu-nuoc`
  - `may-nuoc-nong`
- Public/runtime behavior is already aligned:
  - canonical PDP points to `/vat-lieu-nuoc/may-nuoc-nong/...`
  - redirect map is already present
- Impact of moving legacy `category_id` is acceptable and expected:
  - root listing, featured blocks, filters, admin views will follow the product into the target root

### 2. `thiet-bi-ve-sinh -> thiet-bi-bep` (`3`)

- Current legacy subcategory is already `chau-rua-chen` for all 3 rows.
- Target legacy root exists and target subcategory exists in DB:
  - `thiet-bi-bep`
  - `chau-rua-chen`
- Redirect/runtime checks are clean.
- Caveat:
  - all 3 rows are `is_active = false`
  - they are structurally safe to migrate, but operational benefit is lower than the 12 active `vat-lieu-nuoc` rows

## Patch App First

### `thiet-bi-ve-sinh -> gach-op-lat` (`54`)

- This group is the real blocker.
- The target taxonomy leaves are:
  - `gach-op-lat/gach-op-tuong` (`37`)
  - `gach-op-lat/gach-inax-ecocarat` (`10`)
  - `gach-op-lat/gach-op-lat` (`7`)
- But current legacy DB `subcategories` under root `gach-op-lat` are only:
  - `gach-van-da-marble`
  - `gach-van-da-tu-nhien`
  - `gach-van-go`
  - `gach-thiet-ke-xi-mang`
  - `gach-trang-tri`
- Meaning:
  - target taxonomy leaf slugs do **not** exist as legacy `subcategories`
  - `subcategory_id` cannot be safely aligned 1:1 to the canonical leaf without an app/data model bridge

## Why `gach-op-lat` Needs Patch First

### Subcategory Listing Dependency

- Listing routes like `src/app/(public)/gach-op-lat/[sub]/page.tsx` resolve `[sub]` from `prisma.subcategories.findFirst({ slug: sub })`.
- Therefore canonical taxonomy leaves such as `gach-op-tuong` and `gach-inax-ecocarat` are not valid listing pages in the current legacy listing system.

### Filter Derivation Dependency

- `src/lib/public-api-products.ts:getAvailableFiltersBySubcategory`
- `src/lib/public-api-products.ts:getProductTypeFiltersBySubcategory`
- These rely on real legacy `subcategories` / `subcategory_id`.
- For the 54 tile rows, that bridge does not exist yet.

### Breadcrumb / Label Dependency

- PDP pages render breadcrumb and eyebrow labels from `product.subcategories`.
- Examples:
  - `src/app/(public)/gach-op-lat/[sub]/[slug]/page.tsx`
  - `src/app/(public)/thiet-bi-bep/[sub]/[slug]/page.tsx`
  - `src/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page.tsx`
- For the tile group, after legacy migration there is no correct legacy `subcategories` row to label `gach-op-tuong` or `gach-inax-ecocarat`.

## Legacy-Dependent App Surfaces Audited

### Root Listing

- `src/app/(public)/thiet-bi-ve-sinh/page.tsx`
- `src/app/(public)/thiet-bi-bep/page.tsx`
- `src/app/(public)/vat-lieu-nuoc/page.tsx`
- `src/app/(public)/gach-op-lat/page.tsx`

Impact:
- These pages use legacy category membership directly.
- For `thiet-bi-bep` and `vat-lieu-nuoc`, this is acceptable after migration because that is the intended visible move.
- For `gach-op-lat`, root inclusion is acceptable, but subcategory semantics remain unresolved.

### Featured Blocks

- Root pages above
- `src/lib/public-api-products.ts:getFeaturedProductsByCategorySlug`

Impact:
- Same pattern as root listing.
- Not a blocker for the 15 kitchen/water rows.
- Still semantically incomplete for the 54 tile rows unless subcategory mapping is solved.

### Filter Derivation

- `src/lib/public-api-products.ts:getAvailableFilters`
- `src/lib/public-api-products.ts:getAvailableFiltersBySubcategory`
- `src/lib/public-api-products.ts:getProductTypeFiltersBySubcategory`

Impact:
- Hard blocker for `gach-op-lat` leaf semantics.
- Not a blocker for `thiet-bi-bep/chau-rua-chen` or `vat-lieu-nuoc/may-nuoc-nong`, because those target subcategories already exist.

### Admin Queries

- `src/lib/admin-product-queries.ts`
- `src/lib/product-actions.ts`

Impact:
- These will move products into the new admin root after legacy migration.
- This is a behavioral change, but it is expected rather than unsafe.
- Not a blocker if operations are aware.

### Breadcrumb / Subcategory Label

- PDP routes for all 4 public roots still render labels from `product.subcategories`.

Impact:
- Okay for the 15 kitchen/water rows after migration.
- Not okay for the 54 tile rows without a bridge for canonical taxonomy leaf labels.

## Execute Order If Proceeding

1. Execute `thiet-bi-ve-sinh -> vat-lieu-nuoc` (`12`)
2. Execute `thiet-bi-ve-sinh -> thiet-bi-bep` (`3`)
3. Hold `thiet-bi-ve-sinh -> gach-op-lat` (`54`) for a later phase

## Guardrails For Any Execute

1. Keep scope locked to exactly the `15` decision-ready rows if executing now.
2. Do not touch `product_taxon_assignments`.
3. Do not modify redirect DB rows during the legacy field migration step.
4. Snapshot before write:
   - `product_id`
   - `category_id`
   - `subcategory_id`
   - `updated_at`
5. Verify after each batch:
   - old URL `301`
   - new URL `200`
   - canonical URL stable
   - JSON-LD stable
   - breadcrumb label stable
   - search result URL stable
   - target root listing inclusion acceptable

## Final Conclusion

- The phase is now `decision-ready`.
- `15` rows are safe to migrate from a DB/runtime perspective without waiting for a broad app patch:
  - `12` water-heater rows
  - `3` kitchen rows
- `54` tile rows should **not** be migrated in the same execute step.
- Reason:
  - the canonical taxonomy leaves for tiles are not representable by the current legacy `subcategories` model or listing/filter/breadcrumb assumptions.
