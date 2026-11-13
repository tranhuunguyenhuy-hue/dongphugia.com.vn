# V1 documentation scope — reset 2026-11-13

**Live decision authority:** `AGENTS.md` → Issue #306 / active milestone Issue → `docs/PROJECT.md` → `docs/ops/project-current-state.md` → specific applicable runbook. This is the only active roadmap.

## What has been deliberately removed from the active tree

Superseded policy/process documents for AWS/Coolify/dedicated EC2 Staging, Cloudflare remote Preview, legacy Phase 2/checkout/marketing work, obsolete zero-touch agent workflows and outdated production promotion manuals. Their content survives in Git history and closed PRs for audit, **not** as active agent instruction.

## What must not be deleted in this reset

Executable SQL/rollback scripts, SHA256 integrity evidence, DB and backup runbooks, proof manifests, existing data recovery source, schema migrations, scripts, source code, config and functional tests. These may be needed to restore Products/Blog, demonstrate DB parity and recover from a failed cutover. They have **no independent work authority**. Agent opens only a reference necessary for the active milestone and must never run a legacy workflow merely because a file remains.

## Important supersession notes

- No `admin.dongphugia.vn` Admin rebuild: recover `src/app/admin` at `/admin`.
- No mandatory Cloudflare Preview: localhost is development; `dpg-staging` is the fixed acceptance environment.
- M1 Production database-backed Public is intentionally **before** M2 Staging parity; use existing snapshot rollback and non-destructive database validation.
- Staging Public may use Production snapshot; Staging Admin **must** use a separate test DB.
- The old Product/Blog-only Admin source is **not full Admin acceptance**.
- Old task and branch history remains searchable, but all open legacy Issue/PR work orders are to be closed as superseded; agent works **only** M1–M5.
