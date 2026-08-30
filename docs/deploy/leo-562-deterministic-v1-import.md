# LEO-562 deterministic Legacy-to-V1 import

This runbook owns the local, replayable mapping from the immutable LEO-560 raw
source into the private `dpg_v1` schema created by LEO-561. It does not
authorize a Supabase, Staging, New Production, Production, media-provider, AWS
configuration, IAM, Cloudflare, Bunny, DNS, or deployment mutation.

The sanitized full-data result is recorded in
`leo-562-deterministic-v1-import-evidence.json`. The detailed quarantine file
contains only source IDs, canonical IDs, reason codes, and hashes of legacy
media references. It remains a mode-`0600` local ephemeral artifact and is not
committed.

## Safety contract

- The dump SHA-256 must equal
  `86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1`.
- Both database URLs must resolve to `localhost`, `127.0.0.1`, or `::1`, and
  source and target database names must differ.
- The source transaction is `REPEATABLE READ READ ONLY DEFERRABLE`.
- The target must already contain the LEO-561 schema and exactly four root
  Categories. The importer never applies or changes that schema.
- UUIDs, ordering, mapping outcomes, quarantine outcomes, and output checksums
  derive only from the fixed source, code, and configuration. The second run
  uses the same upserts and must match the first run exactly.
- Raw Product rows, URLs, content, specs JSON, and media bytes never enter the
  repository evidence.

## Mapping decisions

### Product, Brand, and Category

One exact normalized legacy SKU becomes both canonical `sku` and `model`; no
master/child or generated variant identity is used. A Package/Combo or Product
with component SKUs is not one manufacturer model and is quarantined as
`UNSUPPORTED_LEGACY_STRUCTURE`.

Brands map only through the exact legacy Brand FK after uniqueness validation.
Category mapping first accepts exactly one active primary `catalog_taxons`
leaf. If no assignment exists, it accepts only an exact legacy root-sector plus
subcategory-slug match to one canonical leaf. The legacy Category/Subcategory
tables are mapping evidence only and are not copied as runtime authority.

### Price and availability

No legacy price field is promoted into V1. Even a positive, high-confidence
legacy `products.price` is recorded only as a candidate disposition because
LEO-561 explicitly deprecates the legacy price/fallback stack and V1 requires
a new DPG-owned retail price. Therefore every imported Product has
`retail_price = NULL` and remains publication-withheld.

`in_stock` maps to `IN_STOCK`, `discontinued` maps to `DISCONTINUED`, and any
unknown value maps fail-closed to `CONTACT`. A discontinued Product cannot
publish.

### Family and MS885

Only the LEO-534-approved `toto:ms885` contract is imported: one Family, three
Configuration Groups, and 18 existing real-Product memberships. The two
catalogue gaps remain absent and `MS885DE6#XW` remains outside the Family.
Legacy variant groups, names, SKU patterns, and `is_master` do not create or
alter Family membership.

### Attributes and publish quality

The importer seeds closed per-leaf launch/deep Category requirements from ADR
0016 and imports normalized legacy spec definitions, enum options, and values
under stable `legacy_*` keys. Options receive deterministic unique order and
keys. Unsupported units or non-exact enum values are quarantined; legacy
`products.specs` JSON is never copied as canonical truth.

All imported source facts retain `legacy` quality and Product-bound LEO-560
provenance. They cannot satisfy verified/official required facts. Sanitary
requirements use `deep`; tile, water, and kitchen use `launch`. Publishability
comes exclusively from `dpg_v1.product_publication_eligibility`, never a
completeness score.

### Media, documents, and Content

Every legacy image/document reference is classified deterministically as an
image candidate or document reference, with image/gallery/primary-candidate
roles preserved in the detailed artifact. No canonical media row is created:
the source lacks the content-addressed byte SHA, byte size, dimensions/profile,
and Bunny readiness required by LEO-561. This is a
`MEDIA_READINESS_GAP`, not permission to download or upload media.

The 17 Blog-only records do not prove one of the four approved V1 Content
types. They are withheld as `UNSUPPORTED_LEGACY_STRUCTURE`; the importer does
not guess a type or retain a second CMS authority.

## Local execution

Restore the exact LEO-560 dump into an isolated local PostgreSQL 17.6 source
database, apply the already-approved LEO-561 migration to a different empty
local target, then run:

```sh
npm run db:import:leo562 -- \
  --source-dump /absolute/local/path/source.dump \
  --source-url postgresql://postgres@127.0.0.1:55462/legacy \
  --target-url postgresql://postgres@127.0.0.1:55462/target \
  --evidence-out /absolute/local/path/evidence.json \
  --quarantine-out /absolute/local/path/quarantine.json \
  --replay
```

The command exits nonzero for a source checksum/table-count mismatch, remote
database URL, missing LEO-561 target, Category/Family contract mismatch,
transaction error, or replay/checksum divergence.

## Deferred manual Product review

Manual, separately authorized work must supply new DPG-owned retail prices,
official/verified Product provenance and required facts, content-addressed
READY media/documents, resolution of Product/Category/enum quarantine, and
explicit V1 Content-type decisions. LEO-562 does not perform any of those
external or editorial actions.
