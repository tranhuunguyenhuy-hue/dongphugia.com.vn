# LEO-565 media and recovery baseline

Status: Round 2 Owner-approved Preview execution is complete. Source, local,
remote synthetic acceptance, and sanitized provider evidence are recorded
below. This document does not authorize PR merge, Production, DNS/traffic,
legacy cleanup, bulk media migration, or any further provider/schema/privilege
mutation.

## Authority and boundary

The execution authorities are Linear LEO-565, ADR 0017 / LEO-558, the
`dpg_v1` contract from LEO-561, and the Auth/RLS/service boundaries from
LEO-564. LEO-540/552 and canceled LEO-544 are implementation references only.
The existing Production UI and legacy Publishing Bunny implementation are not
V1 media authority.

The Round 1 source/local section below is historical. The Round 2 execution
section supersedes its proposed resource names and records the exact approved
Preview resources and evidence.

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

## Historical Round 1 read-only discovery snapshot — 2026-09-01

The following states were evidence for the former gate and are retained for
history only. They are not current Round 2 resource recommendations.

| Area | Read-only result | Disposition |
| --- | --- | --- |
| Bunny account, Storage Zones, regions, Pull Zones, delivery hostnames | Authenticated Bunny dashboard account confirmed; account identifier/email intentionally redacted. Four Storage Zones and four Pull Zones are present: `dpg-products` (zone `1454608`, PZ `5645144`, Standard/Replicated, `191,559` objects/`54.3 GB`, main Singapore plus New York and Sao Paulo, default `dpg-products.b-cdn.net`, custom `cdn.dongphugia.com.vn`); `dpg-publishing-production` (zone `1741127`, PZ `6327027`, `206`/`6.37 MB`, main Frankfurt plus Los Angeles/New York/Singapore, default `dpg-publishing-production.b-cdn.net`, custom `media.dongphugia.vn`); `dpg-publishing-production-r2` (zone `1741228`, PZ `6327219`, empty, main Frankfurt plus Los Angeles/New York/Singapore, default `dpg-publishing-production-r2.b-cdn.net`, origin is the same empty zone); and `dpg-publishing-staging` (zone `1740050`, PZ `6324802`, `14`/`13.53 KB`, main Frankfurt plus Los Angeles/New York/Singapore, default `dpg-publishing-staging.b-cdn.net`). | No current resource is unconditionally safe for V1 Preview reuse. `dpg-publishing-production-r2` is the only technically clean conditional public-delivery candidate, but its production-r2 identity is not proof of Preview isolation; require explicit Owner attestation or create the dedicated two-boundary shape below. Never use the populated product, Publishing production, or legacy staging resources. |
| Bunny exact Preview reuse/create recommendation | Safe reuse: `NONE` without an explicit isolation attestation. Conditional candidate: empty `dpg-publishing-production-r2` (`1741228` + PZ `6327219`) for public delivery only; it has zero objects and zero observed traffic, but is not Preview-labelled. The former dedicated two-boundary creation proposal was superseded by the exact Owner-approved resources recorded in the Round 2 section below. | Historical proposal only; do not create, rename, repoint, upload, purge, or delete from this snapshot. |
| Bunny credential scope by name only | Dashboard exposes `Access Key`, `Password`, and `Read-only password` labels; values were not inspected. Repository/GitHub name-only evidence has legacy Publishing variables `PUBLISHING_BUNNY_STORAGE_ENVIRONMENT`, `PUBLISHING_BUNNY_STORAGE_ZONE_NAME`, `PUBLISHING_BUNNY_STORAGE_API_KEY`, `PUBLISHING_BUNNY_STORAGE_HOSTNAME`, and `PUBLISHING_BUNNY_CDN_HOSTNAME`; no Bunny GitHub secret name was listed. | Round 2 requires separate backend-only zone-level write/read scope for the media adapter and a separate read-only scope for backup/read verification. No browser credential, broad account credential, or value was exposed. |
| Bunny account cost/commitment | Dashboard showed current September usage `$0.02` (`$0.02` Storage and `<$0.01` CDN), `21 MB` bandwidth, and the account's prepaid/auto-recharge setting enabled; latest monthly usage record shown was `$1.81` for August. No new plan or commitment was changed. | Account-specific fixed commitment was not shown; current evidence supports pay-as-you-go usage, subject to revalidation. Standard Storage is `$0.01/GB` per region for up to two regions, `$0.005/GB` for each additional region, with a `$1` monthly minimum; CDN delivery is traffic-priced and also has a `$1` monthly minimum. Exact Round 2 delta depends on bytes, replicas, and traffic. See [Bunny Storage pricing](https://bunny.net/pricing/storage/) and [Bunny CDN pricing](https://bunny.net/pricing/cdn/). |
| Cloudflare account, Images plan/usage | Authenticated Cloudflare dashboard account confirmed; account identifier/email intentionally redacted. Subscription rows show `Workers Free` active and `Images Stream Basic` active through 2026-09-27. Hosted Images shows `Images delivered 0` and storage `Not applicable in your plan`; Images Transformations shows no zones and `Unique transformations 0`. No hosted Images storage add-on was selected. | Cloudflare Images is retained as upload-time transformation only; no hosted media store or delivery authority is proposed. |
| Cloudflare Workers/media resources | Workers & Pages showed current-period billable usage `$0.00`, `185` requests, `5,870 ms` CPU, `0` observability events, and `0` build minutes. Existing Worker `dongphugia-v1-public-preview` has no active routes, workers.dev `Previews Only`, no custom domains/routes, and exactly one `ASSETS` binding; Pages `dongphugia-preview.pages.dev` has no Git connection. No Stream video/input list was surfaced. | Existing public/render Worker is not a media-transform seam and must not be broadened implicitly. |
| Cloudflare Preview transform seam and binding | The source contract requires an injected Cloudflare Images binding for raw-byte upload-time transforms. The existing public Worker had no `IMAGES` binding. | A separate Preview-only media-transform Worker was required and is recorded in the executed Round 2 section below. |
| Cloudflare cost implication | Current Workers billable usage is `$0.00`; Images unique transformations are `0`. The source profile has at most three variants per synthetic source, so Round 2 sample use remains below the documented 5,000 unique-transformation free allowance if no other usage changes. | No cost change occurred. If paid Images usage is reached, current pricing is `$0.50/1,000` unique transformations after the first 5,000, plus hosted storage/delivery only if Images storage is enabled (`$5/100,000` stored images and `$1/100,000` delivered). See [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/). |
| Supabase `dongphugia-runtime` | Read-only target identity is `ap-southeast-1`, PostgreSQL 17.6; LEO-565 is absent remotely | `dpg_v1` media state is empty; legacy media remains unmigrated |
| Current legacy media | `dpg_app.product_images` and managed/publishing media remain legacy evidence | No bulk migration, cleanup, deletion, or overwrite was performed |
| Current `dpg_backup` | Read-only role is non-superuser/non-createdb/non-createrole/non-replication/non-BYPASSRLS; current remote SELECT coverage includes dpg_app/dpg_control but not dpg_v1 | Round 1 extends source backup controls to dpg_app + dpg_v1 + dpg_control and grants only explicit V1 SELECT after the later remote gate |

