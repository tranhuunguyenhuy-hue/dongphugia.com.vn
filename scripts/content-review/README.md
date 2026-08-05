# Hita cleanup content-review tools

These tools implement the source-only `hita_cleanup_v1` proposal workflow.
They do not crawl, copy, rehost, delete, or hotlink-enable media.

## Fixture pilot (default dry-run)

```bash
npx tsx scripts/content-review/generate-proposals.mts
```

The checked-in fixture has 20 representative products. Dry-run is the default
and does not instantiate Prisma. For resumable non-production review-table
writes only, pass an existing `--run-id` and the explicit
`CONTENT_REVIEW_ALLOW_WRITE=review-tables-only` guard. Production writes are
hard-blocked. Do not use the write mode without a separately approved window.

## LEO-489 precomputed pilot

Build the exact 20-product package from the private, read-only AWS PostgreSQL
inventory export and the sanitized static review bundle. The raw inventory and
package are written under the ignored `private/` directory; only the review
bundle is committed, and it contains redacted media URLs plus minimum review
content. Do not substitute a fixture or fabricate product/media evidence for
the pilot.

```bash
npx tsx scripts/content-review/build-pilot-bundle.mts
npx tsx scripts/content-review/ingest-precomputed.mts
```

### Offline interactive dashboard

After the package exists, generate the sanitized dashboard committed for PR
review:

```bash
npx tsx scripts/content-review/build-pilot-bundle.mts
open docs/review-bundles/leo-489-pilot-dashboard.html
```

The generator also runs the LEO-489 editorial audit. It checks all 20 After
descriptions for 70–120% normalized Before length, at least three narrative
paragraphs, buyer-benefit language, the natural phrase “chính hãng”, factual
HTML without a technical-table dump, and deterministic output. Two sparse
Before sources are intentionally shorter and appear in the bundle and
dashboard as product-level `HUMAN_REVIEW` with a specific reason; do not pad
them with unsupported claims.

Run the focused audit after generation:

```bash
npx vitest run src/lib/content-review/content-quality.test.ts src/lib/content-review/dashboard.test.ts src/lib/content-review/media-classification.test.ts
```

The media review is asset-first. Every one of the 160 actual references has a
redacted origin, proposed action, confidence, visual-cluster reason, duplicate
fingerprint, and official-source verification indicator. Duplicate
main/gallery/embedded references inherit the same asset classification. The
approved SFV-900SX golden case is a regression: 24 references / 20 unique
assets, 10 Hita showroom removals, 5 household/installation removals, and
official-source verification for the five official render/technical assets.
The exact main reference is never proposed for removal without an official
replacement action.

The test verifies exact 20-product coverage, unchanged 160-media reference
coverage, the SFV-900SX golden classification, no Hita links or automatic fetches
in the committed artifact, no server/database/analytics code, and unique
buyer-oriented openings. Inspect every Before/After pair in the dashboard and
the per-product editorial-quality lines in
`docs/review-bundles/leo-489-pilot-review.md` before handoff.

The dashboard contains exactly the 20 package products, review progress,
HUMAN_REVIEW/KEEP media counts, search and filters for SKU/name/brand/category,
review status, media risk, origin, and proposed action; Before/After/
deterministic Diff; sanitized Preview; provenance indicators; and the complete
main/gallery/embedded manifest. The manifest shows thumbnail state, origin,
action, confidence, evidence, cluster, duplicate fingerprint, and source
verification. Product and image decisions stay in browser `localStorage`; the
**Export deterministic JSON** button produces a sorted review-decision file
with the base classification and local decision for every image.
There is no server, database, CDN, analytics, crawler, bulk fetch, media
download or media-copy action in this dashboard. The committed dashboard
redacts all live media URLs and does not auto-load any media.

For private, local-only visual review of existing Bunny media, generate the
ignored variant:

```bash
npx tsx scripts/content-review/build-pilot-bundle.mts --private
open scripts/content-review/private/leo-489-pilot-dashboard.html
```

The private variant is never committed. Bunny images may render read-only with
lazy loading. Hita-hosted media have no `src`, background, prefetch, or other
automatic request; each requires an explicit single-asset click and displays a
warning first. Do not crawl, bulk fetch, download, cache, copy, or rehost Hita
assets. Re-run the generator whenever the private package changes; generated
HTML is deterministic for the same package and mode.

The ingestion command is validation-only. It checks the approved manifest
checksum and entry identities, inventory/proposal hashes, before/after
provenance, required facts, deterministic sanitized HTML, complete actual
media inventory, image policy decisions, diff telemetry, and proposal identity
before returning any proposals. It does not import Prisma, write a database,
fetch a remote URL (including Hita), or call an AI provider.

Private package location: `scripts/content-review/private/leo-489-pilot-package.json`.
Do not commit or paste that package into tickets; use
`docs/review-bundles/leo-489-pilot-review.md` for PM review.

## Apply / rollback planning

```bash
npx tsx scripts/content-review/plan-apply-rollback.mts \
  --input=/path/to/proposal.json --state=ready_to_apply
```

The planner emits hashes and allowlisted targets only. It is always dry-run,
has `executable: false`, and rejects `--execute`.
