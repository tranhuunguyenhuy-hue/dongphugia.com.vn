# LEO-563 New Production application foundation

Status: source candidate complete; real Preview remains Owner-gated. This
document records the repository-only Public/Admin and CI foundation. It
authorizes no Supabase, Cloudflare, Bunny, AWS, DNS, IAM, credential,
Production, or traffic mutation. It performs no Cloudflare publication.

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
Assets, and config SHA-256 values. Machine paths and build-only entropy are
canonicalized; deterministic build entropy is source-derived only because the
Worker rejects all Preview/draft/revalidation control surfaces in this issue.

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

Read-only local discovery on 2026-08-30 found no Cloudflare environment token,
account ID, or authenticated Wrangler session. Existing Worker names, types,
domains, bindings, plan, Production association, and Public/Admin isolation are
therefore `UNKNOWN`; no login or credential retrieval was attempted. The
Cloudflare gate records `BLOCKED_BY_OWNER_GATE` for a material app change and
performs no API call. The minimum Owner decision is to identify or authorize an
isolated non-Production Public Worker target and a separate Admin Preview
target, confirm their plan/cost and no-Production-domain/DNS contract, and
authorize exact artifact publication plus non-Production Supabase binding for
runtime acceptance. No resource is created here. The candidate remains CI-only;
Production custom domains, DNS, traffic, and Legacy Production are untouched.

The existing merge/promotion workflows remain the historical single-artifact
Production path and are intentionally not wired to these new application
artifacts by this repository-only foundation. Production promotion, DNS, and
traffic remain separate future scope and are not authorized here.

## Deferred scope

- LEO-564: Supabase Auth, RLS, capabilities, guest/staff service interfaces.
- LEO-565: Bunny media, Cloudflare transform, recovery, and provider targets.
- LEO-566, LEO-567, LEO-568, LEO-569, LEO-571, and LEO-572: catalogue,
  commerce, search, filters, Quote, and Admin feature UI/behavior.
- Real Cloudflare Preview publication, deployed CPU/origin/subrequest
  observation, and non-Production Supabase connectivity: Owner-gated after an
  exact isolated resource/cost/binding decision.
