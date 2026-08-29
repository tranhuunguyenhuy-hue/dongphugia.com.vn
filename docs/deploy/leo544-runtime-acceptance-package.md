# LEO-544 runtime acceptance package

Status: `REQUIRES_OWNER_DECISION`. This is a least-privilege proposal only. It does not
retrieve secret values, create or rotate credentials, deploy a Worker, change a
Cloudflare binding/account setting, write Bunny, change DNS, or touch
Production.

## 1. Cloudflare target

| Item | Read-only evidence | Acceptance position |
| --- | --- | --- |
| Account | Read-only dashboard attestation: `d54f3402b9d112ab64d6135e0e3f1fb1` / `Tranhuunguyenhuy@gmail.com's Account`. | Exact account confirmed. |
| Pages project | GitHub repository variable: `CLOUDFLARE_PAGES_PREVIEW_PROJECT=dongphugia-preview`. This is the existing static Preview project, not proof of a Worker target. | Do not use it as the Worker target without explicit Owner confirmation. |
| Worker name | The dashboard lists no Workers or Pages projects; `workers/leo544-media-transform/wrangler.jsonc` declares `dongphugia-media-transform`. | The Worker does not exist. Creating exactly this non-Production Worker is an Owner mutation gate. |
| Images binding | Official platform documentation supports raw request-body `ReadableStream` input and `.info()` metadata through a per-Worker `IMAGES` binding. There is no live Worker/binding on the account. | Platform capability is supported; account-specific runtime usability remains unproven until the bounded Preview deployment. |
| Streams support | The source config declares `streams_enable_constructors`; local Wrangler dry-run passed. | Runtime support is not independently proven without deployment. Do not alter the compatibility flag. |
| Plan and usage | Dashboard attestation: Workers Free is current, 100,000 requests/day and 10 ms CPU/request; billable usage is `$0.00`. Images shows 0 unique transformations and no Cloudflare zones. Official pricing includes 5,000 unique transformations/month; `.info()` is free. | The proposed 21-transform matrix fits the documented free allowance. A live binding call remains the account-specific entitlement proof; stop on plan/checkout prompts or transformation billing errors. |
| Route | Current config has `workers_dev=false` and no routes, domains, or custom domain. Account subdomain is `tranhuunguyenhuy.workers.dev`. | Owner package proposes enabling `workers.dev` only for `dongphugia-media-transform`, yielding `dongphugia-media-transform.tranhuunguyenhuy.workers.dev`; no zone, route, DNS, or custom domain. |

No public DNS or custom-domain change is proposed.

## 2. Bunny target

| Item | Read-only evidence | Acceptance position |
| --- | --- | --- |
| Storage API host | Source allowlist: `sg.storage.bunnycdn.com`. | Proposed exact host, subject to Owner revalidation as non-Production. |
| Storage zone | Exact zone behind the intended Pull Zone cannot be derived from repository/GitHub metadata. | `UNKNOWN`; do not invent or create one. Owner must attest its exact name and that it is non-Production/synthetic-safe. |
| CDN host | GitHub staging variable and repository contract name `dpg-publishing-staging.b-cdn.net`; current public DNS lookup returns no address. | Intended Preview hostname is exact, but live Pull Zone availability is not proven. Do not change DNS. |
| Credential | No Bunny storage credential name exists in repository, repository secrets, Preview secrets, or staging secrets. Provider-side storage-zone password status was not accessible read-only. | Reusable credential availability remains `UNKNOWN`; no value was retrieved and no rotation or creation is proposed. |
| Write prefix | The Worker now requires `identityId=leo544-acceptance`, a unique `assetId=run-<run-id>`, and inserts computed source and transformed-output SHA-256 values before the variant. | Exact synthetic-only prefix: `publishing/leo544-acceptance/run-<run-id>/<source-sha256>/<output-sha256>/{variant}.webp`. Never use a canonical identity or asset ID. |

The Bunny HTTP API documents PUT upload, GET file reads, and an optional SHA-256
`Checksum` header, but no create-only or conditional-write operation. The
source therefore uses computed source and transformed-output SHA-256 values as
content-addressed path components, sends the transformed output checksum, and
performs a bounded GET preflight. A matching existing object returns success
without PUT; a different existing object fails closed. Concurrent identical
requests may both observe a 404 and PUT the same bytes to the same
content-addressed path; concurrent different output bytes cannot select the
same path without a SHA-256 collision, including across Worker versions.

## 3. Credentials and secrets

Secret values must never appear in logs, evidence, PR text, or this package.

