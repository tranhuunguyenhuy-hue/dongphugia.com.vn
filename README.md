# Đông Phú Gia V1 — restoration project

**Owner-approved roadmap since 2026-11-13: five milestones only.** This is V1 (`tranhuunguyenhuy-hue/dongphugia.com.vn`), **not V2**.

**Start here:** [AGENTS.md](AGENTS.md) (agent policy) · [Current milestone M1 #307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307) · [Master #306](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/306) · [Project handbook](docs/PROJECT.md) · [Verified status](docs/ops/project-current-state.md).

## Approved sequence

**M1** DB-backed Production Public + Products/Blog → **M2** one fixed Worker Preview named `staging` inside Production Worker (Public snapshot allowed) → **M3** full legacy Admin, Hyperdrive and real Auth on that Preview with isolated TEST DB → **M4** accepted Admin to Production → **M5** audit.

**Environments:** localhost (development) → **fixed Preview `staging` INSIDE existing `dongphugia-v1-public-production` Worker** (M2/M3) → same Worker's Production deployment (`www.dongphugia.vn`). No new Worker, no automatic per-PR Preview. The old separate `dpg-staging` Worker is no longer used. Preview secrets/Hyperdrive/test database are isolated. Code rollback is not database rollback.

## Repo pointers

- `apps/public/`: deployed Cloudflare Public-oriented runtime.
- `src/app/admin/`: restored legacy Admin source of truth; not yet proved as hosted Cloudflare Admin.
- `apps/admin/`: historic separate Admin shell, **not** the target of M3/M4.
- `prisma/`, `supabase/`, `db/`: data schema, migrations and evidentiary contracts.
- `scripts/`, `.github/workflows/`: supporting implementation/tests; avoid activating irrelevant legacy pipelines.
- `docs/deploy/`: **technical evidence and rollback scripts**, not independent priority or authorization.

## Agent execution

Open only the **active milestone** and required code/runbook; localhost + focused tests + one named Preview for M2/M3 + runtime evidence. Do not revive Phase 2, checkout, per-branch Previews, the old `dpg-staging` Worker, parallel agents or V2. No source-committed secrets; backup and rollback before Production writes.

## Fast delivery pipeline (2026-11-13)

**PR → required `quality` → merge main → [V1 Worker release](.github/workflows/v1-worker-release.yml) (`publish=false` verify, `publish=true` release).** The release workflow builds the **actual `apps/public` Cloudflare Worker**, not the legacy root Next.js app. Cloudflare Builds direct auto deployment was found misconfigured and must not be treated as evidence of a Production update. Only one named Worker Preview `staging` for M2/M3, no automatic PR previews. See [Release runbook](docs/ops/v1-fast-release.md).
