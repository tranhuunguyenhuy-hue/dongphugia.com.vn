# V1 documentation scope — reset 2026-11-13

**Live decision authority:** `AGENTS.md` → Issue #306 / active milestone Issue → `docs/PROJECT.md` → `docs/ops/project-current-state.md` → specific applicable runbook. This is the only active roadmap.

## What has been deliberately removed from the active tree

Superseded policy/process documents for AWS/Coolify/dedicated EC2 Staging, separate Staging Worker/automatic per-branch Preview proliferation, Phase 2/checkout/marketing work, zero-touch agent workflows and obsolete release manuals. Preserved in Git history, not active policy.

## What must not be deleted in this reset

Executable SQL/rollback scripts, SHA256 integrity evidence, DB and backup runbooks, proof manifests, existing data recovery source, schema migrations, scripts, source code, config and functional tests. These may be needed to restore Products/Blog, demonstrate DB parity and recover from a failed cutover. They have **no independent work authority**. Agent opens only a reference necessary for the active milestone and must never run a legacy workflow merely because a file remains.

## Important supersession notes

- No `admin.dongphugia.vn` Admin rebuild: recover `src/app/admin` at `/admin`.
- Only **one fixed Worker Preview named `staging` INSIDE `dongphugia-v1-public-production`** for M2/M3; `dpg-staging` separate Worker is obsolete. Localhost for fast coding; no per-branch Previews.
- M1 Production database-backed Public remains **before** fixed Preview parity M2, with snapshot rollback and non-destructive data validation.
- Fixed Preview Public may use snapshot, but **Preview Admin may run all legacy features, Hyperdrive and real Auth** only with dedicated Preview secrets and isolated TEST PostgreSQL/roles.
- The old Product/Blog-only Admin source is **not full Admin acceptance**.
- Old task and branch history remains searchable, but all open legacy Issue/PR work orders are to be closed as superseded; agent works **only** M1–M5.
