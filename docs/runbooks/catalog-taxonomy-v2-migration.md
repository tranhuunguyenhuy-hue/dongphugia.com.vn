# Runbook: Catalog Taxonomy v2 Migration

Last updated: 2026-07-04

## Purpose

This runbook describes how to migrate Dong Phu Gia catalog classification to Catalog Taxonomy v2 safely.

The migration must be executed in phases. Do not jump directly to DB writes or app rewrites.

## Golden Rules

- Do not drop legacy category fields in the first rollout.
- Do not mutate products before a read-only audit is reviewed.
- Do not import Hita products into production without a reviewed taxonomy mapping.
- Do not allow listable products to render links that cannot resolve to PDP.
- Do not redirect spam/hacked URLs to real catalog pages.
- Do not treat Hita taxonomy as Dong Phu Gia taxonomy.

## Files

- PRD: `/Users/m-ac/Projects/dongphugia/docs/prd/catalog-taxonomy-v2.md`
- Runbook: `/Users/m-ac/Projects/dongphugia/docs/runbooks/catalog-taxonomy-v2-migration.md`
- Read-only audit: `/Users/m-ac/Projects/dongphugia/scripts/db/audit-catalog-taxonomy-v2.mts`
- Default audit output:
  - `/Users/m-ac/Projects/dongphugia/scripts/output/catalog-taxonomy-v2-audit.json`
  - `/Users/m-ac/Projects/dongphugia/scripts/output/catalog-taxonomy-v2-audit.md`

## Phase 0: Preflight

Run:

```bash
git status --short --branch
npx tsc --noEmit
```

Confirm:

- You are not about to commit unrelated local changes.
- Database env exists in `.env.local`.
- No brand crawl/import is running.
- Production deploy is not in the middle of a catalog release.

## Phase 1: Read-Only Audit

Run:

```bash
npx tsx scripts/db/audit-catalog-taxonomy-v2.mts
```

Optional:

```bash
npx tsx scripts/db/audit-catalog-taxonomy-v2.mts \
  --out=scripts/output/catalog-taxonomy-v2-audit-$(date +%Y%m%d-%H%M%S).json \
  --sample-limit=100
```

The script must only execute SELECT statements inside a read-only transaction.

Review:

- category summary
- subcategory summary
- null subcategory route-risk samples
- product type distribution
- product types used across categories
- spec key frequency
- filter definition coverage
- SEO/visibility matrix
- variant SEO matrix
- source mapping coverage
- suggested target taxon candidates

Gate:

- Continue only if blockers are understood.
- Do not write DB changes from this phase.

## Phase 2: Design Taxon Seed

Prepare seed data for `catalog_taxons`.

Minimum roots:

- `thiet-bi-ve-sinh`
- `thiet-bi-bep`
- `vat-lieu-nuoc`
- `gach-op-lat`

Minimum children:

```text
thiet-bi-ve-sinh
  bon-cau
  nap-bon-cau
  lavabo
  voi-chau
  sen-tam
  bon-tam
  bon-tieu
  phu-kien-phong-tam
  guong-phong-tam
  ga-thoat-san
  may-say-tay

thiet-bi-bep
  chau-rua-chen
  voi-rua-chen
  phu-kien-chau-rua-chen
  bep-dien-tu
  bep-gas
  may-hut-mui
  may-rua-chen
  lo-nuong
  phu-kien-bep
  thiet-bi-bep-khac

vat-lieu-nuoc
  may-nuoc-nong
  loc-nuoc
  bon-chua-nuoc
  may-bom-nuoc
  phu-kien-vat-lieu-nuoc

gach-op-lat
  gach-op-lat
  gach-op-tuong
  gach-lat-nen
  gach-trang-tri
  gach-inax-ecocarat
```

Rules:

- `canonical_path` must be unique.
- Slugs must be stable.
- Draft uncertain nodes with `status='draft'`.
- Do not create taxonomy nodes just because Hita has a temporary category.

## Phase 3: Additive Schema Migration

Create tables:

- `catalog_taxons`
- `product_taxon_assignments`
- `external_taxonomy_mappings`
- `product_attribute_values`

Run migration in a transaction where possible.

After migration:

```bash
npx prisma db pull
npx prisma generate
npx tsc --noEmit
```

Gate:

- New tables exist.
- Old fields still exist.
- App still builds.
- No product rows changed.

## Phase 4: Backfill Dry-Run

