# Staging DB bootstrap validation

Generated at local review time for commit `348f51a571749db8463b39b2d77cb2d42a751aaa`. No remote database connection was used.

## Results

- Prisma schema validate: PASS
- Stored schema SQL matches fresh Prisma diff output: PASS
- Table/index/FK counts match fresh Prisma schema diff: PASS
- Expected counts preserved: PASS
- Seed has internal standalone `BEGIN`/`COMMIT`: PASS
- Seed has `DROP`/`TRUNCATE`/`DELETE` statements: PASS
- Seed inserts into admin/customer/order/quote/session/audit tables: PASS
- Seed uses synthetic `STG-DEMO-*` data: PASS
- Runbook uses `psql --single-transaction`: PASS
- Runbook uses `ON_ERROR_STOP=1`: PASS
- Runbook warns against shell debug / `set -x`: PASS
- Artefacts contain actual connection string or obvious secret assignment value: PASS
- Fresh seed attaches all three synthetic products to canonical public category slugs: PASS
- Existing-staging repair dry-run uses six parent-qualified statements in one transaction: PASS

## Counts

| Metric | Stored schema SQL | Fresh Prisma diff |
| --- | ---: | ---: |
| Tables | 46 | 46 |
| Indexes | 176 | 176 |
| Unique indexes | 42 | 42 |
| ALTER TABLE statements | 56 | 56 |
| Foreign keys | 56 | 56 |
| Lines | 1503 | 1496 |
| Bytes | 55265 | 54846 |

## Tables

- `banners`
- `colors`
- `origins`
- `product_images`
- `products`
- `product_relationships`
- `redirects`
- `quote_requests`
- `quote_items`
- `customers`
- `blog_categories`
- `blog_post_tags`
- `blog_posts`
- `blog_tags`
- `partners`
- `projects`
- `brands`
- `categories`
- `filter_definitions`
- `materials`
- `order_items`
- `orders`
- `product_feature_values`
- `catalog_taxons`
- `product_taxon_assignments`
- `external_taxonomy_mappings`
- `product_attribute_values`
- `product_features`
- `subcategories`
- `product_secondary_subcategories`
- `admin_users`
- `admin_sessions`
- `audit_logs`
- `crawl_import_decisions`
- `crawl_product_snapshots`
- `crawl_runs`
- `product_descriptions`
- `product_documents`
- `product_package_items`
- `product_source_mappings`
- `product_spec_values`
- `product_sub_types`
- `product_types`
- `product_variant_groups`
- `spec_definitions`
- `spec_options`
