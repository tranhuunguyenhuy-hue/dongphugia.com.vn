# LEO-541 Supabase runtime API

Status: source contract only. This document does not authorize applying the
migration, creating Auth identities, changing RLS/privileges, deploying an Edge
Function, or activating any runtime.

## Boundary

The implementation uses the approved `dongphugia-runtime` target identity in
`ap-southeast-1`, but the target must be revalidated immediately before any
rollout. The public static build remains fixture/artifact based and does not
import this client or require a database at render time. Admin and Publishing
adapters may consume the transport contract in
`src/lib/supabase-runtime-contract.ts` later; this issue does not wire those
workflows to the new backend.

The migration adds nullable `owner_id` columns to orders, quote requests, and
customers. Existing rows with no owner remain inaccessible. This is deliberate:
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

Rollback before activation is the migration rollback/change procedure for the
exact isolated target, with current backup and Owner approval. No Production
database, Production write target, Auth credential, DNS, AWS, Cloudflare
routing, paid tier, or deployment action is part of LEO-541.
