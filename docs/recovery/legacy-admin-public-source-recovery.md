# Legacy Admin public-source recovery

This source-only recovery prepares the catalogue and Blog data for the existing
`src/app/admin` application and its legacy Prisma models. It does not replace
that UI, restore AWS, provision a host/database, or seed orders, customers, or
staff. The tracked Production source lock remains unchanged; the candidate lock
in this PR is explicitly `PROPOSED_REVIEW_REQUIRED`.

## Evidence and reconciliation

On 2026-11-13 the fixed public origin
`https://www.dongphugia.vn/__catalogue/v1/manifest.json` returned 208,542
bytes with SHA-256
`f8cf527a4a5813c3425efaaddaba378900032cd5ac47998699bb5aa41d31f083`. The
manifest declares checkpoint `87e4b06b73ab20df11d95021e1da8bd8f497ee5e`, M3
source commit `0cc03d4ed1c6b53a682fb26f2e75a3d6e5d4692c`, and workflow run
`40739074902`. That GitHub workflow run completed successfully. The manifest's
declared source identity does not independently prove which projection
generation emitted these bytes; `projectionGeneration` therefore remains
`unknown` in the proposal.

The tracked lock's manifest SHA-256 is
`bf9ae98b8c16da563e1adb79a25d8cb9b59aa28dde73141b9ee0337f288c5e47`, although
its checkpoint is unchanged. All 370 old product-bucket/listing-page asset
digests differ from the current capture, and the current manifest adds four
search shards. Prior locked asset bytes are unavailable, so a semantic
old-versus-current product diff cannot be computed. This PR does not rewrite
the tracked lock or describe the unchanged checkpoint as proof that the payload
is unchanged. Instead, the proposed lock records the current asset digests,
the run evidence, the full digest drift, the unavailable semantic comparison,
and the unresolved projection provenance for review.

The bounded capture then fetched and hashed all **375 JSON assets** (manifest,
256 product buckets, 114 listing pages, and four search shards): 34,247,614
bytes in total. Reconciliation verified 5,223 unique Product IDs, SKUs and
canonical paths; 4,853 unique listing members across 114 pages; 5,223 search
members; 4,027 sitemap IDs; four root categories; 24 listings; all 17 declared
variant groups and their 51 members; and every manifest content statistic.
The computed content statistics were 4,552 summaries, 4,895 description-block
products, 5,070 products with specifications, 3,079 with galleries, 523
reference prices, 5,087 historical public prices (4,564 Hita-tagged and 523
manual), 4,100 original-price values, 1,175 online-final-price values, 5,223
rich descriptions, and 2,679 products with document arrays. These checks
validate the public JSON bytes and record relationships, not image, document,
or other media file bytes.

The Blog archive at
`apps/public/src/runtime/legacy-blog-snapshot.json` is 123,507 bytes with
SHA-256
`13e1cbb34891b2564b78795d5210bcc4a15d2e480883d94bbe1b17ef560db77c`. It
contains six categories and ten published posts with non-empty bodies; every
stored body MD5 matches. A no-cookie, no-redirect read-only check of the ten
current public post pages matched each archived title, canonical URL, and
rendered body. This establishes that these ten archived posts are still served
publicly, not that the archive is complete or current with every Blog record.
Blog image bytes and other media remain unverified.

## Import plan and known gaps

The plan preserves Product and Blog-post IDs, SKUs, slugs, canonical paths,
content, taxonomy slugs, media URLs, and available price provenance. The public
projection has no stable IDs for its four root categories, 24 listings, or 59
brands, so those taxonomy rows use the legacy database's generated IDs while
retaining source slugs/names. Product canonical URLs are reconstructed from
the verified category, listing, and Product slugs because no URL column exists
in the legacy Product model.

Of the 5,223 Products, 5,087 have historical price fields with explicit Hita or
manual provenance and 136 have no price. All are planned with contact-only
availability and sale status; known amounts are marked
`historical_snapshot`, not a current-sale claim, while unknown amounts remain
null. The current public snapshot provides 51 members tagged across 17 variant
groups, but it does not provide the legacy Product Line axes or a trustworthy
group relation. Those 17 groups are reported as quarantined for variant
reconstruction; their Product rows and original group tags remain in the
catalogue plan.

The legacy model shape also leaves these source gaps visible in the dry-run
report:

- No source taxonomy IDs: 4 categories, 24 subcategories, and 59 brands.
- No persisted Product URL field: 5,223 canonical routes depend on the existing
  slug relationship.