| Name | Existing/new | Storage | Minimum privilege | Mutation required now |
| --- | --- | --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Existing repository secret name; exact account independently attested in the dashboard. | GitHub Actions secret or approved Wrangler profile. | Identifier only; no data-plane privilege. | No. |
| `CLOUDFLARE_API_TOKEN` | Existing repository secret name; provider scope is not exposed by GitHub. | GitHub Actions secret/Wrangler auth. | Exact-account Worker script deployment/edit for the named Worker; no DNS, Pages creation, account-admin, or unrelated secret-management permission. Scope must be verified before use. | No. |
| `MEDIA_TRANSFORM_AUTH_TOKEN` | Not found in repository, Preview, or staging secret-name inventory. | Cloudflare Worker Secret for the exact Worker. | Request bearer authentication only, generated with at least 32 bytes of entropy and never reused in Production. | Yes, only after exact Owner approval. |
| `PUBLISHING_BUNNY_STORAGE_API_KEY` | Existing status `UNKNOWN`. | Cloudflare Worker Secret for the exact Worker. | Bunny documents the Storage Zone password as the Storage API key; no prefix-scoped or method-scoped storage key is documented. Reuse is safe only if the exact zone is dedicated to synthetic Preview objects. Otherwise a dedicated Preview-only zone/password is a separate cost/resource/credential Owner gate. | No; do not create/rotate. |

`PUBLISHING_BUNNY_STORAGE_ENVIRONMENT`,
`PUBLISHING_BUNNY_STORAGE_ZONE_NAME`, `PUBLISHING_BUNNY_STORAGE_HOSTNAME`,
and `PUBLISHING_BUNNY_CDN_HOSTNAME` are non-secret Worker variables, but their
exact approved values still require Owner confirmation. No credential mutation
is authorized by this package.

## Exact bounded mutation sequence

This sequence remains inactive until the exact Bunny zone and safely reusable
zone password are attested by name/scope only.

1. Bind the exact merged/reviewed PR #128 candidate SHA to the runtime record.
2. Verify the existing Cloudflare deployment token has only the permissions
   needed to create/update `dongphugia-media-transform` and its bindings on
   account `d54f3402b9d112ab64d6135e0e3f1fb1`; stop on broader-account changes.
3. Create exactly one Preview-only request-auth token, at least 32 bytes of
   entropy, directly as Worker secret `MEDIA_TRANSFORM_AUTH_TOKEN`; never print
   or persist its plaintext in CI/evidence.
4. Create/deploy exactly `dongphugia-media-transform` with `IMAGES`,
   `streams_enable_constructors`, the reviewed non-secret Preview variables,
   the existing Bunny zone password as Worker secret
   `PUBLISHING_BUNNY_STORAGE_API_KEY`, and workers.dev enabled. Do not add a
   route, zone, custom domain, or DNS record.
5. Run only the synthetic acceptance matrix below against
   `dongphugia-media-transform.tranhuunguyenhuy.workers.dev` and
   `publishing/leo544-acceptance/run-<run-id>/...`.
6. Record sanitized status, dimensions, digests, exact synthetic paths, and
   Images usage delta. Never record request-auth or Bunny secret values.
7. On any security, entitlement, quota, or delivery failure, stop requests and
   remove/disable only this Worker deployment; leave Bunny objects untouched
   unless exact-path deletion receives separate approval.

If no safely reusable Bunny zone password exists, this sequence stops before
step 3. Bunny exposes the Storage Zone password as the Storage API key and does
not document prefix- or method-scoped keys. The minimum alternative is a new
dedicated synthetic-only Preview storage zone and its zone password, but that
resource/cost/credential mutation is outside this package and requires a
separate Owner decision.

## 4. Runtime acceptance matrix

Run only after the exact Cloudflare Worker, existing `IMAGES` binding, exact
Bunny zone, route, and existing credentials have been independently approved.
Use real JPEG, PNG, and WebP files delivered as bounded
`ReadableStream<Uint8Array>` bodies; do not use caller dimensions as evidence.

