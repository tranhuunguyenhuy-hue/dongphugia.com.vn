# LEO-565 media and recovery baseline

Status: Round 1 V2 source/local implementation and authenticated Bunny and
Cloudflare read-only reconciliation are complete. The Remote Preview Owner
Gate is not approved by this document. This dated discovery snapshot does not
authorize a provider write, remote schema or privilege change, Preview
publication, Production change, DNS/traffic change, paid-plan change, legacy
cleanup, or bulk media migration.

## Authority and boundary

The execution authorities are Linear LEO-565, ADR 0017 / LEO-558, the
`dpg_v1` contract from LEO-561, and the Auth/RLS/service boundaries from
LEO-564. LEO-540/552 and canceled LEO-544 are implementation references only.
The existing Production UI and legacy Publishing Bunny implementation are not
V1 media authority.

Round 1 adds source contracts and a Supabase migration only. It does not apply
that migration to the remote `dongphugia-runtime` project.

## V1 media contract

- Bunny is the canonical byte and public-delivery authority after the exact
  Preview gate. Supabase stores metadata, immutable object keys, checksums,
  MIME, dimensions, profile, provenance, and readiness state.
- Original bytes use a private, content-addressed key under
  `private/originals/v1/<prefix>/<sha256>/source.<ext>`. Image delivery
  objects use `public/images/product-v1/<source-sha256>/w<target-width>-<output-sha256>.webp`;
  PDF delivery objects use `public/documents/v1/<sha256>/document.pdf`.
  Public keys retain profile/source/target identity and include the generated
  output SHA, so distinct approved transformers cannot collide merely by
  emitting different valid bytes. Public keys are never overwritten and no
  prefix deletion operation exists in the adapter.
- `product-v1` is locked to WebP quality 82 and widths 320, 640, and 1280,
  with no enlargement and at most three variants. A source smaller than the
  first target receives one actual-size-or-smaller `w320` variant.
- Images require signature/MIME agreement, decoded dimensions, pixel and byte
  bounds, SHA-256, and deterministic variant metadata. PDFs require bounded
  bytes, `application/pdf`, and PDF header/EOF validation; they are not
  transformed.
- A media asset remains `PENDING` until the exact Bunny original and every
  delivery object is read back and reconciled. Only the LEO-564-authenticated
  service boundary can register, verify, attach, and tombstone metadata.
- Cloudflare Images is an injected upload-time transform seam only. It is not
  an authoritative byte store, delivery origin, browser credential surface, or
  automatic billing upgrade.

The offline command `npm run media:process:product-v1 -- --input <file>
--kind IMAGE|DOCUMENT --mime <mime>` uses the same validation, profile, key,
checksum, and deterministic processing contracts without provider calls.

## Read-only discovery snapshot — 2026-09-01

The following states are evidence for the next gate, not durable provider
authority. Revalidate exact identity, scope, price, and exclusions immediately
before any Round 2 mutation.

