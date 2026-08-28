# LEO-541 Supabase runtime API

Status: source contract plus bounded isolated-target rollout evidence. This
document does not authorize creating Auth identities, applying further
RLS/privilege changes, activating Production, merging the PR, or mutating any
other runtime.

## Boundary

The implementation uses the approved `dongphugia-runtime` target identity in
`ap-southeast-1`, but the target must be revalidated immediately before any
rollout. The public static build remains fixture/artifact based and does not
import this client or require a database at render time. Admin and Publishing
adapters may consume the transport contract in
`src/lib/supabase-runtime-contract.ts` later; this issue does not wire those
workflows to the new backend.

The migration adds nullable `owner_id` columns to orders and quote requests.
Existing rows with no owner remain inaccessible. This is deliberate:
the migration never guesses ownership or rewrites existing data. It adds the
immutable quote-item snapshot columns missing from the reduced-runtime schema.

All RPC functions are `SECURITY INVOKER`. The Edge Function creates a
Supabase client with the caller's bearer token, verifies the user through Auth,
and invokes an allowlisted public RPC. The tables remain in private schema
`dpg_app`; only the RPC functions are executable by `authenticated`. Anonymous,
service-role, and direct table access are not granted by this contract.

## Edge endpoints

The deployed base URL is intentionally not committed. Replace
`<project-url>` only in an approved runtime configuration:

| Endpoint | Operations |
| --- | --- |
| `POST /functions/v1/commerce-orders` | create an order; requires `Idempotency-Key` |
| `GET /functions/v1/commerce-orders` | list the caller's orders; `?id=` reads one |
| `PATCH /functions/v1/commerce-orders` | update caller-owned status/payment/note/totals; requires `Idempotency-Key` |
| `DELETE /functions/v1/commerce-orders?id=<id>` | delete one caller-owned order; requires `Idempotency-Key` |
| `POST /functions/v1/commerce-quotes` | create a quote with immutable product snapshots; requires `Idempotency-Key` |
| `GET /functions/v1/commerce-quotes` | list the caller's quotes; `?id=` reads one |
| `PATCH /functions/v1/commerce-quotes` | update caller-owned status/message; requires `Idempotency-Key` |
| `DELETE /functions/v1/commerce-quotes?id=<id>` | delete one caller-owned quote; requires `Idempotency-Key` |

Every response includes a request ID. Errors contain only a stable code and
request ID; database messages, SQL, headers, credentials, and row dumps are not
returned or logged. `Idempotency-Key` is scoped by authenticated owner and
operation. Reusing a key with a different canonical JSON request is rejected.

## RPC functions

The migration adds the following public, authenticated-only functions:

- `runtime_order_create`, `runtime_order_get`, `runtime_order_list`,
  `runtime_order_update`, `runtime_order_delete`
- `runtime_quote_create`, `runtime_quote_get`, `runtime_quote_list`,
  `runtime_quote_update`, `runtime_quote_delete`

Create/update/delete calls use one PostgreSQL transaction. Idempotency record,
resource mutation, and sanitized audit event commit together or roll back
together. Product price and visibility are re-read inside the transaction;
client-submitted names, SKUs, and prices are never authoritative for orders.
Quote lines store the current product identity and commerce snapshot at create
time.

Per-resource and per-idempotency-key `pg_advisory_xact_lock` calls serialize
competing writes. A committed duplicate returns the stored safe response; an
in-flight or mismatched request fails without creating another resource.

## Validation and rollback

After an Owner-approved isolated target migration, run the following only
against that positively identified target:

```text
supabase/tests/leo541_runtime_api.sql
```

Run the two-session procedure in
`supabase/tests/leo541_concurrency.sql` for the advisory-lock acceptance. The
script must prove authenticated Edge-to-RPC, anonymous denial, cross-owner
denial, representative order/quote CRUD, duplicate replay, one transition
under concurrency, and zero partial rows after a rejected order.

Rollback before activation is
`docs/deploy/leo541-runtime-api-rollback.sql`. It fails closed unless the exact
isolated target is identified and no committed LEO-541 runtime rows or quote
snapshots exist. A current encrypted backup and successful restore rehearsal
remain mandatory before applying the migration or rollback. No Production
database, Production write target, Auth credential, DNS, AWS, Cloudflare
routing, paid tier, or Production deployment action is part of LEO-541.

## Isolated-target evidence (2026-08-28)

Owner-authorized migration `leo541_runtime_api` was applied only to
`dongphugia-runtime` in `ap-southeast-1`. `commerce-orders` and
`commerce-quotes` were deployed at version 1 with JWT verification enabled.
The rollback-wrapped SQL fixture passed owner-bound order/quote CRUD,
idempotent replay, mismatched-key rejection, cross-owner denial, audit writes,
invalid-write rollback, and the public-product read boundary. Direct anonymous
HTTP requests to both Edge endpoints returned 401.

The target has zero Auth users. Creating an identity or retrieving/minting a
credential was not authorized, so authenticated HTTP Edge-to-RPC acceptance is
blocked. The connector serializes target SQL calls; all six mutating RPCs were
verified live as invoker-only and containing `pg_advisory_xact_lock`, but a
valid two-session RPC contention timing result is also blocked. Neither gate is
recorded as PASS.

The static artifact regression passed and the LEO-541 contract adds no
Supabase client or RPC import to `public-static-build.mts`. The existing static
artifact builder still reads its approved source database at build time; the
generated public artifact does not gain a Supabase runtime database dependency.
