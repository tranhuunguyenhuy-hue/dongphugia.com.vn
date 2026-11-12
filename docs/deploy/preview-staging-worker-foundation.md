# Local Preview and Staging Worker

## Environment contract

| Environment | Runtime | Public | Admin | Data |
| --- | --- | --- | --- | --- |
| Local Preview | Local Wrangler at `http://127.0.0.1:8787` | `/` | `/admin` returns a static 503 unavailable page | Read-only GETs of Production-published public catalogue assets |
| Staging | One Cloudflare Worker, `dpg-staging`, in account `d54f3402b9d112ab64d6135e0e3f1fb1` | `/` | `/admin` returns the same static 503 unavailable page | Same direct GET path to Production's published public catalogue |

Run Local Preview with `npm run preview:local`. It builds the Public Worker,
strips provider credentials and copied catalogue selectors from its child
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

Every GET or HEAD under `/admin` returns a no-script static 503 explaining that
Production authentication and private staff/customer data are unavailable.
Admin SSR, Auth, recovery, session and callback handlers are not imported into
the Worker. No Supabase, service-role, database or Auth-admin credential is
bound. All non-GET/HEAD requests receive 405 before a route or asset handler is
called. This boundary is not full Admin readiness; the source Admin app is
type-checked separately, and its private-data workflows are not accepted here.

Public and Admin paths share a browser origin. `Path=/admin` on a cookie would
not provide browser isolation: same-origin Public code can still request
`/admin`, and path only controls which requests carry the cookie. The
unavailable Admin page contains no data or script and applies a restrictive
Content Security Policy. Keep private data unavailable until there is a
verified, safely authenticated read path. Do not add a general Production
proxy or a caller-controlled upstream URL.

## Build, checks and Staging publisher

`.github/workflows/environment-worker-ci.yml` builds Local Preview and Staging
without provider credentials, runs focused boundary tests and app type checks,
and uses desktop/mobile browsers against a local Worker. It verifies actual
Production catalogue GETs, noindex and asset behavior, the Admin unavailable
page, local write denial, and successful Public SSR after Admin paths.

`.github/workflows/environment-worker-publish.yml` accepts Staging only. Its
build job checks out the exact SHA, installs locked dependencies, runs focused
checks and browser acceptance without Cloudflare credentials, and uploads a
data-only artifact. A serialized publication job on trusted default-branch
code verifies the artifact digests, rejects any Admin Worker import or Admin
asset, replaces deployment configuration with a narrow allowlist, then runs
pinned Wrangler with the Staging token. Candidate scripts never run with that
token. Runtime acceptance uses GET requests only; write denial is tested with
local Worker and mock tests, never against Production.

The token scope check requires the recorded
`CLOUDFLARE_WORKER_POLICY_SCOPE=individual-worker:dpg-staging:editor` value and
checks that the selected Staging Worker is readable. The value is a manual
attestation, not API proof of token scope. A selected-Worker GET or Production
403/404 cannot prove absence of write authority. Before the first publication,
the account owner must review evidence that the token policy is limited to
**Individual Workers → `dpg-staging` → Editor**. Do not add token-management
permissions just to query the token's own policy. If this evidence is not
available, publication remains blocked; do not guess resource scope or probe
Production writes.

## Staging setup packet

Read-only inventory on 2026-11-12 found the account workers.dev subdomain
`tranhuunguyenhuy`; `dongphugia-v1-public-production` was the only Worker in
account `d54f3402b9d112ab64d6135e0e3f1fb1`. The Production `/api/health` source
SHA was `8c67d253c64c7bb44435984f3f736272c0326c4b`. Its published catalogue
manifest used contract `dpg:public-catalogue-snapshot:v1` and checkpoint
`87e4b06b73ab20df11d95021e1da8bd8f497ee5e`. Re-read both before Staging
activation; these observed values are not permanent constants.

The only required Cloudflare resource change is one `dpg-staging` Worker in
that account, with workers.dev enabled and no custom domain, route, database,
storage, Auth or other binding. The reachable origin will be
`https://dpg-staging.tranhuunguyenhuy.workers.dev`. No paid feature or
Production resource change is required. This PR does not create or deploy the
Worker; the coordinator must sequence provider operations after reviewing the
exact candidate artifact and token-policy evidence.

The publisher workflow is available only after its trusted workflow code is
merged to `main`. Once that separate merge gate is approved, dispatch it from
`main` with `environment=staging`, the exact reviewed source SHA and either
`source_kind=main` or `source_kind=approved-pr`. The selected Staging
environment supplies one API token after policy evidence is reviewed. No
Cloudflare Preview Worker or Preview token is needed. Before publication,
record the candidate SHA and artifact digest, account inventory, Production
baseline and prior Staging version if one exists. After deployment, verify the
runtime SHA, one active version, noindex, live catalogue checkpoint and Admin
unavailable response. If first activation fails, roll back only the
`dpg-staging` Worker; never route or restore traffic through Production.

## Limits and paused work

Local Preview and Staging accept public catalogue reads only. They do not
verify live staff login, private Admin data, persisted guest orders,
idempotency, staff order changes, CMS changes or uploads. Those workflows need
a separately authorized safe read/write design. Phase 2 and PR #291 remain
paused and separate. This task does not authorize Production database roles,
RLS, Auth changes, Production Worker deployment, domain/DNS changes, token
rotation, paid scope, or merge.
