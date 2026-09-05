# LEO-561 canonical V1 schema contract — historical implemented baseline

**Status:** Historical M1 baseline implemented by LEO-561. **Not current Product/Dòng selector authority.**  
**Current Product/Dòng authority:** ADR 0022 + `docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`  
**Implementation gate:** `V1 WIREFRAME APPROVED / FROZEN`

## Why this file now exists as historical evidence

LEO-561 completed the first isolated `dpg_v1` canonical schema before the final Owner-approved PDP/Admin selection model was known. Its migration remains valid historical evidence and must not be rewritten or deleted.

The immutable baseline DDL remains in:

- `supabase/migrations/20260830004338_leo561_canonical_v1_schema.sql`;
- `db/postgres-migrations/0002_leo561_canonical_v1_schema/migration.sql`.

Those files prove what M1 actually implemented. Future architecture changes must be additive/corrective migrations after the global wireframe freeze.

## Baseline concepts that remain current

The LEO-561 foundation still contributes valid V1 architecture:

- `dpg_v1` is the canonical V1 data authority;
- legacy `public`/Prisma/SQLite structures are migration evidence only;
- one manufacturer model = one canonical Product = one canonical PDP;
- Product has one Brand and one primary Category reference;
- Product belongs to zero or one related-product grouping;
- provenance/quarantine rules protect manufacturer facts;
- typed catalogue/spec structures and canonical Content/Commerce domains remain baseline architecture where not superseded;
- Quote/Order data is snapshot-oriented and later catalogue changes must not rewrite historical transactions.

## Product/Dòng clauses that are superseded

Do **not** implement the final selector from the historical LEO-561 Family tables alone.

The baseline created concepts including:

- `product_families`;
- `product_family_configuration_groups`;
- `product_family_memberships` with optional group assignment;
- a Product-level unique `products.sku` as the only sellable SKU identity;
- Public Family navigation eligibility based on Product-member count.

Owner later locked ADR 0022, which requires instead:

- user-facing **Dòng sản phẩm**;
- maximum one Dòng per Product;
- 1–3 ordered dependent **Trục lựa chọn**;
- custom Axis labels with optional semantic type;
- dependent **Lựa chọn** paths;
- one-to-many exact sellable SKUs under a Product where required;
- terminal path mapping to real Product and/or exact sellable SKU;
- Product-changing choice changes canonical PDP;
- SKU-only choice remains on the same PDP;
- selector eligibility based on valid selectable terminal paths;
- no Family-selector-specific `retailer_package` target.

## Migration rule

Historical migrations are immutable.

After final wireframe freeze, implementation should:

1. audit the current `dpg_v1` baseline;
2. propose the exact additive schema delta for Product SKUs + Dòng/Axis/Option;
3. receive Owner/Coordinator approval for material schema/service choices;
4. add a new migration rather than editing LEO-561 history;
5. extend RLS/services/importer/media/backup contracts;
6. validate in isolated Preview before any Production activation.

At the 05/09/2026 architecture audit, isolated Preview `dongphugia-runtime` had the M1/M2 schema but zero canonical rows in the Product/Family catalogue tables, so no live V1 catalogue dataset currently requires destructive transformation.

## Current documents to read

Before any future Product/Dòng implementation read:

- `docs/adr/0022-v1-product-line-axis-option-family-model.md`;
- `docs/internal/v1-product-line-axis-option-m0-m2-impact-audit.md`;
- `docs/internal/v1-pdp-family-system-implementation-handoff.md`;
- `docs/internal/v1-family-admin-pdp-selector-linkage.md`;
- `docs/internal/v1-admin-operations-implementation-handoff.md`;
- `docs/internal/v1-wireframe-freeze-implementation-index.md`.

ADR 0017 is superseded historical design evidence only.

## Gate

This file documents history; it does not authorize a Supabase push, import, merge or application rollout.

No implementation until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
