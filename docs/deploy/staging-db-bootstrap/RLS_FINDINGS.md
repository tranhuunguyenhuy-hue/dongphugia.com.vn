# RLS findings for staging bootstrap

This review is read-only. It checks whether the application appears to require
Supabase Row Level Security policies for direct client/RPC access during the
initial staging bootstrap.

## Findings

1. Runtime data access for the storefront/admin application is primarily
   server-side Prisma through `DATABASE_URL` / `DIRECT_URL`.
2. The app defines Supabase clients in:
   - `src/lib/supabase.ts`
   - `src/utils/supabase/client.ts`
   - `src/utils/supabase/server.ts`
   - `src/utils/supabase/middleware.ts`
3. In the current source tree, no application code under `src/` was found using
   direct `supabase.from(...)`, `supabase.rpc(...)`, `supabase.storage...`,
   `supabase.auth...`, or realtime channel calls.
4. Some historical/operator scripts under `scripts/` use Supabase service-role
   or anon/publishable keys. These scripts are outside the staging bootstrap
   scope and must not be run as part of this change set.
5. `prisma/schema.prisma` contains Prisma comments that some introspected
   models have row-level security and need extra migration setup, but the
   generated Prisma bootstrap SQL does not create Supabase RLS policies.

## Staging decision

For this staging bootstrap, no RLS policy artefact is included.

Reason: the staging app build/deploy path is server-side Prisma, and there is no
current evidence of browser-side table/RPC reads or writes in `src/`.

## Follow-up before production go-live

Create an explicit RLS design if any of these become true:

- the browser client reads public catalogue/blog tables directly;
- checkout/quote/order flows write directly through Supabase anon credentials;
- admin flows use Supabase Auth/session tables or RPCs;
- storage operations move from Bunny to Supabase Storage;
- any script using `SUPABASE_SERVICE_ROLE_KEY` is promoted into runtime.

Minimum expected production policy posture:

- public read only for approved public catalogue/blog tables;
- no public read for admin/session/audit/customer/order/quote-private data;
- public insert policies only for deliberately public intake endpoints, if any;
- service-role usage kept server-side only;
- tests proving production-sensitive tables are not readable through anon keys.
