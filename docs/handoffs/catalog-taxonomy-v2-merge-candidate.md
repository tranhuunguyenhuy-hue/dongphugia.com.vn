# Catalog Taxonomy v2 Merge Candidate

- Branch: `codex/catalog-taxonomy-v2-schema-sync`
- Head: `5510fcd` `merge(catalog): sync taxonomy schema branch with production canonical UI`

## Main commits

- `0f6f0f1` `feat(catalog): add taxonomy v2 schema and seed baseline taxons`
- `bbf2378` `feat(catalog): harden taxonomy v2 schema metadata`
- `78b5612` `feat(catalog): backfill taxonomy v2 primary assignments`
- `1c3ba90` `feat(catalog): add taxonomy-aware canonical paths and cross-root redirects`
- `5510fcd` `merge(catalog): sync taxonomy schema branch with production canonical UI`

## Completed

- Taxonomy v2 additive schema is in place.
- Taxonomy assignment backfill is complete.
- Cross-root assignment plus redirect runtime is in place.
- Taxonomy-aware canonical product paths are active.
- Sitemap selection follows SEO/public visibility rule instead of `is_active` only.

## Runtime QA passed

- Old cross-root URLs return `301`.
- New canonical URLs return `200`.
- Canonical, JSON-LD, and breadcrumb resolve to the taxonomy-aware target path.
- Sitemap samples include the new canonical URLs.
- Listing and search product links resolve to valid PDP URLs.

## Not done

- Legacy `category_id` / `subcategory_id` migration for the remaining 69 cross-root cases is not started in this branch.

## Known constraints

- Local preview and full build require DB env (`DATABASE_URL`).
- Scratch file `scripts/db/plan-catalog-taxonomy-v2-legacy-migration.mts` is intentionally uncommitted.

## Status

- Ready for review
- Ready for PR
- Next phase: legacy category migration for 69 cross-root cases
