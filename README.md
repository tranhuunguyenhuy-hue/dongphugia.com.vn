# Đông Phú Gia V1 — restoration project

**Owner-approved roadmap since 2026-11-13: five milestones only.** This is V1 (`tranhuunguyenhuy-hue/dongphugia.com.vn`), **not V2**.

**Start here:** [AGENTS.md](AGENTS.md) (agent policy) · [Current milestone M1 #307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307) · [Master #306](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/306) · [Project handbook](docs/PROJECT.md) · [Verified status](docs/ops/project-current-state.md).

## Approved sequence

**M1** DB-backed Production Public + full Products/Blog → **M2** Production-parity `dpg-staging` (snapshot allowed) → **M3** full legacy Admin accepted on Staging with isolated DB → **M4** Admin Production → **M5** holistic audit and future recommendations.

**Environments:** localhost for developer preview; `dpg-staging` fixed Cloudflare Staging; `dongphugia-v1-public-production` fixed Worker Production for `www.dongphugia.vn`. Remote PR Preview is not required. Worker rollback does not undo SQL/data.

## Repo pointers

- `apps/public/`: deployed Cloudflare Public-oriented runtime.
- `src/app/admin/`: restored legacy Admin source of truth; not yet proved as hosted Cloudflare Admin.
- `apps/admin/`: historic separate Admin shell, **not** the target of M3/M4.
- `prisma/`, `supabase/`, `db/`: data schema, migrations and evidentiary contracts.
- `scripts/`, `.github/workflows/`: supporting implementation/tests; avoid activating irrelevant legacy pipelines.
- `docs/deploy/`: **technical evidence and rollback scripts**, not independent priority or authorization.

## Agent execution

Open only the **active milestone** and relevant code/runbook; implement with localhost + focused tests, one integration PR, then actual deployment evidence/Owner acceptance. Do not revive Phase 2, cart/checkout, Cloudflare Preview, multi-agent parallel pipelines or V2 work. No secrets in repository; before Production writes verify backup and rollback. Historic open PRs are not work orders.
