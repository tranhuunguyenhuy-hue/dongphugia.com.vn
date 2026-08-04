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

Build the exact 20-product offline package and the sanitized static review
bundle. The package is written under the ignored `private/` directory; the
review bundle is committed and contains redacted media URLs only.

```bash
npx tsx scripts/content-review/build-pilot-bundle.mts
npx tsx scripts/content-review/ingest-precomputed.mts
```

The ingestion command is validation-only. It checks the approved manifest
checksum and entry identities, package hash, before/after provenance, required
facts, deterministic sanitized HTML, image policy decisions, diff telemetry,
and proposal identity before returning any proposals. It does not import
Prisma, write a database, fetch a remote URL, or call an AI provider.

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
