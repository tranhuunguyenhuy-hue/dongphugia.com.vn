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
| `american-standard` | 49 | completed | 846 | 846 | 846 | Clean after importer identity retry (`WF-0916`) |
| `kanly` | 50 | completed | 762 | 718 | 718 | Imported; residual `8 manual / 33 quarantine / 3 skipped` remain by policy |
| `inax` | 54 | completed | 2260 | 2256 | 2256 | Fresh rerun imported clean; `4 quarantine`, `0 manual`, no active-count drift |

## Latest validated INAX rerun
Fresh prepare + staged execute was completed on 2026-07-06/07 in the main repo:

- run dir:
  `/Users/m-ac/Projects/dongphugia/scripts/crawl-hita/output/inax/pipeline-2026-07-06T18-48-29-047Z`
- summary:
  - `products=2260`
  - `approved=2256`
  - `quarantine=4`
  - `needs_manual_review=0`
  - `skipped=0`
- key fix:
  INAX tile and Ecocarat breadcrumbs now map correctly, staging is batched, and importer identity resolution now prefers the exact brand SKU row when a legacy source-url row conflicts.

Reconciliation from that rerun:

- `hita=2099`
- `db=2226`
- `matched=2102`
- `new=156`
- `missing=110`

Import follow-up from run `54`:

- initial full execute imported `2250`, then 6 legacy/manual collisions were retried
- final DB state:
  - `2256 imported`
  - `4 quarantine`
  - `0 manual`
  - `0 approved pending`
- active-count guardrail stayed unchanged

Residual QA note:

- INAX still has `25` products whose `description` HTML contains legacy `hita.com.vn` URLs.
- This is a description-only cleanup lane; main image and gallery replacement are not blocked by it.

## Immediate next steps

If continuing the data phase, use this order:

1. `kanly` — audit the remaining `8 manual / 33 quarantine / 3 skipped` and decide what can be promoted
2. `inax` — inspect the `4 quarantine` cases and optionally clean the `25` description leftovers
3. `moen` — QA-only follow-up if needed; not a blocker for the normalized pipeline

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
