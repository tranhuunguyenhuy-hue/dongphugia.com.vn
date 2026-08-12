# Staging database bootstrap runbook

This change set prepares a PostgreSQL bootstrap for the Supabase project
`dongphugia-staging`. It is intentionally local-only and must not be executed
until a separate approval is given.

## Artefacts

- `001_schema_from_prisma.sql` — schema generated from `prisma/schema.prisma`
  at commit `348f51a571749db8463b39b2d77cb2d42a751aaa`.
- `002_seed_synthetic_stg_demo.sql` — idempotent synthetic seed data only.
- `003_rehome_synthetic_stg_demo_to_canonical.sql` — bounded repair for an
  existing staging database created by the earlier seed revision.
- `004_align_synthetic_product_contract.sql` — bounded Product contract repair
  for the three staging fixtures used by runtime structured-data acceptance.
- `RLS_FINDINGS.md` — read-only review of Supabase client/RPC usage and RLS
  implications.
- `checksums.sha256` — SHA-256 checksums for review before any execution.

## Strict scope

- Staging Supabase only.
- No production database.
- No admin account seed.
- No customer, quote, order, session, password, key, or production content.
- No connection strings committed to the repository.
- Executing these SQL artefacts authorizes no GitHub workflow, GHCR, Coolify,
  DNS, Cloudflare, or AWS mutation; each remains a separate approval gate.

## Preflight before future execution

Stop if any item fails.

1. Confirm the Supabase project is the approved staging project:
   - name: `dongphugia-staging`
   - region: Singapore
   - project ref: provided by PM for staging only
2. Confirm `STAGING_DATABASE_URL` and `STAGING_DIRECT_URL` both point to that
   staging project ref.
3. Confirm neither connection string contains the production project ref.
4. Confirm the target database is empty enough for a first bootstrap:
   - no existing app tables in `public`;
   - no existing `_prisma_migrations` state that would conflict with this
     baseline;
   - no customer/order/admin/session data.
5. Confirm checksums match `checksums.sha256`.
6. Confirm the SQL files contain no connection strings, passwords, Supabase
   keys, or service-role keys.
7. Confirm the executor is using a direct staging database connection suitable
   for DDL.
8. Confirm a staging-only rollback window is acceptable before any app deploy.

## Recommended execution shape after separate approval

Use `psql` with `ON_ERROR_STOP=1` and `--single-transaction` so the schema and
seed files are one atomic unit. Any SQL error in either file must roll back the
entire bootstrap.

Do not use shell debug output (`set -x`). Do not print the connection string.
Pass the approved staging connection string through a local secret mechanism
chosen at execution time, not through a committed file or copied log.

Recommended command shape:

```bash
psql \
  --set=ON_ERROR_STOP=1 \
  --single-transaction \
  --file=docs/deploy/staging-db-bootstrap/001_schema_from_prisma.sql \
  --file=docs/deploy/staging-db-bootstrap/002_seed_synthetic_stg_demo.sql \
  "$STAGING_DIRECT_URL"
```

The command shape above is for a future approved execution gate only. The
`STAGING_DIRECT_URL` value must not be echoed, committed, or pasted into a
report.

For an already bootstrapped staging database, do not rerun the empty-database
schema bootstrap. First confirm that the project is the approved staging
project and that the only intended repair scope is the three fixed
`STG-DEMO-*` SKUs. Then run only the repair file in one transaction:

```bash
psql \
  --set=ON_ERROR_STOP=1 \
  --single-transaction \
  --file=docs/deploy/staging-db-bootstrap/003_rehome_synthetic_stg_demo_to_canonical.sql \
  "$STAGING_DIRECT_URL"
```

The repair must be followed by aggregate checks proving three synthetic
products are attached to `thiet-bi-ve-sinh` or `thiet-bi-bep`, with no row or
credential output. It must not be used against production or a database whose
scope has not been revalidated.

For an existing staging database whose synthetic products predate the Product
contract fixtures or redirect-target fixtures, revalidate the same staging-only
gates and run only the bounded repair:

```bash
psql \
  --set=ON_ERROR_STOP=1 \
  --single-transaction \
  --file=docs/deploy/staging-db-bootstrap/004_align_synthetic_product_contract.sql \
  "$STAGING_DIRECT_URL"
```

The repair aligns exactly `STG-DEMO-TBVS-001`, `STG-DEMO-TBVS-002`, and
`STG-DEMO-TBVS-003`, then creates or aligns twelve
`STG-DEMO-REDIRECT-*` targets below the staging-only
`vat-lieu-nuoc/may-nuoc-nong` taxonomy. It fails and rolls back unless all
fifteen synthetic fixtures validate. It must not be
combined with a production or catalogue-wide data change.

## Post-execution checks for a future gate

Run read-only checks against staging only:

- table count matches the reviewed bootstrap;
- index and foreign-key counts match the reviewed bootstrap;
- synthetic products exist with SKU prefix `STG-DEMO-`;
- the synthetic Product contract matrix contains one priced in-stock product,
  one priced out-of-stock product, and one Contact for Quote product;
- twelve synthetic redirect targets exist below
  `vat-lieu-nuoc/may-nuoc-nong` for the reviewed runtime redirect registry;
- admin/user/order/customer/session tables are empty;
- public app pages can read synthetic catalogue/blog data;
- write flows are not exercised until runtime secrets and admin setup are
  separately approved.

## Rollback plan

Expected rollback if the approved `psql --single-transaction` execution fails:

1. Do not retry blindly.
2. Capture the first SQL error with secrets redacted.
3. Confirm `psql` exited non-zero.
4. Because `ON_ERROR_STOP=1` and `--single-transaction` are required, the entire
   schema + seed bootstrap should have rolled back.
5. Re-check that no app tables were created.

If the bootstrap was partially committed by manual execution outside the
approved execution model:

1. Stop all staging app/database work.
2. Confirm again that the project ref is staging, not production.
3. Confirm no non-synthetic data exists.
4. For a dedicated empty staging DB, reset the `public` schema or recreate the
   staging database from the Supabase dashboard/SQL editor using an approved
   staging-only reset plan.
5. Do not drop schemas or tables in any project whose ref is not the approved
   staging ref.

Because this bootstrap is for a newly created staging database, rollback is
intended to be destructive only within the empty staging project and only after
explicit approval.