- Product colors on 1,903 records and card features on 204 records do not map
  to typed legacy color/feature rows in this import.
- The 4,895 rich description-block sets are not separate legacy rows. The
  validated sanitized HTML and the existing summary/specification fields are
  retained instead.
- Product grouping lacks axes for 17 groups / 51 Products.
- Twenty listing labels differ from Product-side names; eight slugs have
  multiple Product-side names. The known `lavabo` route has 348 Products named
  “Lavabo” while its Public listing label is “Chậu Lavabo”. The plan reconciles
  by canonical slug and uses the Public listing label; it does not create new
  taxonomy paths.
- Blog category source rows have no `created_at` or `updated_at`; the import
  omits those fields and lets the legacy database defaults apply. Post
  timestamps are preserved from the archive.
- Media URLs pass the existing allowlist, but the media bytes are unverified.

No Blog body, Product, option axis, current price, category, or media file is
invented to fill these gaps. Unsupported or unresolved record shapes are
reported for quarantine instead of being silently completed.

## Validation performed

`npm run recovery:public-capture -- /tmp/dpg-legacy-admin-capture-validated-20261113`
read only the fixed public JSON endpoints using GET, omitted credentials,
manual redirect handling, per-asset and total byte limits, and no cookies. The
capture stayed outside the checkout. It wrote no database or provider state.

`DATABASE_URL=postgresql://postgres@127.0.0.1:55439/dpg_legacy_recovery_disposable?schema=public`
and the same `DIRECT_URL`, followed by
`npm run recovery:dry-run-local -- --dry-run
--source=/tmp/dpg-legacy-admin-capture-validated-20261113`, against a new
disposable loopback PostgreSQL database named
`dpg_legacy_recovery_disposable`, synchronized from `prisma/schema.prisma`.
The import transaction inserted the planned rows, compared repeat records and
the source-identity + record-ID + digest idempotency ledger, then forced a
rollback. The run reported 5,223 Products, 4 categories, 24 subcategories, 59
brands, 5,223 descriptions, 12,394 gallery rows, 7,629 document rows, six Blog
categories, and ten Blog posts; repeat checks were identical with zero
conflicts across 5,233 ledger keys. Orders, customers, staff, and every import
table remained empty after rollback. The command rejects non-loopback targets,
requires the exact disposable database name, accepts only `--dry-run`, and
rejects `--apply`; the ledger is in-memory for this rehearsal, not a persistent
production import ledger.

## Follow-on plan and approvals

The old Admin UI is present in `src/app/admin` and is intentionally unchanged.
No current Node host or database target was found for it. The existing Preview
Supabase resources are not Production targets. Production Public currently
reads fixed catalogue and Blog snapshots from the Cloudflare Worker; changing
Admin data alone will not publish edits.

Preferred hosting option: an Owner-selected managed Node 24 / Next.js runtime
for the existing legacy app plus a separate managed PostgreSQL database on a
private connection. Create non-production and Production resources separately,
with a named custodian, scoped credentials, TLS, backups, and a rehearsed
restore. A second option is an Owner-approved Node 24 container/VM plus managed
PostgreSQL where an existing provider cannot run the legacy app; this carries
additional patching, monitoring, and restore work. AWS is not treated as
recoverable or selectable by assumption. No host or database is provisioned by
this PR.

Before any hosted setup, the Owner needs to approve the exact provider and
region, isolated resource identifiers, budget, app and database creation,
network/TLS configuration, secret scopes and custodians, backup/restore
policy, and any hostname/DNS operation. A later, separately reviewed import
must add a persistent source ledger, explicit-ID sequence handling, conflict
behavior, and staff access bootstrap through an out-of-band secret channel;
it must leave new order, customer, and staff datasets empty unless specifically
seeded with approved synthetic data. No staff bootstrap secret belongs in this
source PR.

To make Admin edits public, add a versioned publisher that builds a complete
immutable catalogue/Blog snapshot from the selected database, verifies its
manifest and asset digests, and switches the published manifest atomically at
the Worker’s existing snapshot interface. Validate the candidate Worker with
synthetic data first. Production publisher credentials, Worker bindings, and
cutover each require their own exact approval; Worker revalidation alone is
not evidence that a database edit is published. Until that publication path
exists and is approved, Admin changes should be treated as private CMS data.

Order work remains a separate design task: `orders.shipping_fee` currently
defaults to zero without a pending-fee marker, and the schema does not enforce
immutability of the copied order-line and monetary snapshots. Define an
explicit pending shipping/installation fee state and immutable order snapshot
behavior before connecting live order intake or staff order actions.
