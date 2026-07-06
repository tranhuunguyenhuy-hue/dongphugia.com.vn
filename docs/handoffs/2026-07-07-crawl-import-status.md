# Crawl/Import Status — 2026-07-07

This note is the fastest way for a new Codex account to understand where the Hita normalized pipeline currently stands.

## Source of truth

- Operational guide: [/Users/m-ac/Projects/dongphugia/scripts/crawl-hita/README.md](/Users/m-ac/Projects/dongphugia/scripts/crawl-hita/README.md)
- Agent entrypoint: [/Users/m-ac/Projects/dongphugia/docs/AGENTS.md](/Users/m-ac/Projects/dongphugia/docs/AGENTS.md)
- Historical architecture: [/Users/m-ac/Projects/dongphugia/docs/HANDOVER.md](/Users/m-ac/Projects/dongphugia/docs/HANDOVER.md)
- DB evidence: `crawl_runs`, `crawl_product_snapshots`, `crawl_import_decisions`

## What is canonical now

Only use:

```bash
npx tsx scripts/crawl-hita/run-normalized-brand-pipeline.mts
```

Do not use:

- `scripts/crawl-hita/4-import-db.js`
- `scripts/crawl-hita/orchestrator.js`
- `scripts/crawl-toto/*`
- `scripts/crawl-inax/*`
- `scripts/crawl-hita-inax/*`

## Brand status snapshot

Verified from `crawl_runs` on 2026-07-07:

| Brand | Run | Status | Products | Approved | Imported | Notes |
|---|---:|---|---:|---:|---:|---|
| `viglacera` | 19 | completed | 449 | 448 | 448 | Clean baseline proof brand |
| `caesar` | 20 | completed | 1568 | 1562 | 1562 | Imported via normalized policy |
| `atmor` | 21 | completed | 573 | 542 | 542 | Imported |
| `cotto` | 24 | completed | 1655 | 1647 | 1647 | Imported |
| `duravit` | 28 | completed | 10 | 10 | 10 | Imported |
| `thien-thanh` | 29 | completed | 52 | 52 | 52 | Imported |
| `toto` | 30 | completed | 2625 | 2623 | 2623 | Imported |
| `grohe` | 44 | completed | 3252 | 3251 | 3251 | Imported |
| `esslinger` | 45 | completed | 291 | 291 | 291 | Imported |
| `hansgrohe` | 43 | completed | 174 | 174 | 174 | Imported |
| `moen` | 48 | completed | 287 | 286 | 286 | Imported, follow-up QA optional |
| `american-standard` | 49 | completed | 846 | 846 | 0 | Restaged clean on 2026-07-06, ready for import lane |
| `kanly` | 50 | completed | 762 | 718 | 0 | Restaged clean on 2026-07-06, ready for import lane |
| `inax` | 47 | completed_with_import_errors | 2260 | 2046 | 1826 | Old execute run still not clean; rerun from fresh prepare |

## Latest validated INAX prepare

Fresh read-only prepare was validated in the data-phase worktree on 2026-07-06:

- run dir:
  `/Users/m-ac/Projects/dongphugia-data-phase/scripts/crawl-hita/output/inax/pipeline-2026-07-06T14-49-58-730Z`
- summary:
  - `products=2260`
  - `skipped=6`
  - `sku_null=2`
  - `image_null=4`
  - `null-subcategory=0`
- key fix:
  INAX tile and Ecocarat breadcrumbs now map correctly through `scripts/crawl-hita/category-map.js`

Reconciliation from that prepare:

- `hita=2099`
- `db=2226`
- `matched=2102`
- `new=156`
- `missing=110`

That run is the current best evidence that INAX can be re-run cleanly with the normalized pipeline.

## Immediate next steps

If continuing the data phase, use this order:

1. `inax` — run fresh full execute from the validated prepare path above
2. `american-standard` — import from restaged run `49`
3. `kanly` — import from restaged run `50`

## Guardrails

- Always run `npx tsc --noEmit` first.
- Always do `--stop-after=prepare` before any new brand execute.
- Always inspect:
  - `discovery.json`
  - `reconciliation.json`
  - `field-policy-flags.json`
  - `pipeline-report.md`
  - `normalized/sample-skipped.json`
- Only execute with:

```bash
--execute --confirm-brand=<brand>
```

- Do not mutate more than one brand at a time.
- Preserve `is_active` unless the task explicitly says otherwise.
- Preserve `product_descriptions.raw_html`.