Build a backfill script that:

- reads products
- proposes primary taxon
- proposes secondary taxons if needed
- marks confidence and source
- outputs report
- does not write unless `--execute` is explicitly passed

Do not use source taxonomy directly. Use these priority inputs:

1. existing DPG `category/subcategory`
2. existing `product_type/product_sub_type`
3. reviewed `external_taxonomy_mappings`
4. product name/SKU/spec heuristics
5. manual review fallback

Gate:

- `public/listable without proposed primary taxon = 0`, or every exception is intentionally hidden/search-only.
- Product count unchanged.
- Active count unchanged.
- Route-risk samples resolved or quarantined.

## Phase 5: Backfill Execute

Execute only after dry-run review.

Required checks before execute:

```bash
git status --short --branch
npx tsc --noEmit
npx tsx scripts/db/audit-catalog-taxonomy-v2.mts
```

During execute:

- Use DB transaction batches.
- Insert assignments idempotently.
- Do not update content fields.
- Do not update `is_active`.
- Do not update price/media/specs.

After execute:

```bash
npx tsx scripts/db/audit-catalog-taxonomy-v2.mts
```

Gate:

- `public/listable without primary taxon = 0`.
- `duplicate canonical path = 0`.
- no unexpected product count change.

## Phase 6: Compatibility Layer

Add app helpers:

- `getPrimaryTaxon(product)`
- `getProductCanonicalPath(product)`
- `getListingTaxonTree(categorySlug)`
- `getFilterDefinitionsForTaxon(taxon)`

Frontend migration order:

1. ProductCard URL generation.
2. Listing pages.
3. PDP breadcrumb/canonical data.
4. Sitemap generation.
5. Search results.

Gate:

- Listing does not render `/san-pham/...` fallback URLs.
- PDP still resolves existing public product paths.
- Search results link to canonical URLs.

## Phase 7: Crawler/Importer Mapping

Update normalized Hita pipeline:

```text
Hita URL/breadcrumb/category
  -> external_taxonomy_mappings
  -> catalog_taxons
  -> product_taxon_assignments
```

Import rules:

- Reviewed mapping: approved.
- Missing mapping: `needs_manual_review` or quarantine.
- Ambiguous mapping: `needs_manual_review`.
- Never create public taxonomy nodes inside a brand import run.

Gate:

- `field-policy-flags` remain explainable.
- No import can create listable product without primary taxon.
- No import can write a public URL path from raw Hita category.

## Phase 8: SEO And Redirects

Generate redirect coverage:

- old Hita-ID product slugs
- legacy `.html` URLs
- known Search Console real-product 404 URLs
- category paths replaced by canonical taxonomy paths

Do not redirect:

- casino
- xổ số
- hacked content
- random spam paths
- unrelated bot-generated URLs

Verify:

```text
old valid product URL -> 301 -> canonical product URL
canonical product URL -> 200
spam URL -> 404/410
sitemap -> canonical www URLs only
```

## Phase 9: Production Verification

Spot check:

- one category listing per root category
- products with normal price
- contact-for-price products
- discontinued products
- variant parent/child products
- inactive/search-only PDPs
- kitchen sink/faucet accessories
- INAX/EcoCarat tile products
- old URLs from Search Console

Run:

```bash
npx tsc --noEmit
npx tsx scripts/db/audit-catalog-taxonomy-v2.mts
```

Production acceptance:

- no listing-to-PDP 404 caused by taxonomy
- no unexpected active-count change
- no sitemap invalid path
- canonical URLs stable
- no raw Hita taxonomy leak into new imports

## Rollback

Because the migration is additive:

1. Revert app reads to legacy fields.
2. Disable taxonomy feature flag if present.
3. Leave new tables in place.
4. Regenerate redirects from previous artifact if needed.
5. Re-run audit before attempting another rollout.

Do not delete product rows to rollback taxonomy.

## Done Checklist

- [ ] Read-only audit generated and reviewed.
- [ ] Taxonomy seed reviewed.
- [ ] Additive schema deployed.
- [ ] Product taxon backfill dry-run reviewed.
- [ ] Product taxon backfill executed.
- [ ] App compatibility layer deployed.
- [ ] Pipeline import uses reviewed external mappings.
- [ ] Redirect artifact generated and verified.
- [ ] Sitemap verified.
- [ ] Production listing/PDP/search smoke tests pass.
