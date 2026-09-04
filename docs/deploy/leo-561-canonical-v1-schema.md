# LEO-561 canonical V1 schema contract

> **Current-authority note — 05/09/2026:** this document describes the LEO-561 implemented baseline and remains useful as historical schema evidence. Some product/commerce clauses have since been superseded by Owner-approved design contracts and must **not** be implemented from this document alone. In particular, use ADR 0017 + `docs/internal/v1-pdp-family-system-implementation-handoff.md` for the standardized Family/Colour/`retailer_package` model, ADR 0020 for current pricing fields, and ADR 0021 + `docs/internal/v1-retail-order-implementation-handoff.md` for pending shipping/install fees and staff-confirmed Retail Order totals. Historical migrations are not rewritten here; additive amendments are prepared only after global `V1 WIREFRAME APPROVED / FROZEN`.

Status: source implementation for review. This document does not authorize a
Supabase push, data import, Staging/Production mutation, application rollout,
merge, or LEO-562/564 execution.

## Authority and migration identity

`dpg_v1` is the only canonical V1 schema. Existing `dpg_app`, `public`, Prisma,
and SQLite-origin structures remain migration evidence only. The canonical DDL
is byte-for-byte identical in:

- `supabase/migrations/20260830004338_leo561_canonical_v1_schema.sql` for the
  Supabase migration chain; and
- `db/postgres-migrations/0002_leo561_canonical_v1_schema/migration.sql` for the
  deterministic manifest/checksum runner.

The migration is additive. It creates no Production data, imports no LEO-560
raw data, and changes or deletes no legacy table.

## Canonical boundaries

- Catalogue: `brands`, one Category tree with four migration-owned sector
  roots, `products`, optional Product Family/configuration membership, ordered
  manual Collections, Product-level provenance, and one database-backed
  publication-eligibility projection.
- Typed specifications: reusable definitions/options, leaf-Category policy,
  exactly one scalar typed representation or ordered multi-enum option rows,
  and database checks/triggers for type, range, option, Category integrity, and
  same-Product source provenance. Official/verified facts always name a source;
  deep sanitary requirements additionally require official manufacturer evidence.
- Price and availability: Product-owned positive VND retail price for every
  published Product and indicative availability only; no inventory or
  promotion model.
- Media and documents: content-addressed Bunny object/profile metadata in
  `media_assets`; one primary image plus ordered gallery in `product_media`;
  typed technical documents in the separate `product_documents` relation.
- Content: one typed `content_entries` aggregate, ordered closed-vocabulary
  blocks with validated JSON payloads, and normalized Product/Category/Brand
  references. Landing Pages require a non-null syntax-valid unique route and
  reject the fixed V1 route namespaces; non-Landing Content has no route.
  Application-level route allowlisting remains a later Content service concern.
- Commerce: immutable Quote Request snapshots; a separate negotiated Quote;
  token-hash-only sharing; immutable retail/converted Order snapshots; manual
  payment transactions and projected payment status; advisory-lock plus
  idempotency-key Quote conversion with one Order per Quote.
- Staff boundary: active/invited/disabled Staff Users, fixed
  Product/Sales/Marketing/Admin role assignments, and the fixed-role capability
  configuration relation. Auth integration, capability rows/helpers, grants,
  RLS policies, and services remain LEO-564 scope.

All canonical tables have RLS enabled and forced with no application policies
or grants in LEO-561. This is a fail-closed schema prerequisite, not a complete
authorization implementation.

## Legacy compatibility disposition

| Legacy evidence | Disposition in V1 | Reason |
| --- | --- | --- |
| Product SKU/model/name/slug, Brand and validated Product source evidence | Preserve as canonical after LEO-562 mapping | Stable Product identity and provenance |
| Approved Product/Family/configuration membership and MS885 gaps | Preserve as canonical after explicit mapping | Maintains the LEO-534 real-Product and no-fabrication contract |
| Legacy primary image/gallery and technical document metadata | Preserve temporarily as migration input | Must map to content-addressed Bunny references and readiness metadata |
| `categories`, `subcategories`, `product_types`, `catalog_taxons`, multiple taxon assignments | Deprecate as runtime authority | One canonical Category tree and one Product primary leaf replace parallel taxonomies |
| `products.specs`, legacy spec/filter/value tables | Deprecate as runtime authority | One typed definition/policy/value model is canonical |
| `variant_group`, `variant_group_id`, `variant_options`, `is_master` | Intentionally not carried forward | They cannot define Product identity or infer Family membership |
| `price`, `original_price`, `price_display`, sale/discount fallbacks | Intentionally not carried forward | Published V1 Product owns one explicit positive retail price |
| `blog_posts` and Blog-only workflow tables | Deprecate as runtime authority | One typed Content aggregate replaces the parallel CMS |
| Legacy `quote_requests`/`quote_items` combining request and negotiation | Preserve temporarily as migration input, then deprecate | Submitted request and negotiated Quote are distinct canonical aggregates |
| Legacy Order/Quote snapshot fields and idempotency/advisory-lock logic | Preserve as invariant, refactor into canonical tables/function | Historical correctness and retry/concurrency safety remain mandatory |
| `admin_users.role`, bcrypt sessions, legacy role hierarchy | Intentionally not carried forward | Supabase Auth plus fixed multi-role assignment is the approved boundary |
| Quote Cart persistence | Intentionally not a canonical database aggregate | V1 Quote Cart is pre-submission client/application state; Quote Request is the first immutable database authority |
| Package/BOM, Combo, inventory, promotions, custom roles, deep audit | Intentionally not carried forward | Outside LEO-561 and V1-approved scope |

LEO-562 must map or quarantine legacy evidence into this contract without
adding compatibility columns or reviving a second authority.

## Local proof

The focused integration proof applies the migration to an empty PostgreSQL
17.6 database, runs synthetic rollback-wrapped invariants, then uses two