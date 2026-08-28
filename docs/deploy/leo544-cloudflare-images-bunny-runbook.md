# LEO-544 Cloudflare Images to Bunny source proof

Status: source-only Preview proof. This runbook does not authorize a Worker
deployment, Cloudflare binding activation, Bunny write, credential creation,
Production media write, DNS/traffic change, paid tier, or merge.

## Contract

`workers/leo544-media-transform/src/index.ts` accepts one authenticated raw
image request per locked variant:

```text
POST /v1/media-transform/{identityId}/{assetId}/{variant}
Content-Type: image/jpeg | image/png | image/webp
Authorization: Bearer <future Owner-managed Preview secret>
X-Source-SHA256: <64 lowercase hexadecimal characters>
X-Source-Width: <attested integer>
X-Source-Height: <attested integer>
```

The request body is bounded by 5 MiB and is passed as a Web `ReadableStream`
to `env.IMAGES.input(...)`. A tee computes SHA-256 on a bounded branch, and the
digest must match the authenticated caller's attestation. The authenticated
caller also attests source dimensions; the Worker rejects sources over the
existing 40 megapixel limit before invoking delivery. The transformed WebP
response body is streamed directly to the existing Bunny-compatible storage
contract. No source bytes, Cloudflare response body, Bunny credential, or
response secret is logged or persisted by this Worker.

The stream validates the JPEG, PNG, or WebP file signature against the declared
MIME type before the Images binding receives it. The Images binding remains the
authoritative decoder for complete file validity.

The seven locked variants are the existing Publishing envelope:

- `thumbnail.w640`, `thumbnail.w960`
- `cover.w720`, `cover.w1280`, `cover.w1600`
- `inline.w640`, `inline.w960`

Object paths are deterministic and digest-addressed:
`publishing/{identityId}/{assetId}/{sourceSha256}/{variant}.webp`. Repeating
an exact request is an idempotent PUT to the same Bunny object; a different
source digest cannot overwrite that object's path. Bunny delivery retries one
transient failure with the same path and a bounded 10-second attempt timeout.
Errors are emitted as structured status/code events without request paths,
source data, or credentials; Wrangler observability is enabled in the source
config. The Worker does not delete an existing object after an ambiguous
storage failure.

The Worker uses `streams_enable_constructors`, requests metadata preservation,
does not import Node APIs, Sharp, libvips, or the existing Next.js route, and
does not change the public Managed Media URL contract. Inline variants
intentionally omit a forced height because they preserve the source aspect
ratio; the response reports `height` as `null` in that case.

The source proof hard-codes the reviewed Bunny targets: `sg.storage.bunnycdn.com`
for Preview storage and `media.dongphugia.vn` for the Publishing CDN. A
different hostname is a configuration failure and requires a new reviewed
Owner target decision.

## Disabled-by-default boundary

`workers/leo544-media-transform/wrangler.jsonc` contains only the source
binding declaration and compatibility flag. It has no account ID, route,
custom domain, secret, environment value, or active deployment configuration.
`workers_dev` is false. Running Wrangler, creating the binding, supplying a
Bunny key, or invoking the endpoint requires a fresh Owner decision for the
exact Preview target and candidate.

Before any future activation, revalidate the current Images transformation
allowance and definition, the existing Bunny storage zone/hostname and
usage/cost boundary, the exact Preview isolation and noindex contract, and a
secret-safe authentication/rollback procedure. The accepted planning envelope
is at most seven variants per source; an allowance or plan change is `BLOCKED`
until reapproved.

## Validation

The focused Vitest suite uses mock Images and Bunny transports only. It proves
stream input/output, the seven-variant limit, bounded source input, Preview
environment fail-closed behavior, deterministic Bunny delivery paths, and the
absence of a Production activation path. It is not evidence of a live
Cloudflare binding, Bunny write, deployed Worker, Preview browser result, or
current provider quota.

## Rollback / recovery

Before activation, rollback is source revert or PR closure. If a future
Owner-authorized Preview activation writes an exact Bunny object, recovery must
name the exact object path and owner-approved deletion procedure. Do not delete
by prefix and do not remove an object after an uncertain PUT response unless
ownership of that exact new object has been established.
