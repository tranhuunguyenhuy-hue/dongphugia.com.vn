# Supabase runtime security boundary

Status: current LEO-539 target contract and sanitized provisioning evidence.

## Target identity and scope

- Project name: `dongphugia-runtime`
- Project ref: `tlmgudfhsyzayiazuugf`
- Organization: `pjouohhhwurycbqvhxzn` (`free` when reverified on
  2026-08-28)
- Region: Singapore, `ap-southeast-1`
- PostgreSQL: 17
- Environment: isolated Preview target; not Production

The Owner approval recorded in LEO-539 covers this exact project, organization,
region, and its internal security boundary. It does not authorize LEO-538 data
migration, Production-derived data, Production credentials, Production writes,
GitHub secrets or variables, Cloudflare, DNS, AWS, paid features, cutover,
merge, or changes to any legacy Supabase project.

The project was created as the second active Free project. Immediately before
creation, the organization reported plan `free`, the project cost check returned
`USD 0/month`, and the existing inventory contained one active and two inactive
projects. No existing project was paused, restored, deleted, replaced, or
modified.

## Reproducible boundary

Apply the migrations in `supabase/migrations/` in filename order. Never place a
password, token, service-role key, database URL, or credential verifier in the
migration, command line, CI log, PR, Linear, or evidence.

The boundary creates three `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS` capability roles:

- `dpg_migration`: owns `dpg_app` and `dpg_control`, may execute the explicit
  database-headroom guard, and has no policy allowing application-row access.
- `dpg_runtime`: receives bounded CRUD defaults in `dpg_app`; every actual row
  operation remains subject to RLS and an authenticated owner claim.
- `dpg_readonly`: receives `SELECT` only, has
  `default_transaction_read_only=on`, and cannot insert, update, or delete.

The Supabase-managed `postgres` administrator may explicitly `SET ROLE` to the
three capability roles. No secret-bearing login is created by LEO-539. Any
future login must be target-local, delivered without exposing its secret, and
inherit exactly one capability role under a separately reviewed consumer issue.

## Auth, RLS, and environment separation

- `dpg_app` is not in the Data API exposed-schema list.
- `anon` has neither schema usage nor table privileges.
- `authenticated` has schema usage and explicit probe-table CRUD grants only;
  RLS filters every operation by `(select auth.uid()) = owner_id`.
- UPDATE has both `USING` and `WITH CHECK`; INSERT has `WITH CHECK`.
- Both application and control tables use enabled and forced RLS.
- The application probe accepts only `environment = 'preview'`,
  `data_class = 'synthetic'`, and payloads beginning with `SYNTHETIC-`.
- The target contract fixes project name, region, Preview identity, and
  `production_*_allowed = false` through database constraints.
- `supabase/config.toml` disables automatic table exposure, public signup,
  email signup, and anonymous sign-in for reproducible local/target config.
  It contains no linked-project credential or secret.

## Free-tier and logging controls

The repository acceptance ceiling remains 350 MiB / 367,001,600 bytes, with
alerts at 250 MiB and 300 MiB. `dpg_control.free_tier_database_guard` reports
the current state, and `dpg_control.assert_free_tier_headroom()` raises a hard
error when projected size exceeds 350 MiB. The accepted target measurement was
10,456,211 bytes and `WITHIN_BUDGET`.

Every role has a distinct `application_name`, connection limit, statement
timeout, lock timeout, and idle-transaction timeout so Postgres logs are
attributable and runaway work fails closed. Platform Postgres logs were readable.
No paid Log Drain, add-on, custom domain, PITR, or upgraded compute was enabled.

Provider quotas and Fair Use behavior can change. Before a data load or runtime
enablement, reverify the organization plan and the current
[billing/Free-project limits](https://supabase.com/docs/guides/platform/billing-faq),
[database limits](https://supabase.com/docs/guides/platform/database-size),
[logging usage](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest),
and [Free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
Any unknown limit, paid requirement, 250/300 MiB alert, or projected size above
350 MiB stops the operation. Do not upgrade to avoid the stop.

## Validation evidence

The remote target passed these sanitized checks:

- Exact project name/ref/region and `ACTIVE_HEALTHY` status attested.
- Two migrations recorded; Supabase security and performance advisors returned
  no findings after hardening.
- All three capability roles were `NOLOGIN`, non-superuser, non-creator,
  non-replication, `NOINHERIT`, and `NOBYPASSRLS`.
- Authenticated-owner and runtime-owner synthetic writes succeeded inside
  rollback-only transactions.
- Cross-owner reads returned zero and cross-owner updates affected zero rows.
- Anonymous, read-only, non-synthetic, and migration-owner application writes
  failed as required.
- The 350 MiB projected-size guard failed as required; current-size validation
  passed.
- Final counts: Auth users `0`, Storage objects `0`, RLS probe rows `0`, public
  application tables `0`.
- Repository and evidence scans found no target secret or credential URL.

The validation script is `supabase/tests/leo539_security_boundary.sql`. It uses
fixed synthetic UUIDs, performs no Production access, and rolls back all probe
writes.

## Monitoring and rollback

Monitor plan/quota notices, database guard status, Postgres errors, Auth usage,
Storage usage, and project inactivity from the Free organization. Treat a Fair
Use notice, automatic pause warning, repeated runtime error, or missing current
quota evidence as a stop; no paid fallback is authorized.

Before any Production use, rollback remains deletion of only project
`dongphugia-runtime` (`tlmgudfhsyzayiazuugf`). Teardown must first confirm the
exact ref, zero Production-derived data, zero traffic/DNS dependency, and
separate Owner deletion approval. Existing Supabase projects are never part of
that rollback inventory.
