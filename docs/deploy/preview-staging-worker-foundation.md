# Local Preview and Staging Worker

## Environment contract

| Environment | Runtime | Public | Admin | Data |
| --- | --- | --- | --- | --- |
| Local Preview | Local Wrangler at `http://127.0.0.1:8787` | `/` | `/admin` renders the Admin sign-in shell; private routes redirect to it | Read-only GETs of Production-published public catalogue assets |
| Staging | One Cloudflare Worker, `dpg-staging`, in account `d54f3402b9d112ab64d6135e0e3f1fb1` | `/` | `/admin` renders the same sign-in shell; private routes redirect to it | Same direct GET path to Production's published public catalogue |

Run Local Preview with `npm run preview:local`. It builds the Public and Admin
Workers, strips provider credentials and copied catalogue selectors from its child
environment, then runs Wrangler locally. Both routes share one origin. There
is no `dpg-preview` Worker, Preview workers.dev URL, Preview publisher, or
Preview Cloudflare credential environment.

## Production catalogue reads

The data origin is fixed at `https://www.dongphugia.vn`. Local Preview and
Staging issue server-side GET requests only to the catalogue manifest and
paths declared by that manifest: listing pages, product buckets and search
shards. Requests send no browser cookies or authorization, accept no
caller-controlled URL or headers, and reject redirects. The response must be
JSON without `Set-Cookie`; contract, checkpoint, product families, listings,
buckets, search shards and bounded payloads are validated. Missing or invalid
data returns an unavailable response with no fixture fallback. The Worker
does not keep a copy of these files in its assets.

This reads the public catalogue currently published by Production. Production
health currently identifies its catalogue as a verified published snapshot;
this path is not a live database query and cannot establish fresher database
state than the catalogue Production has published. Prices retain source
provenance and remain subject to staff confirmation. Stock is presented as
contact-only. Banner and Blog content stay hidden because no verified
Production asset route is available; the runtime does not proxy arbitrary
Production pages.

## Admin boundary and same-origin limits

The combined Worker imports the Admin SSR renderer and serves the actual login,
recovery and generic health pages under `/admin`. Authentication is explicitly
disabled at build and runtime, the login and recovery controls are disabled,
and protected routes redirect to the mounted sign-in page. The public health
route reveals only the application name and `ok`; staff/customer data is not
loaded. Auth callback/confirm/logout handlers return 503 before contacting
Supabase. No Supabase URL or key, service-role, database or Auth-admin credential
is bound. Every non-GET/HEAD request receives 405 before asset or app dispatch.
Local tests verify this boundary without sending writes to Production. This is
an Admin rendering check, not Admin authentication or private-data acceptance.

The Public and Admin Vite RSC bundles register loader functions on `globalThis`.
When bundled into one Worker, an Admin request overwrote Public's cached loader
registration and a following Public SSR request failed. The build now rewrites
only Admin's three generated RSC loader globals to the `dpg-rsc0` namespace,
keeps identifier width stable for source maps, and records that contract in the
version 2 artifact manifest. The build fails if expected globals are missing;
the publisher checks that the artifact actually contains the isolated names.
Desktop/mobile Worker checks exercise Public → Admin → Public, the reverse
order, and concurrent SSR.

Public and Admin paths share a browser origin. `Path=/admin` on a cookie would
not provide browser isolation: same-origin Public code can still request
`/admin`, and path only controls which requests carry the cookie. The
Admin SSR pages are marked private/no-store and noindex. Keep private data
unavailable until there is a verified, safely authenticated read path. Do not
add a general Production proxy or a caller-controlled upstream URL.

## Build, checks and Staging publisher

`.github/workflows/environment-worker-ci.yml` builds Local Preview and Staging
without provider credentials, runs focused boundary tests and app type checks,
and uses desktop/mobile browsers against a local Worker. It verifies actual
Production catalogue GETs, noindex and both app asset paths, Admin SSR with Auth
disabled, private-route redirects, local write denial, and Public SSR before,
after and concurrently with Admin SSR. `.github/workflows/pr-preview-build.yml`
is a source build only: it uses the local Preview origin and emits no deployable
Cloudflare Preview artifact.

