# Migration allowlist from Supabase production

Status: plan only. Do not export, dump, or connect to Supabase until a separate
approval is given.

## Principles

- Preserve primary keys.
- Preserve sequence values after import.
- Do not transform data during the first migration pass.
- Do not migrate live session state.
- Keep Supabase production read-only for export windows unless PM approves a
  final-delta procedure.
- Never print connection strings, passwords, or service-role keys.

## Initial allowlist

These tables are eligible for a future approved data-only migration because they
are part of catalogue/content/admin runtime state.

| Group | Tables | Notes |
| --- | --- | --- |
| Catalogue lookup | `brands`, `categories`, `subcategories`, `product_types`, `product_sub_types`, `colors`, `origins`, `materials`, `product_features`, `filter_definitions`, `spec_definitions`, `spec_options` | Preserve IDs because products and filters reference them. |
| Catalogue products | `products`, `product_images`, `product_relationships`, `product_feature_values`, `product_secondary_subcategories`, `product_variant_groups`, `product_descriptions`, `product_documents`, `product_package_items`, `product_source_mappings`, `product_spec_values` | Preserve IDs, SKUs, slugs, relation rows, and sequence values. |
| Taxonomy v2 | `catalog_taxons`, `product_taxon_assignments`, `external_taxonomy_mappings`, `product_attribute_values` | Preserve IDs and unique paths/keys. |
| Content | `blog_categories`, `blog_tags`, `blog_posts`, `blog_post_tags`, `banners`, `partners`, `projects`, `redirects` | Preserve published/draft state. |
| Admin identity | `admin_users` | Contains password hashes; migrate only under secret-handling approval. Do not seed a new admin account as part of bootstrap. |
| Admin audit | `audit_logs` | Optional but recommended for continuity. May contain sensitive metadata; treat as restricted. |
| Commerce / lead data | `customers`, `quote_requests`, `quote_items`, `orders`, `order_items` | Contains PII and business records; requires write-freeze/final-delta plan. |

## Explicit exclusions for first pass

| Table | Decision | Reason |
| --- | --- | --- |
| `admin_sessions` | Exclude | Session state should not be migrated. Users should log in again after cutover. |
| `crawl_product_snapshots` | Exclude for now | Large/operator history; not required for staging runtime. |
| `crawl_import_decisions` | Exclude for now | Depends on crawl snapshots; not required for staging runtime. |
| `crawl_runs` | Exclude for now | Operator metadata; excluding it avoids orphaning partial crawl history. |

## Future approved dump shape

Use a data-only custom-format dump with an explicit table list. This preserves
primary-key values and includes sequence `setval` statements when restored.

Command shape only, not for execution in this gate:

```bash
pg_dump \
  --format=custom \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=public.brands \
  --table=public.categories \
  --table=public.subcategories \
  --table=public.product_types \
  --table=public.product_sub_types \
  --table=public.colors \
  --table=public.origins \
  --table=public.materials \
  --table=public.product_features \
  --table=public.filter_definitions \
  --table=public.spec_definitions \
  --table=public.spec_options \
  --table=public.products \
  --table=public.product_images \
  --table=public.product_relationships \
  --table=public.product_feature_values \
  --table=public.product_secondary_subcategories \
  --table=public.product_variant_groups \
  --table=public.product_descriptions \
  --table=public.product_documents \
  --table=public.product_package_items \
  --table=public.product_source_mappings \
  --table=public.product_spec_values \
  --table=public.catalog_taxons \
  --table=public.product_taxon_assignments \
  --table=public.external_taxonomy_mappings \
  --table=public.product_attribute_values \
  --table=public.blog_categories \
  --table=public.blog_tags \
  --table=public.blog_posts \
  --table=public.blog_post_tags \
  --table=public.banners \
  --table=public.partners \
  --table=public.projects \
  --table=public.redirects \
  --table=public.admin_users \
  --table=public.audit_logs \
  --table=public.customers \
  --table=public.quote_requests \
  --table=public.quote_items \
  --table=public.orders \
  --table=public.order_items \
  --file=<approved-local-dump-path> \
  "$SUPABASE_PRODUCTION_DIRECT_URL"
```

Restore shape only:

```bash
pg_restore \
  --data-only \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --dbname="$SELF_HOSTED_STAGING_DIRECT_URL" \
  <approved-local-dump-path>
```

## Final-delta groups

High-risk write tables that need a final freeze or delta replay:

- `orders`
- `order_items`
- `quote_requests`
- `quote_items`
- `customers`
- `admin_users`
- `audit_logs`
- content/admin mutation tables if editors continue working during migration

Recommended first staging rehearsal: perform migration from a read-only snapshot
of production data, then run reconciliation. Do not cut over writes until the
final-delta procedure has passed at least once.