The historical dashboard inventory is retained for reconciliation context.
Public Bunny API documentation describes the account-scoped Storage
Zone and Pull Zone surfaces but does not replace the dashboard evidence: [List
Storage Zones](https://bunny.net/docs/api-reference/core/storage-zone/list-storage-zones)
and [List Pull Zones](https://bunny.net/docs/api-reference/core/pull-zone/list-pull-zones).
The historical discovery itself did not mutate provider, billing, DNS, traffic,
credential, or Supabase remote state.

## Round 2 Owner-approved Preview execution evidence — 2026-09-01

The following is the current, exact-scope evidence. All writes listed here
were limited to the Owner-approved Preview resources and synthetic/sample
media. No Production, DNS, custom domain, legacy resource, or bulk media
operation was performed.

### Bunny

- `dpg-v1-preview-originals`: Storage Zone `1804337`, Standard, main region
  Frankfurt, Germany, no replica regions, no Pull Zone, and no custom
  hostname. It contains only the bounded synthetic private-original proof
  under `private/originals/v1/`.
- `dpg-v1-preview-delivery`: Storage Zone `1804338`, Standard, main region
  Frankfurt, Germany, no replica regions, and no custom hostname. Pull Zone
  `dpg-v1-preview-delivery` is `6457247`, backed by that Storage Zone, with
  the sole default delivery hostname
  `dpg-v1-preview-delivery.b-cdn.net`.
- The dedicated delivery Pull Zone has no custom domain, no custom hostname,
  and no Bunny Optimizer. The four pre-existing legacy zones and their Pull
  Zones were not reused, repointed, deleted, or purged. No
  `dpg-leo565-preview-*` resource exists.
- Synthetic private original evidence includes an image at
  `private/originals/v1/ee/<source-sha>/source.png` (1,600x900, 21,705
  bytes) and a PDF at `private/originals/v1/eb/<pdf-sha>/document.pdf`
  (65 bytes). Synthetic public image variants are the three locked
  `product-v1` widths (320/640/1280); the PDF delivery object is under
  `public/documents/v1/<pdf-sha>/document.pdf`. The exact SHA values are
  recorded in the sanitized acceptance output and tests, not in credentials
  or URLs.
- Direct unauthenticated public delivery returned HTTP 200 with the expected
  `image/webp` and `application/pdf` content types and verified bytes. A
  second synthetic private `input.png` test object remains in the originals
  zone; it is an intentionally retained non-production fixture because no
  destructive cleanup was authorized.
- Bunny dashboard evidence identifies the signed-in account and exposes
  zone-scoped `Access Key`, `Password`, and `Read-only password` fields. Only
  backend-only zone-scoped write/read access for the two dedicated zones and
  separate read-only verification access are in scope; values were never
  inspected, logged, committed, or reported. The repository's legacy
  Publishing credential names remain unchanged and are not used for V1.
- Current Bunny dashboard billing shows September usage of `$0.03` (Storage
  `$0.03`, CDN `<$0.01`), 24 MB bandwidth, and account balance `$2.90`;
  auto-recharge was already enabled. No plan upgrade or new fixed commitment
  was accepted. The exact Round 2 cost implication is usage-based storage and
  CDN traffic only; no replica or Optimizer charge was introduced. See
  [Bunny Storage pricing](https://bunny.net/pricing/storage/) and [Bunny CDN
  pricing](https://bunny.net/pricing/cdn/).

### Cloudflare

- The authenticated account is the existing Tranhuunguyenhuy account. The
  active subscription rows are `Workers Free` and `Images Stream Basic`
  (through 2026-09-27). Billable usage currently shows `$0.00`, with no usage
  data charge in the current observation window.
- Hosted Images shows `Images stored: Not applicable in your plan`; no hosted
  Images storage was enabled. Images Transformations has no configured zone
  and no observed unique transformation usage in the dashboard/API evidence.
- The only Worker resources surfaced for this account are
  `dongphugia-v1-public-preview` and the dedicated
  `dongphugia-v1-media-preview`. The existing public-preview Worker was not
  modified. The active versioned Preview host is
  `162480f5-dongphugia-v1-media-preview.tranhuunguyenhuy.workers.dev`; the
  base production workers.dev URL is disabled. The Worker has the reviewed
  backend-only secret authorization and exactly these bindings/config names:
  `IMAGES` (Images), `MEDIA_TRANSFORM_AUTH_TOKEN` (secret), `APP_ENV`
  (`preview`), and `PREVIEW_NOINDEX` (`true`). Secret values are not present
  in source, logs, PR evidence, or this document.
- The new Worker has no custom domain and no route. The source configuration
  enables workers.dev preview URLs and contains no Production route or DNS
  change; the dashboard has Preview URLs enabled and the production workers.dev
  URL disabled. A new Preview Worker/binding was required because the existing
  public-preview Worker had no IMAGES binding; no binding was added to it.
- Cloudflare cost implication is `$0` fixed expansion and `$0` observed
  billable usage: no Workers Paid/Images hosted-storage upgrade, fixed
  commitment, or paid feature was enabled. The accepted synthetic transform
  stays within the documented free unique-transform allowance; any future
  overage would be usage-priced and requires a separate gate. See
  [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/)
  and [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/).

### Supabase and recovery

- Exact target: project `dongphugia-runtime`, ref
  `tlmgudfhsyzayiazuugf`, PostgreSQL 17.6 in `ap-southeast-1`. Migration
  `leo565_media_foundation` is applied at remote version
  `20260901150135`; the applied source SHA-256 is
  `5576217f4b217b1b6ec6250f14fd4f67166da8746b75171bbcb616324809a3ea`.
- `dpg_backup` remains a non-login, non-superuser, non-createdb,
  non-createrole, non-BYPASSRLS role. Sanitized privilege evidence is
  SELECT-only for the reviewed V1 recovery surface: `dpg_app` 64 tables,
  `dpg_v1` 36 tables, and `dpg_control` 2 tables; zero write privileges were
  observed. No unrelated Auth, legacy schema, project, or credential change
  was made.
- The existing LEO-540/552 recovery system was extended rather than replaced.
  The disposable PostgreSQL 17 rehearsal passed age encryption, SHA-256
  verification, sanitized manifest generation, isolated restore, and semantic
  validation for `dpg_app + dpg_v1 + dpg_control`, including Product/Family,
  media/variants, staff, and commerce state. Exact-SHA dispatch, 14-day
  retention, tmpfs plaintext controls, and secret/row-safe evidence remain in
  force. The local macOS harness used compatibility wrappers only for missing
  host `psql`/`findmnt`; the source scripts retain the native tmpfs guard and
  the isolated restore database used tmpfs and no network.

### Synthetic acceptance

The same generated TypeScript payloads were sent through
`catalogue_media_register` and `catalogue_media_mark_ready`; no replacement
JSON was used. The resulting sanitized remote transaction rolled back its
fixtures after acceptance.

| Acceptance | Result |
| --- | --- |
| image validation, Cloudflare transform, Bunny original/variants, registration, provider verification, READY | PASS |
| Product PRIMARY and GALLERY attachment | PASS |
| MIME spoof, malformed, oversized, invalid image, and upscale denial | PASS |
| duplicate/replay determinism | PASS |
| output-SHA immutable-key conflict protection across offline/Cloudflare pipelines | PASS |
| valid PDF original/delivery, READY, and technical-document attachment | PASS |
| invalid PDF and arbitrary external media URL denial | PASS |
| public Bunny image/PDF HTTP delivery | PASS |
| browser privileged-secret count | 0 |
| encrypted V1 backup, checksum, manifest, PG17 isolated restore, semantic match | PASS |
| deterministic regeneration from private original and locked `product-v1` profile | PASS |
| silent paid-plan enablement | NONE OBSERVED |

The immutable delivery identity is
`profile-version + source SHA + target width + generated output SHA` for
images. The cross-pipeline test deliberately emits different valid WebP bytes
from offline and Cloudflare paths, then proves their keys remain distinct and
neither path overwrites the other. Sharp/Cloudflare byte equivalence is not
assumed.

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

## Round 2 mutation boundary — executed; no further mutation

The approved Round 2 mutation set was executed exactly once against the
dedicated Preview resources recorded above: the reviewed Supabase migration
and minimum V1 backup privileges, the two Frankfurt Bunny Storage Zones and
one delivery Pull Zone, and the dedicated Cloudflare Preview transform Worker
with its IMAGES binding. Only synthetic/sample bytes were used for acceptance.

The remaining boundary is closed. Do not merge PR #140, touch Production,
custom DNS, traffic, legacy Bunny/Supabase resources, hosted Images storage,
Bunny Optimizer, or bulk media. Any additional provider/schema/privilege
mutation requires a fresh explicit gate.
