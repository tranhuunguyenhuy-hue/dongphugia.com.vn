# LEO-563 New Production application foundation

Status: source/CI foundation fix complete; Preview publication remains pending
a new Owner approval for the exact PR #138 head. This document records the
Public/Admin and CI foundation. It authorizes no Supabase,
Bunny, AWS, DNS, IAM, custom domain, route, Production deployment, or traffic
mutation. The existing Cloudflare deployment token remains untouched.

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

Local credentials are not used. Ordinary material app PR runs pass the existing
`CLOUDFLARE_ACCOUNT_ID` and temporary, dedicated
`CLOUDFLARE_READONLY_DISCOVERY_TOKEN` only to the sanitized read-only
Cloudflare inventory script. The deployment `CLOUDFLARE_API_TOKEN` is
deliberately unavailable. The discovery script issues fixed `GET` requests and
emits only sanitized resource/status evidence; missing permissions fail closed.

The separately approved publication run uses
`CLOUDFLARE_LEO563_PREVIEW_TOKEN`, scoped to the exact account with Workers
Scripts Edit only. That secret is available only to the one-shot upload job; it
does not replace or broaden the existing deployment token. Before Cloudflare is
mutated, the workflow requires a manual dispatch from the exact task branch,
the explicit approved 40-character source SHA, an open PR #138 targeting
`main`, and an exact match to the current PR head. It then downloads the
same-run candidate, recomputes its complete immutable identity, validates the
Preview config allowlist and Workers Free limits, executes a Wrangler dry run,
and proves by GET-only inspection that the exact Worker is either absent or the
known empty incomplete record left by a failed first bootstrap. An active
deployment, version, route, domain, binding, or enabled workers.dev endpoint is
rejected before publication. Each bootstrap/version step records whether a
Cloudflare write was attempted; if a write-path step fails, the same
GET-only state inspection runs before sanitized evidence is uploaded, and its
failure keeps the publication job fail-closed.

The assembled immutable Public artifact contains two configs. `wrangler.json`
remains detached with `workers_dev=false` and `preview_urls=false`.
`wrangler.preview.json` is a fail-closed allowlist for exactly
`dongphugia-v1-public-preview`, with `workers_dev=false`,
`preview_urls=true`, no routes/custom domains, no database/provider bindings,
Preview-only public environment values, mandatory noindex, the provider's
Workers Free CPU and subrequest ceilings. It contains no explicit `limits`
block, `cpu_ms`, or `subrequests` setting; those limits are left to Cloudflare's
provider-enforced Free plan. Static tests reject any Production
hostname, route, custom domain, trigger, service, database, storage, secret, or
unapproved binding. CI validates both configs with Wrangler dry runs and records
the Preview-config checksum.

The exact approved immutable publication command from the candidate directory
is:

```sh
wrangler versions upload --config wrangler.preview.json --preview-alias pr-138
```

This uploads one immutable version and creates only version/alias Preview URLs
under `workers.dev`; it does not deploy a version to Production or attach a
route/domain. After upload, CI uses sanitized GET-only calls to verify the exact
version, `workers_dev=false`, `preview_urls=true`, zero custom domains, and only
the Static Assets plus four approved plain-text Preview bindings. Real HTTPS
proof requires `/`, `/api/health`, and `/robots.txt`; SSR metadata; HTML,
response-header, and robots noindex; first MISS and subsequent HIT; cookie,
query, and API bypass; exact source-SHA response identity; and the hard
300-second edge freshness policy. Cloudflare does not expose Workers Logs,
Wrangler tail, or Logpush for Preview URLs, so per-request CPU observation is
reported as `CPU_OBSERVABILITY: PROVIDER_LIMITATION`; the 10 ms Free ceiling is
provider-enforced, not configured through `cpu_ms`, and successful requests
prove execution within the plan ceiling.

Admin external Preview is explicitly not an LEO-563 blocker and no Admin
Cloudflare resource is created or mutated. Canonical V1 Supabase connectivity
is deferred to LEO-564; LEO-563 does not bind the legacy/reduced-runtime
Supabase target. Production custom domains, DNS, traffic, and Legacy Production
remain untouched.

The existing merge/promotion workflows remain the historical single-artifact
Production path and are intentionally not wired to these new application
artifacts by this repository-only foundation. Production promotion, DNS, and
traffic remain separate future scope and are not authorized here.

## Deferred scope

- LEO-564: Supabase Auth, RLS, capabilities, guest/staff service interfaces.
- LEO-565: Bunny media, Cloudflare transform, recovery, and provider targets.
- LEO-566, LEO-567, LEO-568, LEO-569, LEO-571, and LEO-572: catalogue,
  commerce, search, filters, Quote, and Admin feature UI/behavior.
- Per-request Cloudflare CPU telemetry for Preview URLs: provider limitation;
  no Production route will be attached merely to obtain telemetry.
- Canonical V1 Supabase connectivity: LEO-564.
- Admin external Preview: downstream Admin/Auth delivery; not an LEO-563
  blocker.
