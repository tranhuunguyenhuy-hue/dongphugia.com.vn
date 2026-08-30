# LEO-563 New Production application foundation

Status: source candidate complete; real isolated Public Worker Preview remains
Owner-gated. This document records the Public/Admin and CI foundation. It
authorizes no Supabase, Cloudflare resource/version/deployment, Bunny, AWS,
DNS, IAM, Production, or traffic mutation. CI may perform sanitized read-only Cloudflare inventory
only with the temporary, dedicated `CLOUDFLARE_READONLY_DISCOVERY_TOKEN`
secret; the existing deployment token remains untouched.

## Repository structure

```text
apps/
  public/                    independent Public deployable
    app/                     Public-owned foundation routes
    src/config/env.ts        Public environment and browser-secret guard
    worker.ts                Public Worker cache/noindex/isolation boundary
    vite.config.ts           vinext + Cloudflare Workers build topology
    wrangler.jsonc           Worker + Static Assets candidate config
    package-lock.json        independently pinned Public Worker toolchain
  admin/                     independent Admin deployable
    app/                     Admin-owned foundation routes
    src/config/env.ts        Admin environment and browser-secret guard
    next.config.ts           private/no-store response baseline
packages/
  app-contracts/             framework-free identities and route contracts
scripts/app-foundation/      change gate and immutable artifact evidence
```

Public owns an independent lockfile for its pinned `vinext`, Vite, Wrangler,
Workers types, Next, and React toolchain. Admin remains on the root Next
toolchain and does not install or import the Public Worker runtime. Each
deployable owns its own config, TypeScript project, environment validator,
route tree, runtime metadata, and build output. `npm run build:public-worker`
and `npm run build:admin` never invoke the other application.

## Route and shared-code seam

The foundation owns only these routes:

| Deployable | Routes | Authority |
| --- | --- | --- |
| Public | `/`, `/robots.txt`, `/api/health` | `https://www.dongphugia.vn` |
| Admin | `/`, `/login`, `/robots.txt`, `/api/health` | `https://admin.dongphugia.vn` |

These are shell/probe routes only. No catalogue, checkout, search, filter,
quote, Product, Sales, Marketing, or Staff feature UI is implemented, and no
Figma-dependent composition is introduced. The full approved IA remains the
authority for later feature issues.

`packages/app-contracts` contains only literal identities, route ownership,
cache/noindex values, and TypeScript types. It imports no Next, React, Node, or
database module. Public does not import Admin code, legacy `/admin` code,
session code, staff mutation code, Auth Admin methods, or a service-role
client. Admin does not import Public code, Public cookies, or the legacy Public
runtime.

## Environment and cache contract

Both validators fail closed on unknown `NEXT_PUBLIC_*` variables and on known
privileged names such as database URLs, service-role/Auth Admin keys, session
secrets, provider API keys, and publishing tokens. Public Preview requires a
non-Production origin and `PREVIEW_NOINDEX=true`; its Production authority is
exactly `https://www.dongphugia.vn`. Admin allows only the publishable Supabase
URL/key in future browser configuration, never a staff token or secret; its
Production authority is exactly `https://admin.dongphugia.vn` and its shell is
always private/no-store and noindex. Supabase Auth/RLS/service integration is
deferred to LEO-564.

Public’s Worker caches only anonymous `GET`/`HEAD` requests for `/` with no
cookie, Authorization header, or query. The key contains hostname, pathname,
the empty allowlisted query, and exact source SHA. Browser policy requires
revalidation; Worker cache policy has a hard 300-second TTL with no stale
window. Cookie, query, API, non-HTML, `Set-Cookie`, Preview/draft, and internal
revalidation-control requests bypass or fail closed as private/no-store.
Health/probe responses are private/no-store. Admin’s complete response surface
is private/no-store and makes no Public cache assumption. No session or cookie
implementation is introduced.

## CI candidate contract

The `repo-code-gate` compares the exact PR-head SHA to its base and marks a
Preview as required only for material application/build inputs:

- `apps/public/**` or `apps/admin/**`, excluding documentation and tests;
- `packages/app-contracts/**`, excluding documentation and tests; or
- app-foundation implementation scripts, the Preview workflow, or shared build
  manifests.

Database, import, Supabase, migration, unrelated documentation, and test-only
changes cannot reach `app-preview-artifact` or a Cloudflare call. A material
change builds both deployables with `APP_ENV=preview`, an invalid
non-Production placeholder origin, and `PREVIEW_NOINDEX=true`.