`.github/workflows/environment-worker-publish.yml` accepts Staging only. Its
build job checks out the exact SHA, installs locked dependencies, runs focused
checks and browser acceptance without Cloudflare credentials, and uploads a
data-only artifact containing Public and Admin SSR plus both asset mounts. The
serialized publication job on trusted default-branch code verifies every
digest, validates the Admin auth-disabled manifest, replaces deployment
configuration with a narrow allowlist, then checks token scope before it can
run pinned Wrangler. Candidate scripts never run with the Staging token. Runtime
acceptance uses GET/HEAD requests only; write denial is tested with local
Worker and mock tests, never against Production.

The publication gate currently fails closed with
`ENVIRONMENT_WORKER_TOKEN_SCOPE_PROOF_UNAVAILABLE`. A manual policy string and
a successful `dpg-staging` GET do not prove the token lacks Production write
authority, so the workflow makes no Cloudflare API request in this gate and
cannot reach `wrangler deploy` until a supported policy-scope evidence check is
implemented. Do not add token-management permissions to the deployment token,
guess resource-map syntax or probe Production writes.

## Staging setup packet

Read-only Cloudflare API inventory on 2026-11-12 confirmed account workers.dev
subdomain `tranhuunguyenhuy`; `dongphugia-v1-public-production` was the only
Worker and `dpg-staging` was absent in account `d54f3402b9d112ab64d6135e0e3f1fb1`.
The Production Worker had one active version and plain-text bindings for its
production identity plus the Assets binding; inventory exposed no other
bindings. The public production hostname is served by this Worker. A live GET
to `https://www.dongphugia.vn/api/health` returned source SHA
`8c67d253c64c7bb44435984f3f736272c0326c4b`, mode `verified-snapshot`, 5,223
products and 4,853 listing products. A separate direct GET of
`/__catalogue/v1/manifest.json` returned contract
`dpg:public-catalogue-snapshot:v1`, checkpoint
`87e4b06b73ab20df11d95021e1da8bd8f497ee5e` and M3 run `40739074902`. This is
the currently published Production catalogue source, not a direct database
read. Re-read the live health, manifest and Worker inventory before Staging
activation; these observed values are not permanent constants.

Bootstrap order matters. An authorized Cloudflare product-level Admin must
first create only the `dpg-staging` Worker in that account, with workers.dev
enabled and no custom domain, route, database, storage, Auth or other binding.
Cloudflare's [Worker authorization documentation](https://developers.cloudflare.com/workers/authorization/workers/)
says Individual Worker Editor scope applies to existing selected Workers and
cannot be assigned before the Worker exists; creating a Worker requires
product-level Admin. After the Worker exists, configure an API token limited to
that Worker with Individual Worker Editor access and obtain supported evidence
of the token's policy before enabling publication. The reachable origin will
be `https://dpg-staging.tranhuunguyenhuy.workers.dev`. No paid feature or
Production resource change is required. This review task does not create the
Worker, token or GitHub environment, and the current publisher remains blocked
until the token-policy proof is implemented and verified.

The Staging publisher workflow is available only after its trusted workflow
code is merged to `main`. Once that separate merge gate is approved, dispatch it from
`main` with `environment=staging`, the exact reviewed source SHA and either
`source_kind=main` or `source_kind=approved-pr`. Today the publisher stops
before any provider write because supported token-policy proof is not
implemented. Once that gate is implemented and reviewed, the selected Staging
environment can supply the scoped API token. No Cloudflare Preview Worker or
Preview token is needed. Before publication,
record the candidate SHA and artifact digest, account inventory, Production
baseline and prior Staging version if one exists. After deployment, verify the
runtime SHA, one active version, noindex, live catalogue checkpoint, Admin
login/recovery rendering and private-route redirects. Local browser tests cover
write denial; do not send mutation probes to the Worker or Production. If first
activation fails, remove or disable only `dpg-staging` and verify the Production
Worker, routes and data source remain unchanged. Logs are enabled without
persistence and traces remain disabled; hosted logging has not yet been
exercised.

## Limits and paused work

Local Preview and Staging accept public catalogue reads only. They do not
verify live staff login, private Admin data, persisted guest orders,
idempotency, staff order changes, CMS changes or uploads. Those workflows need
a separately authorized safe read/write design. Phase 2 and PR #291 remain
paused and separate. This task does not authorize Production database roles,
RLS, Auth changes, Production Worker deployment, domain/DNS changes, token
rotation, paid scope, or merge.
