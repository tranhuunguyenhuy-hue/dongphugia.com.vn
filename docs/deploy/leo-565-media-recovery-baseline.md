# LEO-565 media and recovery baseline

Status: Round 1 source/local implementation ready for the Remote Preview Owner
Gate. This document records a dated read-only discovery snapshot and does not
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
  `private/originals/v1/<prefix>/<sha256>/source.<ext>`. Delivery objects use
  content-addressed/versioned keys under `public/images/product-v1/` or
  `public/documents/v1/`; public keys are never overwritten and no prefix
  deletion operation exists in the adapter.
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
| Bunny Storage Zones, regions, Pull Zones, hostnames, credential scope | `UNKNOWN`; no authenticated Bunny discovery connector/credential was available | Do not reuse a production or legacy resource; obtain an exact Owner-attested resource set in Round 2 |
| Existing public Bunny hostnames | `cdn.dongphugia.com.vn` resolves to `dpg-products.b-cdn.net`; `media.dongphugia.vn` resolves to `dpg-publishing-production.b-cdn.net`; both public probes returned 404 at root | Production/legacy evidence only; no safe isolated V1 Preview reuse proven |
| Bunny staging candidate | `dpg-publishing-staging.b-cdn.net` did not resolve | Not a reuse candidate until separately attested |
| Bunny account cost/commitment | Account-specific state `UNKNOWN`; no commitment or plan was mutated | Public pricing indicates Standard Storage has a USD 1 monthly minimum and pay-as-you-go rates; CDN rates vary by region. Confirm the account quote at the Owner gate |
| Cloudflare Images plan/usage | `UNKNOWN`; authenticated read-only API discovery was rejected | No Images binding, plan, usage, or billing claim is a pass |
| Cloudflare media Workers/bindings | `UNKNOWN` for live account state; repository contains only named secret/variable references | Existing LEO-563 app Preview resources are not a V1 media seam; no safe reuse proven |
| Supabase `dongphugia-runtime` | Read-only target identity is `ap-southeast-1`, PostgreSQL 17.6; LEO-565 is absent remotely | `dpg_v1` media state is empty; legacy media remains unmigrated |
| Current legacy media | `dpg_app.product_images` and managed/publishing media remain legacy evidence | No bulk migration, cleanup, deletion, or overwrite was performed |
| Current `dpg_backup` | Read-only role is non-superuser/non-createdb/non-createrole/non-replication/non-BYPASSRLS; current remote SELECT coverage includes dpg_app/dpg_control but not dpg_v1 | Round 1 extends source backup controls to dpg_app + dpg_v1 + dpg_control and grants only explicit V1 SELECT after the later remote gate |

Public Bunny pricing references used for the cost boundary: [Storage
pricing](https://bunny.net/pricing/storage/) and [Bunny pricing](https://bunny.net/pricing/).

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

## Exact Round 2 Preview mutation set — Owner gate required

Only after an unchanged-scope Owner approval and fresh preflight may Round 2:

1. apply the reviewed LEO-565 Supabase migration to the exact
   `dongphugia-runtime` Preview target, including explicit V1 `dpg_backup`
   SELECT-only privileges;
2. create or reuse one exact Bunny private-original Storage Zone and one exact
   public-delivery Storage/Pull Zone/hostname, with minimum scoped credentials,
   synthetic-only bounded bytes, read-after-write verification, and no legacy
   resource mutation;
3. configure one reviewed Preview-only Cloudflare Images transform binding and
   backend authorization seam, with `workers.dev`/noindex isolation only if
   the live read-only discovery proves the exact target and the Owner approves
   the resource; and
4. run the synthetic end-to-end provider verification and sanitized recovery
   evidence against those exact resources.

Round 2 excludes Production, custom DNS, traffic, paid-plan changes, Bunny
Optimizer, Cloudflare Production, Supabase Storage as canonical authority,
legacy media migration/cleanup, and Admin/PDP/editor media UI.