| Test | Expected evidence |
| --- | --- |
| Normal source transform | Each real JPEG/PNG/WebP is accepted below 5 MiB; `IMAGES.info()` returns the actual format, width, and height; source and output streams complete. |
| Actual dimension gate | Provider-parsed `.info()` dimensions, not `X-Source-Width`/`X-Source-Height`, decide acceptance. |
| Over 40MP | Real >40MP JPEG, PNG, and WebP each fail with `MEDIA_SOURCE_DIMENSIONS_TOO_LARGE`; no Bunny PUT occurs. |
| Malformed input/metadata | Malformed or incomplete image metadata fails closed with `MEDIA_SOURCE_INVALID` or `MEDIA_SOURCE_DIMENSIONS_INVALID`; no Bunny PUT occurs. |
| Input bound | A body over 5 MiB fails with `MEDIA_SOURCE_TOO_LARGE` before Images/Bunny delivery. |
| Seven variants | The seven locked variants are each exercised; no eighth variant is accepted. |
| WebP output | Output is `image/webp` and uses the reviewed output quality; no source bytes or credentials are logged. |
| Path contract | Every output is under `publishing/leo544-acceptance/run-<run-id>/<source-sha256>/<output-sha256>/`; the CDN host remains unchanged and the path explicitly carries source and output identity. |
| Retry | A bounded transient 5xx/timeout test, if an Owner-approved Bunny fault-injection method exists, causes at most one retry with the same path and body. Without such a method, runtime retry proof is `UNKNOWN`; unit coverage remains the evidence. |
| Duplicate/idempotent request | Repeating the same source/variant resolves to the same content-addressed path; an existing matching object succeeds without a second PUT. |
| No overwrite | A bounded GET preflight hashes an existing object. Matching bytes succeed without PUT; different bytes return `MEDIA_STORAGE_CONFLICT`; no canonical identity is accepted. Source and output content-addressing is the race-safety primitive because different output bytes select different paths. |
| Failure isolation | Transform/digest/Bunny failure produces no database/reference update and no canonical-media change. A successfully written synthetic object may be orphaned and is handled only by the cleanup rule below. |
| URL contract | Existing CDN host configuration and transform endpoint remain unchanged; this source-only acceptance contract uses a content-addressed synthetic path and never writes canonical media. No DNS or custom-domain action occurs. |
| Usage measurement | Three formats × seven unique variants = at most 21 unique transformations for the matrix. `.info()` calls are free per the current Images binding documentation; measure the actual account usage before/after and stop if the approved allowance/cost boundary is exceeded. |

The source uses the current Images binding `.info()` and `.output({
format: "image/webp", quality })` API documented at
https://developers.cloudflare.com/images/optimization/binding/.

## 5. Cleanup

- If a temporary Worker deployment is separately approved, disable/remove only
  that exact temporary deployment or version after evidence capture; do not
  touch another Worker or Production.
- Delete synthetic Bunny objects only with a separate approval naming the exact
  object paths. Otherwise leave the uniquely prefixed objects in place and
  document their exact paths and retention owner.
- Never delete canonical media, bulk-delete by prefix, change DNS, or alter
  Production references.

## 6. Rollback

1. Stop sending acceptance requests and record the exact Worker version ID.
2. Roll back the exact Worker to its previously verified version using the
   approved Wrangler/Cloudflare version rollback operation, or disable the
   temporary `workers.dev` mechanism if it was explicitly created for this
   test.
3. Do not delete or rotate existing secrets as part of rollback.
4. Leave synthetic Bunny objects in place unless a separate approval permits
   deletion of the named exact paths; never delete canonical media.
5. Confirm no route, custom domain, DNS record, database row, or canonical
   media reference changed.

## Owner approval text

> APPROVED — after confirming the exact Bunny Preview storage-zone name and
> that its zone password is safely reusable for synthetic-only data, deploy
> exact PR #128 candidate `<SHA>` to Cloudflare account
> `d54f3402b9d112ab64d6135e0e3f1fb1` as the new non-Production Worker
> `dongphugia-media-transform`. Permit its `IMAGES` binding, creation of exactly
> one new Preview-only `MEDIA_TRANSFORM_AUTH_TOKEN` with at least 32 bytes of
> entropy, reuse of the existing zone password only as
> `PUBLISHING_BUNNY_STORAGE_API_KEY`, and the non-Production workers.dev endpoint
> `dongphugia-media-transform.tranhuunguyenhuy.workers.dev` only;
> permit Bunny PUTs only under
> `publishing/leo544-acceptance/run-<run-id>/<source-sha256>/<output-sha256>/` for synthetic JPEG/PNG/WebP
> fixtures. No new resource, credential, binding, custom domain, DNS change,
> canonical media overwrite/deletion, database write, Production action, or
> merge is authorized. Remove/rollback only the exact temporary Worker
> version if approved; delete synthetic Bunny objects only under a separate
> exact-path approval.

The approval is not active for this package because the exact Bunny storage
zone, live staging Pull Zone, and reusable zone-password status remain
unavailable as read-only evidence. If a new zone or credential is required,
that cost/resource/credential mutation needs separate exact Owner approval.
