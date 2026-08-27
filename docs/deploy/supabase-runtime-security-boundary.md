# Supabase runtime security boundary

Status: reproducible LEO-539 target contract and operating procedure. Dated,
sanitized provisioning evidence lives in `../ops/project-current-state.md`.

## Target identity and scope

- Project name: `dongphugia-runtime`
- Region: Singapore, `ap-southeast-1`
- PostgreSQL: 17
- Environment: isolated Preview target; not Production

The Owner approval recorded in LEO-539 covers this exact project, organization,
region, and its internal security boundary. It does not authorize LEO-538 data
migration, Production-derived data, Production credentials, Production writes,
GitHub secrets or variables, Cloudflare, DNS, AWS, paid features, cutover,
merge, or changes to any legacy Supabase project.

## Reproducible boundary

Apply the migrations in `supabase/migrations/` in filename order. Never place a
password, token, service-role key, database URL, or credential verifier in the
migration, command line, CI log, PR, Linear, or evidence.

The boundary creates three `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS` capability roles:

- `dpg_migration`: owns `dpg_app` and `dpg_control`, may execute the explicit
  database-headroom guard, and has no policy allowing application-row access.
- `dpg_runtime`: receives explicit per-table CRUD only after forced RLS,
  policies, and the size guard exist; every row operation remains subject to
  RLS and an authenticated owner claim.
- `dpg_readonly`: receives `SELECT` only, has
  `default_transaction_read_only=on`, and cannot insert, update, or delete.

The boundary also creates one target-local `LOGIN` identity per capability:
`dpg_migration_login`, `dpg_runtime_login`, and `dpg_readonly_login`. Each is
`NOINHERIT`, has the same restricted attributes as its capability, and is a
member of exactly one capability role. PostgreSQL generates the initial
passwords inside the target; the migration never returns them and no operator
retrieves them. Before first consumer use, reset only that target-local
credential through an approved secret-delivery path, then explicitly `SET ROLE`
to the single granted capability.

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
error when projected size exceeds 350 MiB. The current application write surface
also has a `BEFORE INSERT OR UPDATE` size-guard trigger. Default privileges grant
no future application-table access: every future table must receive forced RLS,
explicit policies and grants, plus an equivalent guard trigger in one reviewed
migration before it is usable.

Every login identity has a distinct `application_name`, connection limit,
statement timeout, lock timeout, and idle-transaction timeout so Postgres logs
are attributable and runaway work fails closed. The read-only login also starts
transactions read-only. No paid Log Drain, add-on, custom domain, PITR, or
upgraded compute is required by this contract.

Provider quotas and Fair Use behavior can change. Before a data load or runtime
enablement, reverify the organization plan and the current
[billing/Free-project limits](https://supabase.com/docs/guides/platform/billing-faq),
[database limits](https://supabase.com/docs/guides/platform/database-size),
[logging usage](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest),
and [Free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
Any unknown limit, paid requirement, 250/300 MiB alert, or projected size above
350 MiB stops the operation. Do not upgrade to avoid the stop.

## Validation procedure

Run `supabase/tests/leo539_security_boundary.sql` against only the positively
identified LEO-539 target. It asserts role attributes and membership, target
identity, empty Auth and Storage state, anonymous/read-only/migration-owner
write denial, non-synthetic rejection, authenticated owner isolation, and the
database hard stop. It uses fixed synthetic UUIDs and rolls back every probe
write. Then run Supabase security and performance advisors and record only
sanitized, dated results in the operational snapshot.

## Monitoring and rollback

Monitor plan/quota notices, database guard status, Postgres errors, Auth usage,
Storage usage, and project inactivity from the Free organization. Treat a Fair
Use notice, automatic pause warning, repeated runtime error, or missing current
quota evidence as a stop; no paid fallback is authorized.

Before any Production use, rollback remains deletion of only project
`dongphugia-runtime`. Teardown must first confirm its exact ref from the current
operational snapshot, zero Production-derived data, zero traffic/DNS dependency,
and separate Owner deletion approval. Existing Supabase projects are never part
of that rollback inventory.