| Area | Read-only result | Disposition |
| --- | --- | --- |
| Bunny account, Storage Zones, regions, Pull Zones, delivery hostnames | Authenticated Bunny dashboard account confirmed; account identifier/email intentionally redacted. Four Storage Zones and four Pull Zones are present: `dpg-products` (zone `1454608`, PZ `5645144`, Standard/Replicated, `191,559` objects/`54.3 GB`, main Singapore plus New York and Sao Paulo, default `dpg-products.b-cdn.net`, custom `cdn.dongphugia.com.vn`); `dpg-publishing-production` (zone `1741127`, PZ `6327027`, `206`/`6.37 MB`, main Frankfurt plus Los Angeles/New York/Singapore, default `dpg-publishing-production.b-cdn.net`, custom `media.dongphugia.vn`); `dpg-publishing-production-r2` (zone `1741228`, PZ `6327219`, empty, main Frankfurt plus Los Angeles/New York/Singapore, default `dpg-publishing-production-r2.b-cdn.net`, origin is the same empty zone); and `dpg-publishing-staging` (zone `1740050`, PZ `6324802`, `14`/`13.53 KB`, main Frankfurt plus Los Angeles/New York/Singapore, default `dpg-publishing-staging.b-cdn.net`). | No current resource is unconditionally safe for V1 Preview reuse. `dpg-publishing-production-r2` is the only technically clean conditional public-delivery candidate, but its production-r2 identity is not proof of Preview isolation; require explicit Owner attestation or create the dedicated two-boundary shape below. Never use the populated product, Publishing production, or legacy staging resources. |
| Bunny exact Preview reuse/create recommendation | Safe reuse: `NONE` without an explicit isolation attestation. Conditional candidate: empty `dpg-publishing-production-r2` (`1741228` + PZ `6327219`) for public delivery only; it has zero objects and zero observed traffic, but is not Preview-labelled. Exact create recommendation if isolation is required: Standard Frankfurt zone `dpg-leo565-preview-originals` with no Pull Zone for private originals, plus Standard Frankfurt zone `dpg-leo565-preview-delivery` with one default-hostname Pull Zone `dpg-leo565-preview-delivery.b-cdn.net` for public delivery. No custom DNS and no optional replica regions unless separately approved. | Proposed names and shape are Round 2 only. Do not create, rename, repoint, upload, purge, or delete anything in Round 1. |
| Bunny credential scope by name only | Dashboard exposes `Access Key`, `Password`, and `Read-only password` labels; values were not inspected. Repository/GitHub name-only evidence has legacy Publishing variables `PUBLISHING_BUNNY_STORAGE_ENVIRONMENT`, `PUBLISHING_BUNNY_STORAGE_ZONE_NAME`, `PUBLISHING_BUNNY_STORAGE_API_KEY`, `PUBLISHING_BUNNY_STORAGE_HOSTNAME`, and `PUBLISHING_BUNNY_CDN_HOSTNAME`; no Bunny GitHub secret name was listed. | Round 2 requires separate backend-only zone-level write/read scope for the media adapter and a separate read-only scope for backup/read verification. No browser credential, broad account credential, or value was exposed. |
| Bunny account cost/commitment | Dashboard showed current September usage `$0.02` (`$0.02` Storage and `<$0.01` CDN), `21 MB` bandwidth, and the account's prepaid/auto-recharge setting enabled; latest monthly usage record shown was `$1.81` for August. No new plan or commitment was changed. | Account-specific fixed commitment was not shown; current evidence supports pay-as-you-go usage, subject to revalidation. Standard Storage is `$0.01/GB` per region for up to two regions, `$0.005/GB` for each additional region, with a `$1` monthly minimum; CDN delivery is traffic-priced and also has a `$1` monthly minimum. Exact Round 2 delta depends on bytes, replicas, and traffic. See [Bunny Storage pricing](https://bunny.net/pricing/storage/) and [Bunny CDN pricing](https://bunny.net/pricing/cdn/). |
| Cloudflare account, Images plan/usage | Authenticated Cloudflare dashboard account confirmed; account identifier/email intentionally redacted. Subscription rows show `Workers Free` active and `Images Stream Basic` active through 2026-09-27. Hosted Images shows `Images delivered 0` and storage `Not applicable in your plan`; Images Transformations shows no zones and `Unique transformations 0`. No hosted Images storage add-on was selected. | Cloudflare Images is retained as upload-time transformation only; no hosted media store or delivery authority is proposed. |
| Cloudflare Workers/media resources | Workers & Pages showed current-period billable usage `$0.00`, `185` requests, `5,870 ms` CPU, `0` observability events, and `0` build minutes. Existing Worker `dongphugia-v1-public-preview` has no active routes, workers.dev `Previews Only`, no custom domains/routes, and exactly one `ASSETS` binding; Pages `dongphugia-preview.pages.dev` has no Git connection. No Stream video/input list was surfaced. | Existing public/render Worker is not a media-transform seam and must not be broadened implicitly. |
| Cloudflare Preview transform seam and binding | The source contract requires an injected Cloudflare Images binding for raw-byte upload-time transforms. The existing public Worker has no `IMAGES` binding. | A separate Preview-only media-transform Worker, proposed name `dongphugia-v1-media-preview`, with an `IMAGES` binding is required if Round 2 exercises the Cloudflare path. Use workers.dev/Preview only, no custom route/domain, no Production deployment, and no hosted Images storage. No Worker or binding was created. See [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/) and [Cloudflare Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/). |
| Cloudflare cost implication | Current Workers billable usage is `$0.00`; Images unique transformations are `0`. The source profile has at most three variants per synthetic source, so Round 2 sample use remains below the documented 5,000 unique-transformation free allowance if no other usage changes. | No cost change occurred. If paid Images usage is reached, current pricing is `$0.50/1,000` unique transformations after the first 5,000, plus hosted storage/delivery only if Images storage is enabled (`$5/100,000` stored images and `$1/100,000` delivered). See [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/). |
| Supabase `dongphugia-runtime` | Read-only target identity is `ap-southeast-1`, PostgreSQL 17.6; LEO-565 is absent remotely | `dpg_v1` media state is empty; legacy media remains unmigrated |
| Current legacy media | `dpg_app.product_images` and managed/publishing media remain legacy evidence | No bulk migration, cleanup, deletion, or overwrite was performed |
| Current `dpg_backup` | Read-only role is non-superuser/non-createdb/non-createrole/non-replication/non-BYPASSRLS; current remote SELECT coverage includes dpg_app/dpg_control but not dpg_v1 | Round 1 extends source backup controls to dpg_app + dpg_v1 + dpg_control and grants only explicit V1 SELECT after the later remote gate |

