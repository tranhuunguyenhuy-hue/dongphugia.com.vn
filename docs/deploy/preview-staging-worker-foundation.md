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

`.github/workflows/environment-worker-publish.yml` accepts Staging only and can
run only by manual dispatch from trusted `main`. Its build job checks out the
exact source SHA, installs locked dependencies, runs focused checks and browser
acceptance without Cloudflare credentials, and uploads a data-only artifact
containing Public and Admin SSR plus both asset mounts. It calculates a stable
SHA-256 over the artifact's sorted relative paths and file bytes; the publisher
recalculates it before replacing configuration with a trusted allowlist. The
serialized publisher never runs candidate scripts with the Staging token.
Runtime acceptance uses GET/HEAD requests only; write denial is tested with
local Worker and mock tests, never against Production.

Each release requires external, per-run token-policy inspection before the
protected `cloudflare-staging` GitHub environment can release its secret. The
build summary binds the request to the source SHA, artifact content digest,
account, Worker and nonsecret Cloudflare token ID. Immediately before approval,
the required environment reviewer uses the existing Cloudflare connection to
inspect that exact token's details. Confirm it is active and has only the
Workers `Editor` role scoped to the existing `dpg-staging` Worker under the
`Individual Workers` scope, with no additional or broader write grant. Cloudflare's
current documentation calls the role `Editor` and explicitly supports selected
Worker scopes; the connected account API still surfaces the legacy
`Individual Workers Editor` permission-group name. Use the token details endpoint
`GET /accounts/{account_id}/tokens/{token_id}`; do not list account tokens or
add token-management permissions to the deployment token. Cloudflare documents
the selected-Worker token scope in its [granular Worker permissions guidance](https://developers.cloudflare.com/changelog/post/2026-09-15-granular-worker-permissions/).

This external review is a human control recorded through the protected GitHub
environment approval, not machine-verified policy evidence. CI's later
`GET /accounts/{account_id}/tokens/verify` call checks only that the supplied
secret is the expected active token ID; it does not prove token scope. Repeat
the Cloudflare inspection for every release and immediately before its
environment approval; any token-policy change or revocation invalidates prior
inspection. The publisher fails closed if token identity/status, artifact
digest, source review or environment approval does not match. The release
summary records the source SHA, artifact digest, token ID, run ID, config digest
and the external-review status without exposing credentials.

## Staging setup packet

The one-time Worker bootstrap is complete. Read-only inventory on 2026-11-13
shows only `dongphugia-v1-public-production` and `dpg-staging` in account
`d54f3402b9d112ab64d6135e0e3f1fb1`. The Staging Worker has no bindings, custom
domains or `dongphugia.vn` zone routes; its workers.dev subdomain is enabled and
Worker Preview URLs are disabled. Its current code is a noindex 503 bootstrap
placeholder, so that public URL is not application acceptance or readiness.
Production's Worker `modified_on` remains `2026-11-04T15:05:13.056158Z`.

The current read-only Production baseline is status `ok`, mode
`verified-snapshot`, checkpoint `87e4b06b73ab20df11d95021e1da8bd8f497ee5e`,
5,223 public products, 4,853 listing products and M3 run `40739074902`; the
manifest reports the same checkpoint and run. The source PR adds read-only GET
capture immediately before deployment and a comparison afterward. This is not a
direct database read and does not modify Production.

GitHub's `cloudflare-staging` environment is configured for `main` only, with
`tranhuunguyenhuy-hue` as the required reviewer and administrator bypass
disabled. It currently has no secrets. The connected Cloudflare permission-group
API reports the legacy `Individual Workers Editor` group as `is_selectable: false`
even after the Worker exists; Cloudflare's current [Workers roles and permissions documentation](https://developers.cloudflare.com/workers/authorization/workers/)
supports the `Editor` role at Individual Workers scope. Cloudflare's [account-owned token documentation](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)
requires API Token Provisioning capability or Super Administrator status to
create account-owned tokens. The connected Cloudflare API session cannot
currently grant this role, and the generic token-creation API docs do not
document a Worker-specific resource selector; no resource syntax was guessed.

Minimum remaining setup: an Owner with Cloudflare API Token Provisioning or
Super Administrator access must create an account-owned token in the Cloudflare
dashboard selecting only the existing `dpg-staging` Worker and its Workers
`Editor` role at Individual Workers scope, then place its secret directly in GitHub
`cloudflare-staging` as `CLOUDFLARE_API_TOKEN`. Do not send the secret in chat,
add account-wide token-management permission, or put it in logs. At each later
release, dispatch with the token's nonsecret ID so the reviewer can inspect
that exact live token before approving the run.

The Staging publisher becomes available only after the reviewed source PR is
merged to `main`; merging is a separate Owner approval. Add the Staging-only
`CLOUDFLARE_API_TOKEN` secret to the configured `cloudflare-staging` environment;
do not reuse the unrelated lowercase `staging` environment. Dispatch from
`main` with `environment=staging`, the
exact reviewed source SHA, either `source_kind=main` or `source_kind=approved-pr`,
and the token ID to inspect. The build summary presents the candidate identity
before the environment approval is requested. The required reviewer inspects
the actual token policy immediately before approving that exact run. No
Cloudflare Preview Worker or Preview token is needed.

Before each release, record the candidate SHA and artifact digest, token ID,
account/Worker inventory, live Production health and catalogue-manifest
baseline, and current Staging version. After deployment, verify the exact
runtime SHA, one active version, noindex, live catalogue checkpoint, Admin
login/recovery rendering and private-route redirects. Local browser tests
cover write denial; do not send mutation probes to the Worker or Production. If
first activation or a later release fails, roll back or disable only
`dpg-staging` and verify the Production Worker, routes and data source remain
unchanged. Logs are enabled without persistence and traces remain disabled.

## Limits and paused work

Local Preview and Staging accept public catalogue reads only. They do not
verify live staff login, private Admin data, persisted guest orders,
idempotency, staff order changes, CMS changes or uploads. Those workflows need
a separately authorized safe read/write design. Phase 2 and PR #291 remain
paused and separate. This task does not authorize Production database roles,
RLS, Auth changes, Production Worker deployment, domain/DNS changes, token
rotation, paid scope, or merge.
