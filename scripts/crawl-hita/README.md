# Hita Normalized Brand Pipeline

This is the only supported pipeline for crawling products from `hita.com.vn` into Dong Phu Gia.

Do not run the legacy per-brand crawlers or the old loose phase scripts:

- `scripts/crawl-hita/1-discover-urls.js`
- `scripts/crawl-hita/2-crawl-pdp.js`
- `scripts/crawl-hita/3-upload-images.js`
- `scripts/crawl-hita/4-import-db.js`
- `scripts/crawl-hita/orchestrator.js`
- `scripts/crawl-toto/*`
- `scripts/crawl-inax/*`
- `scripts/crawl-hita-inax/*`

The supported entrypoint is:

```bash
npx tsx scripts/crawl-hita/run-normalized-brand-pipeline.mts
```

The importer used internally by the pipeline is:

```bash
npx tsx scripts/crawl-hita/import-approved-crawl-snapshots.mts
```

Do not call the importer directly unless you are debugging an already staged run and you have an exact `crawl_run_id`.

## Current DB Evidence

Always verify current state from `crawl_runs`; this file can go stale, DB history is the source of truth.

Latest normalized runs checked on 2026-07-07:

| Brand | Latest run | Status | Products | Approved | Imported | Notes |
|---|---:|---|---:|---:|---:|---|
| `viglacera` | 19 | completed | 449 | 448 | 448 | Baseline proof brand |
| `caesar` | 20 | completed | 1568 | 1562 | 1562 | Imported with normalized policy |
| `atmor` | 21 | completed | 573 | 542 | 542 | Imported |
| `cotto` | 24 | completed | 1655 | 1647 | 1647 | Imported |
| `duravit` | 28 | completed | 10 | 10 | 10 | Imported |
| `thien-thanh` | 29 | completed | 52 | 52 | 52 | Imported |
| `toto` | 30 | completed | 2625 | 2623 | 2623 | Imported |
| `hansgrohe` | 43 | completed | 174 | 174 | 174 | Imported |
| `grohe` | 44 | completed | 3252 | 3251 | 3251 | Imported |
| `esslinger` | 45 | completed | 291 | 291 | 291 | Imported |
| `moen` | 48 | completed | 287 | 286 | 286 | Imported |
| `american-standard` | 49 | completed | 846 | 846 | 0 | Restaged clean, ready for import lane |
| `kanly` | 50 | completed | 762 | 718 | 0 | Restaged clean, ready for import lane |
| `inax` | 47 | completed_with_import_errors | 2260 | 2046 | 1826 | Needs full rerun from fresh prepare, not frozen replay |

Current operational note:

- `american-standard` and `kanly` were restaged into fresh `crawl_*` runs on 2026-07-06 and can be imported from those runs.
- `inax` has a newer validated prepare outside `crawl_runs`, at:
  `/Users/m-ac/Projects/dongphugia-data-phase/scripts/crawl-hita/output/inax/pipeline-2026-07-06T14-49-58-730Z`
  with `products=2260`, `skipped=6`, and `null-subcategory=0`.
- See the concise handoff:
  [/Users/m-ac/Projects/dongphugia/docs/handoffs/2026-07-07-crawl-import-status.md](/Users/m-ac/Projects/dongphugia/docs/handoffs/2026-07-07-crawl-import-status.md)

## Standard Request Handling

When the PM asks: `crawl va import <brand>`, do this exact sequence.

1. Preflight.

```bash
git status --short --branch
npx tsc --noEmit
```

Confirm Hita is reachable from the current network/VPN before a long run. Keep concurrency low if Hita is unstable.

2. Run read-only prepare first.

```bash
npx tsx scripts/crawl-hita/run-normalized-brand-pipeline.mts \
  --brand=<brand> \
  --concurrency=2 \
  --stop-after=prepare
```

This may read Hita and DB and write local artifacts only. It must not stage DB, upload Bunny, or import production.

Review artifacts in the printed `run_dir`:

- `discovery.json`
- `reconciliation.json`
- `field-policy-flags.json`
- `pipeline-summary.json`
- `pipeline-report.md`
- `normalized/sample-skipped.json`
- `prepared/sample-products.normalized.json`

3. Gate the run before any production write.

Minimum gates:

- Discovery count is explainable.
- `approved`, `quarantine`, `skipped`, and `needs_manual_review` are understood.
- Variant groups do not show obvious collisions.
- Field policy flags are explainable, especially price, gallery, docs, specs, and description images.
- `npx tsc --noEmit` still passes.

4. If the read-only gate passes, run full pipeline with import.

```bash
npx tsx scripts/crawl-hita/run-normalized-brand-pipeline.mts \
  --brand=<brand> \
  --concurrency=2 \
  --execute \
  --confirm-brand=<brand> \
  --run-dir=<run_dir_from_prepare_if_reusing_artifacts>
```

If reusing a frozen prepared run and Bunny manifest, use the skip flags intentionally:

```bash
npx tsx scripts/crawl-hita/run-normalized-brand-pipeline.mts \
  --brand=<brand> \
  --skip-discovery \
  --skip-crawl \
  --skip-stage \
  --skip-upload \
  --execute \
  --confirm-brand=<brand> \
  --run-dir=<frozen_run_dir>
```

5. Post-import checks.

Confirm:

- `failed = 0`, unless the PM/Tech Lead explicitly accepted the failures.
- No unexpected active-count regression for the brand.
- No duplicate product rows from SKU/slug collision.
- No Hita image URLs remain in main/gallery/description for imported rows except accepted preserved fields.
- PDP spot checks cover normal priced, contact price, discontinued, docs/specs, and variant products.
- `pipeline-report.md` and `import-result.json` are present in the run dir.

## Safety Rules

- Never use old `4-import-db.js` for Hita product imports.
- Never import without `--execute --confirm-brand=<brand>`.
- Never skip the read-only prepare gate for a new or suspicious brand.
- Never mutate multiple brands in one run.
- Preserve existing `is_active` unless a task explicitly says otherwise.
- Preserve `product_descriptions.raw_html`.
- New products default inactive unless the importer policy explicitly says otherwise.
- Bunny image replacements must verify HTTP 200 and `content-type: image/*` before replacing DB URLs.
- Hita access problems are a blocker for discovery/crawl, not for reviewing existing artifacts.

## Useful DB History Query

```bash
zsh -lc 'set -a; source .env.local; set +a; node - <<"NODE"
const { Client } = require("pg")
const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
;(async () => {
  await client.connect()
  const rows = await client.query(`
    SELECT DISTINCT ON (brand_slug)
      id, source, brand_slug, status, started_at, finished_at, summary
    FROM crawl_runs
    WHERE brand_slug IS NOT NULL
    ORDER BY brand_slug, id DESC
  `)
  console.log(JSON.stringify(rows.rows.sort((a, b) => b.id - a.id), null, 2))
  await client.end()
})().catch(async error => {
  console.error(error)
  try { await client.end() } catch {}
  process.exit(1)
})
NODE'
```

## Supported Brand Config

The pipeline only supports brands declared in `brandConfig` inside `run-normalized-brand-pipeline.mts`.

Supported brand slugs:

- `american-standard`
- `atmor`
- `caesar`
- `cotto`
- `esslinger`
- `grohe`
- `hansgrohe`
- `inax`
- `kanly`
- `moen`
- `panasonic`
- `toto`
- `viglacera`

If a requested brand is missing there, add and test the brand page URL first in a separate small change. Do not hack around it by using an old crawler.
