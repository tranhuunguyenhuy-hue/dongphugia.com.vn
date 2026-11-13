# Đông Phú Gia V1 — catalogue & commerce

This is the **existing V1** website and recovery repository:
[tranhuunguyenhuy-hue/dongphugia.com.vn](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn).
It is **independent** of the Dong Phu Gia V2 repository (`dongphugia.vn`).

- Intended public site: https://www.dongphugia.vn.
- Production runtime/database/deployed version: **verify live**. Historical
  AWS/Coolify and Cloudflare adapters coexist in the source.
- Media: Bunny-compatible URLs; the presence of a URL is not proof of bytes.
- Default branch: `main`. Use scoped branches and reviewed PRs.

## Start here: two canonical context files

1. **Codex/AI agent:** read [AGENTS.md](AGENTS.md) once for task workflow,
   approval boundaries, current workstreams and handoff procedure.
2. **On-demand product/technical detail:** [docs/PROJECT.md](docs/PROJECT.md).
3. **Live task evidence:** open the assigned Issue/PR, current commit,
   relevant CI runs and provider/runtime checks. Do not preload all old
   handoffs, ADRs and runbooks.

Checkpoint (2026-11-13): [Phase 2 #270](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/270),
[isolated Preview #290](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/290),
[integration PR #291](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/291),
[merged legacy Admin source #300](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/300),
[Workerd spike #301](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/301),
[release design #303](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/303) and
[DB role #304](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/304).
These are dated pointers, not deployment authorization.

## Code map

- `src/app/(public)/` and `src/components/` — canonical V1 UI and components.
- `src/app/admin/` — legacy root Admin Products/Blog source (PR #300).
- `apps/public/` — Cloudflare Public runtime.
- `apps/admin/` — earlier separate Admin path (not automatically compatible
  with the root legacy Admin).
- `apps/environment-worker/` — read-only Local Preview/Staging Worker.
- `packages/` — shared contracts.
- `prisma/`, `supabase/`, `db/` — data schema/migrations, **no routine hosted writes**.
- `scripts/`, `.github/workflows/` — tests, CI, recovery and releases.
- `docs/deploy/`, `docs/adr/` — read only when the ticket touches that contract.
- [Historical ops snapshot](docs/ops/project-current-state.md) — **not**
  current Production authority and not a second handoff entry point.

## Development

```bash
npm ci
npm run dev
```

Use applicable checks and keep required CI enabled:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run preview:local` provides a local read-only combined Public/Admin
Preview on `http://127.0.0.1:8787` (see AGENTS.md). Do not treat it as an
authenticated staff Admin acceptance environment. Keep secrets, passwords,
database URLs and personal data out of code, issues, logs and handoffs.

## Ticket-to-release workflow

**Inspect Issue + branch owner → smallest scoped code/audit change → focused
checks → review-ready PR with evidence → Owner review → separately approved
merge or hosted operation → runtime smoke + rollback record.** Source, CI,
Preview, Owner acceptance and Production are separate states.