The official `vinext check` must pass before build. The Public candidate is an
actual Wrangler-dry-run deployable containing a Worker and Static Assets, not a
raw `.next` directory. CI builds it twice and requires identical Worker, Static
Assets, and config SHA-256 values. CI also rebuilds and recollects Admin and
requires its application artifact SHA-256 to remain identical. Machine paths
and build-only entropy are canonicalized; deterministic build entropy is
source-derived only because the Worker rejects all Preview/draft/revalidation
control surfaces in this issue.

Each application artifact identity is a SHA-256 over sorted payload paths and
bytes, namespaced by application, exact source commit, and build target. The
candidate evidence records both lockfiles, migration-manifest digest, adapter
and Wrangler versions/commands, Public Worker checksum, Static Assets checksum,
config checksum, Public/Admin checksums, PR/run identity, and runtime-derived
noindex proofs. CI verifies the exact manifest and recomputes all identities
before upload.

Runtime proof runs the built Public candidate under local `workerd` and requires
representative SSR metadata, HTML robots meta, `X-Robots-Tag`, `robots.txt`
`Disallow: /`, MISS then HIT, cookie/query bypass, 300-second policy, and
Production-host rejection. Admin runtime proof requires SSR/noindex and
private/no-store. These observations are copied into the immutable artifact;
booleans are not self-attested by the collector.

Local credentials are not used. For a material app change, CI passes the
existing `CLOUDFLARE_ACCOUNT_ID` and temporary, dedicated
`CLOUDFLARE_READONLY_DISCOVERY_TOKEN` secret references only to
`cloudflare-readonly-discovery.mjs`. The deployment
`CLOUDFLARE_API_TOKEN` is deliberately unavailable to this job. The temporary
token is account-restricted and grants only Workers Scripts Read, Billing Read,
Zone Read, and Workers Routes Read. That script issues fixed `GET`
requests for Worker scripts/settings/subdomains/domains/routes, Pages projects
and domains, account Worker settings, and subscription labels. It emits only
credential availability, resource names/types/status, public host associations,
HTTP status/error codes, and suitability; account/zone IDs, tokens, provider
error text, credentials, and raw responses are never emitted. Missing secrets
or read permissions remain explicit and fail suitability closed.

The assembled immutable Public artifact contains two configs. `wrangler.json`
remains detached with `workers_dev=false` and `preview_urls=false`.
`wrangler.preview.json` is an Owner-gated allowlist for exactly
`dongphugia-v1-public-preview`, with `workers_dev=false`,
`preview_urls=true`, no routes/custom domains, no database/provider bindings,
Preview-only public environment values, and mandatory noindex. CI validates
both configs with Wrangler dry runs and records the Preview-config checksum,
but contains no Wrangler upload/deploy invocation.
Until the Owner gate is approved, both deployables and the prepared Public
Preview config remain CI-only artifacts.

If discovery proves no suitable isolated Worker, the proposed—not authorized—
resource contract is Cloudflare Workers Free, no Paid enablement, no custom
domain, no `dongphugia.vn` route, no Production binding or credential, no DNS
mutation, `workers_dev=false`, and `preview_urls=true`. After a separate exact
Owner approval, the intended immutable publication command from the candidate
directory is:

```sh
wrangler versions upload --config wrangler.preview.json --preview-alias pr-138
```

This uploads a version and creates only its version/alias Preview URL under
`workers.dev`; it is not present in executable CI and is not run by LEO-563
before approval. The Cloudflare gate remains `BLOCKED_BY_OWNER_GATE`. Admin
external Preview is explicitly not an LEO-563 blocker and no Admin Cloudflare
resource is created or mutated. Canonical V1 Supabase connectivity is deferred
to LEO-564; LEO-563 does not bind the legacy/reduced-runtime Supabase target.
Production custom domains, DNS, traffic, and Legacy Production remain
untouched.

The existing merge/promotion workflows remain the historical single-artifact
Production path and are intentionally not wired to these new application
artifacts by this repository-only foundation. Production promotion, DNS, and
traffic remain separate future scope and are not authorized here.

## Deferred scope

- LEO-564: Supabase Auth, RLS, capabilities, guest/staff service interfaces.
- LEO-565: Bunny media, Cloudflare transform, recovery, and provider targets.
- LEO-566, LEO-567, LEO-568, LEO-569, LEO-571, and LEO-572: catalogue,
  commerce, search, filters, Quote, and Admin feature UI/behavior.
- Real isolated Public Cloudflare Worker Preview publication and deployed
  CPU/origin/subrequest observation: Owner-gated after exact resource and
  Workers Free approval.
- Canonical V1 Supabase connectivity: LEO-564.
- Admin external Preview: downstream Admin/Auth delivery; not an LEO-563
  blocker.
