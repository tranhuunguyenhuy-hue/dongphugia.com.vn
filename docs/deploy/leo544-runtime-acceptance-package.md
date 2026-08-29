# LEO-544 runtime acceptance package

Status: `BLOCKED`. This is a least-privilege proposal only. It does not
retrieve secret values, create or rotate credentials, deploy a Worker, change a
Cloudflare binding/account setting, write Bunny, change DNS, or touch
Production.

## 1. Cloudflare target

| Item | Read-only evidence | Acceptance position |
| --- | --- | --- |
| Account | The repository contains only the `CLOUDFLARE_ACCOUNT_ID` secret name; the account ID value was not retrieved. | `UNKNOWN`; Owner must identify the exact account. |
| Pages project | GitHub repository variable: `CLOUDFLARE_PAGES_PREVIEW_PROJECT=dongphugia-preview`. This is the existing static Preview project, not proof of a Worker target. | Do not use it as the Worker target without explicit Owner confirmation. |
| Worker name | `workers/leo544-media-transform/wrangler.jsonc` declares `dongphugia-media-transform`. | Proposed exact Worker name: `dongphugia-media-transform`; live existence/ownership is `UNKNOWN`. Do not create a replacement Worker automatically. |
| Images binding | The source config declares `images.binding=IMAGES`. | Source binding is present; live binding availability/reuse is `UNKNOWN` until the exact account/Worker is inspected by the Owner. |
| Streams support | The source config declares `streams_enable_constructors`; local Wrangler dry-run passed. | Runtime support is not independently proven without deployment. Do not alter the compatibility flag. |
| Route | Current config has `workers_dev=false` and no `routes`, `domains`, or custom domain. | Proposed mechanism is one non-Production `workers.dev` endpoint for the existing dedicated Worker, with no route and no custom domain. The generated account subdomain/URL is `UNKNOWN`; this is an Owner gate. |

No public DNS or custom-domain change is proposed.

## 2. Bunny target

| Item | Read-only evidence | Acceptance position |
| --- | --- | --- |
| Storage API host | Source allowlist: `sg.storage.bunnycdn.com`. | Proposed exact host, subject to Owner revalidation as non-Production. |
| Storage zone | `PUBLISHING_BUNNY_STORAGE_ZONE_NAME` is blank in `.env.example`; tests use only `preview-zone`. | Exact existing Preview zone is `UNKNOWN`; do not invent or create one. |
| CDN host | Source allowlist and runbook value: `media.dongphugia.vn`. | Proposed exact host only if Owner confirms it is acceptable for synthetic non-Production objects; no DNS change. |
| Credential | `PUBLISHING_BUNNY_STORAGE_API_KEY` is referenced by name only; its existence/value was not inspected. | Existing credential reuse is `UNKNOWN`; no rotation or creation is proposed. |
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
| `CLOUDFLARE_ACCOUNT_ID` | Existing status `UNKNOWN`; only secret name is visible. | GitHub Actions secret or approved Wrangler profile. | Identifier only; no data-plane privilege. | No. |
| `CLOUDFLARE_API_TOKEN` | Existing status `UNKNOWN`; only secret name is visible. | GitHub Actions secret/Wrangler auth. | Exact-account Worker script deployment/edit for the named Worker; no DNS, Pages creation, account-admin, or secret-management permission. Owner must verify the provider permission mapping. | No. |
| `MEDIA_TRANSFORM_AUTH_TOKEN` | Existing status `UNKNOWN`. | Cloudflare Worker Secret for the exact Worker. | Request bearer authentication only. | No; do not create/rotate. |
| `PUBLISHING_BUNNY_STORAGE_API_KEY` | Existing status `UNKNOWN`. | Cloudflare Worker Secret for the exact Worker. | Write access limited to the exact synthetic acceptance zone/prefix; no account management or canonical-media deletion. | No; do not create/rotate. |

`PUBLISHING_BUNNY_STORAGE_ENVIRONMENT`,
`PUBLISHING_BUNNY_STORAGE_ZONE_NAME`, `PUBLISHING_BUNNY_STORAGE_HOSTNAME`,
and `PUBLISHING_BUNNY_CDN_HOSTNAME` are non-secret Worker variables, but their
exact approved values still require Owner confirmation. No credential mutation
is authorized by this package.

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

> APPROVED — run LEO-544 runtime acceptance only against the exact existing
> non-Production Cloudflare account/Worker and exact existing Bunny Preview
> zone identified in the preflight. Reuse existing least-privilege credentials
> without retrieving or rotating them. Permit one reviewed Worker version,
> `IMAGES` binding reuse, and a non-Production `workers.dev` mechanism only;
> permit Bunny PUTs only under
> `publishing/leo544-acceptance/run-<run-id>/<source-sha256>/<output-sha256>/` for synthetic JPEG/PNG/WebP
> fixtures. No new resource, credential, binding, custom domain, DNS change,
> canonical media overwrite/deletion, database write, Production action, or
> merge is authorized. Remove/rollback only the exact temporary Worker
> version if approved; delete synthetic Bunny objects only under a separate
> exact-path approval.

The approval is not active for this package because the exact account, live
Worker/binding, route, Bunny zone, and existing credential status are not yet
available as read-only evidence.