The dashboard inventory is read-only evidence and must be revalidated against
the exact target, scope, price, and exclusions immediately before any Round 2
mutation. Public Bunny API documentation describes the account-scoped Storage
Zone and Pull Zone surfaces but does not replace the dashboard evidence: [List
Storage Zones](https://bunny.net/docs/api-reference/core/storage-zone/list-storage-zones)
and [List Pull Zones](https://bunny.net/docs/api-reference/core/pull-zone/list-pull-zones).
No provider, billing, DNS, traffic, credential, or Supabase remote state was
mutated during this discovery.

## Recovery extension

The existing LEO-540/552 path remains the only recovery system. Round 1
extends its encrypted PostgreSQL logical dump, sanitized schema/data manifest,
and restore semantic report to `dpg_app`, `dpg_v1`, and `dpg_control`.

The preserved controls are age encryption, SHA-256 sidecars, 14-day artifact
retention, tmpfs-only plaintext handling, PostgreSQL 17 isolated restore,
protected exact-SHA dispatch, network-disabled rehearsal, and secret/row-safe
workflow output. V1 manifests contain aggregate row counts and row hashes;
restore validation covers Product, Product Family, media/variant readiness and
keys, staff, and commerce state. A synthetic proof deterministically regenerates
the public image variants from a private original and the locked profile.
Recovery validation checks the output-SHA-bearing image key contract and the
source/output relationship; it does not claim Sharp and Cloudflare Images
produce byte-identical WebP output.

## Exact Round 2 Preview mutation set — Owner gate required

Only after an unchanged-scope Owner approval and fresh preflight may Round 2:

1. apply the reviewed LEO-565 Supabase migration to the exact
   `dongphugia-runtime` Preview target, including explicit V1 `dpg_backup`
   SELECT-only privileges;
2. either obtain explicit isolation attestation for `dpg-publishing-production-r2`
   as a public-delivery-only Preview candidate (while creating a separate
   private-original boundary), or create the exact dedicated Bunny
   `dpg-leo565-preview-originals` and `dpg-leo565-preview-delivery` shape above;
   issue minimum scoped backend-only credentials, write synthetic bounded bytes,
   and verify by read-after-write without touching legacy resources;
3. configure one reviewed Preview-only Cloudflare Images transform Worker with
   an `IMAGES` binding and backend authorization seam, with `workers.dev`/noindex
   isolation only; do not broaden `dongphugia-v1-public-preview`; and
4. run the synthetic end-to-end provider verification and sanitized recovery
   evidence against those exact resources.

Round 2 excludes Production, custom DNS, traffic, paid-plan changes, Bunny
Optimizer, Cloudflare Production, Supabase Storage as canonical authority,
legacy media migration/cleanup, and Admin/PDP/editor media UI.
