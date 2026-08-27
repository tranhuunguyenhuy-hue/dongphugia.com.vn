# Product/Family preservation contract

Status: current non-regression contract for LEO-534. The executable source is
[`scripts/quality/product-family-preservation-contract.ts`](../../scripts/quality/product-family-preservation-contract.ts).
It preserves completed Product/Family work while Phase 2 remains paused; it
does not add Product/Family behavior or authorize data access or mutation.

## Contract identity and downstream use

The contract identifier is `dongphugia:product-family-preservation:v1`.
Export, restore, static-build, and parity work must validate their candidate
against this contract before treating Product/Family output as equivalent.
Use the exported `assertProductFamilyPreservationContract` for repository
schema/migration inputs and `validateMs885PreservationSnapshot` for an
exported or restored data snapshot. Both validators are read-only.

The protected PostgreSQL origin is Baseline v1 plus migration
`0001_ms885_normalized_family/migration.sql`. The supporting identifiers are
`manifest.json`, `checksums.sha256`, `schema-manifest.json`, and
`schema-drift-allowlist.json`. The Family migration checksum is pinned in the
executable contract; unrelated future migrations may be added without
changing these completed Product/Family identifiers.

## Product and Family semantics

- A Product is an existing independent commercial/PDP leaf identified by its
  own Product identity (`products.id` and `products.sku`).
- A Product Family is a validated group of existing Product leaves. It creates
  no Product, combination, family-level commerce state, price, SEO state, or
  visibility state.
- A Configuration Group is a normalized grouping inside one Product Family
  based only on an approved distinction. It creates no Product or combination.
- Family Membership is an explicit relation from an existing Product to one
  Family and one Configuration Group. It does not reuse or rewrite legacy
  `products.variant_group` or `products.variant_group_id` semantics.
- Package/BOM and typed Product relationships remain separate from Family
  membership and are not part of this contract.
- Catalogue gaps are explicit non-Product records; they are not Product
  surrogates and do not carry commercial data.

The schema must retain the Family membership uniqueness constraint on
`(family_id, product_id)`, the composite same-Family Configuration Group
relation on `(configuration_group_id, family_id)`, and the relation to the
existing `products(id)` row. Product-owned identity, commercial, PDP, and
publication fields remain outside the Family migration's write set.

## Accepted MS885 preservation facts

The accepted MS885 contract has 20 canonical models in three Configuration
Groups: `ecowasher` = 2, `electronic-washlet` = 15, and `soft-close` = 3.
The accepted current data has 18 existing memberships with the current-row
distribution 2 / 13 / 3. The only catalogue gaps are `MS885DW4#XW` and
`MS885DW18#XW`; no Product rows or memberships may be fabricated for them.
`MS885DE6#XW` remains unresolved/deferred outside the canonical Family.

The validator requires the exact approved member set, group assignment,
membership count, current-row distribution, gap set, and deferred set. It
fails closed on additions, omissions, reassignment, duplicate membership,
gap-to-membership conversion, or a deferred member entering the Family.

## Non-regression boundary

The focused test checks the executable migration checksum, migration manifest,
protected schema tables/index/constraints, Product identity columns, Prisma
Family models, approved MS885 migration rows, no Product-table writes, and no
legacy variant-group rewrite. It also perturbs in-memory migration/schema/data
fixtures and proves that the contract fails; canonical files and data are not
modified by the test.

Run:

```sh
npx vitest run scripts/quality/product-family-preservation-contract.test.ts
```

This contract is a preservation gate for LEO-538, LEO-536, and parity work. It
does not resume Phase 2, complete catalogue gaps, seed data, change runtime
behavior, or authorize Production.
