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

## Apply / rollback planning

```bash
npx tsx scripts/content-review/plan-apply-rollback.mts \
  --input=/path/to/proposal.json --state=ready_to_apply
```

The planner emits hashes and allowlisted targets only. It is always dry-run,
has `executable: false`, and rejects `--execute`.
