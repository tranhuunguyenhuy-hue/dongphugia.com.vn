# SEO, Taxonomy, UX/System Debt Audit - 2026-07-08

## Scope

This audit was run after the project shifted focus away from Hita crawl/import work and toward stabilizing website quality, SEO, taxonomy, and system debt.

Branch used:

- `codex/handoff-normalized-pipeline-cleanup`

## Changes Implemented

### 1. Sitemap SEO Policy Fix

Product sitemap generation now follows the public SEO policy instead of `is_active`.

Current product sitemap eligibility:

- `publication_status = public`
- `pdp_visibility = public`
- `sitemap_include = true`
- `seo_indexing != noindex`

Impact:

- Production had 4 product sitemap shards because the old logic counted active products only.
- Local DB audit after the fix produces 7 product sitemap shards because SEO-eligible public PDPs are broader than `is_active`.
- This aligns with the agreed model: products can be hidden from listings while still having public/indexable PDPs.

Files:

- `src/app/sitemap.xml/route.ts`
- `src/app/api/sitemap/[id]/route.ts`
- `src/app/sitemap_static.xml/route.ts`
- `next.config.ts`

### 2. Prisma Taxonomy v2 Schema Sync

`prisma/schema.prisma` was synced with the live DB so taxonomy v2 models are available to application code and future scripts.

Confirmed models now present:

- `catalog_taxons`
- `product_taxon_assignments`
- `external_taxonomy_mappings`
- `product_attribute_values`

Guardrail:

- This was a schema sync only.
- No product data, taxonomy assignments, redirects, or category mappings were mutated.

### 3. Wrong Subcategory PDP Redirect Fix

Before the fix, PDP lookup ignored the `[sub]` URL segment. A wrong URL such as:

```text
/thiet-bi-ve-sinh/sai-sub/chau-rua-lavabo-dat-ban-toto-lt367cr-lt367ct
```

could still render `200` if the slug matched a product in the category.

That created duplicate-content risk and route confusion because any arbitrary subcategory segment could resolve to the same PDP.

After the fix:

- PDP routes resolve the real product subcategory.
- If the requested `[sub]` does not match the product's actual subcategory, the page returns a permanent redirect to the canonical URL.
- Metadata, breadcrumb JSON-LD, visible breadcrumb links, and recently-viewed URL now use the resolved product subcategory.

Files:

- `src/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page.tsx`
- `src/app/(public)/thiet-bi-bep/[sub]/[slug]/page.tsx`
- `src/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page.tsx`
- `src/app/(public)/gach-op-lat/[sub]/[slug]/page.tsx`

Verification:

- `npx tsc --noEmit`: pass
- `npm run build`: pass before commit
- Local runtime sample:
  - wrong TBVS subcategory -> `308 Permanent Redirect`
  - correct TBVS URL -> `200`
  - wrong kitchen subcategory -> `308 Permanent Redirect`
  - correct kitchen URL -> `200`

## Current Production Impact After Deploy

Expected changes once deployed:

- More public/indexable product PDPs appear in sitemap shards.
- Static sitemap uses canonical `www` base URL consistently.
- Wrong-subcategory PDP URLs stop rendering duplicate pages and redirect to the canonical product URL.
- No expected change to listing order, product data, prices, images, variant UI, category assignments, or crawl/import pipeline.

## Open UX/System Debt Findings

### P1 - Search Still Uses `is_active`

File:

- `src/app/(public)/tim-kiem/page.tsx`

Issue:

- Search currently filters by `is_active: true`.
- This conflicts with the visibility model where inactive/low-priority products can be hidden from listings but still public and searchable.
- DB audit showed many `search_visibility = visible` products are not active, so search under-represents the public catalog.

Recommended next fix:

- Replace `is_active: true` with the search visibility policy:
  - `publication_status = public`
  - `pdp_visibility = public`
  - `search_visibility = visible`
- Build search result URLs from canonical taxonomy/product path instead of raw legacy category/subcategory fields.

### P2 - ProductCard URL Fallback Is Fragile

File:

- `src/components/ui/product-card.tsx`

Issue:

- `ProductCard` falls back to:

```ts
`${basePath}/${slug}/${product.slug}`
```

- This is safe only when callers pass the right `href`, `product.url`, or subcategory pattern.
- With taxonomy v2 and cross-root products, URL building should not be scattered across components.

Recommended next fix:

- Prefer one canonical product URL helper.
- Make product listing/search APIs return `url` consistently.
- Treat component-level fallback as last resort only.

### P2 - Public Listing/Home Blocks Still Mix `is_active` With New Visibility Fields

Files:

- `src/lib/public-api-products.ts`
- `src/app/(public)/thiet-bi-ve-sinh/page.tsx`
- `src/app/(public)/thiet-bi-bep/page.tsx`
- `src/app/(public)/vat-lieu-nuoc/page.tsx`
- `src/app/(public)/gach-op-lat/page.tsx`

Issue:

- Some listing/home sections still intentionally use `is_active`.
- This may be correct for merchandising, but the semantics are now blurred because `is_active` is no longer the full public visibility model.

Recommended next fix:

- Define helper policies:
  - `PUBLIC_PDP_WHERE`
  - `PUBLIC_SEARCH_WHERE`
  - `PUBLIC_LISTING_WHERE`
  - `HOME_MERCHANDISING_WHERE`
- Replace scattered inline logic with those helpers.

### P2 - PDP Route Logic Is Duplicated Across Four Categories

Files:

- Four category PDP page files under `src/app/(public)/*/[sub]/[slug]/page.tsx`

Issue:

- SEO fixes, breadcrumbs, JSON-LD, recently-viewed URL, product data fetch, and variant rendering are duplicated.
- Every canonical/visibility fix currently requires four similar edits.

Recommended next fix:

- Extract a shared product detail page shell/helper while keeping category-specific constants.
- This is not urgent, but it will reduce regression risk.

### P3 - Legacy Static Sitemap API Route Remains

File:

- `src/app/api/sitemap_static/route.ts`

Issue:

- The rewrite from `/sitemap_static.xml` to `/api/sitemap_static` was removed, but the old API route still exists.
- It contains stale static URLs such as `/gioi-thieu`.

Recommended next fix:

- Either delete the legacy API route or redirect it to `/sitemap_static.xml`.

### P3 - Next.js Middleware Deprecation Warning

Issue:

- Next.js 16 build warns that the `middleware` file convention is deprecated and recommends `proxy`.

Recommended next fix:

- Schedule a focused routing middleware/proxy migration after SEO and visibility fixes are stable.

## Recommended Next Order

1. Fix public search visibility and canonical result URLs.
2. Centralize product URL construction so ProductCard/search/listing cannot drift.
3. Centralize visibility policy helpers.
4. Refactor duplicated PDP route logic.
5. Remove or redirect legacy static sitemap API route.
6. Plan Next.js middleware-to-proxy migration.

