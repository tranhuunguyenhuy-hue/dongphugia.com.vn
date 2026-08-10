# Dongphugia — Current Project Status

Updated: 10/08/2026

## Canonical environment

| Area | Current source of truth |
| --- | --- |
| Source | `/Users/m-ac/Projects/dongphugia`, protected `main` |
| Production | `https://www.dongphugia.vn` on AWS EC2/Coolify |
| Production database | AWS PostgreSQL only |
| Media | Bunny CDN compatibility retained |
| Vercel | Disconnected; `.com.vn` is intentionally unavailable |

## Phase 1 — Website stability and Index readiness

Active work is tracked in Linear `LEO-496` on one branch and one PR. The goal
is a correct public catalogue, `.vn` URL/metadata consistency, safe health
readiness, baseline mobile listing performance and a manual candidate path.

No production, database, DNS, Bunny or Vercel mutation is approved by this
repository state. Staging validation, merge and production rollout remain
separate explicit gates.

## Deferred

Content rewriting, crawler/import tooling, conversion redesign, data
normalization, comprehensive monitoring, security hardening and merchandising
belong to Phase 2. Historical material has been removed from the active source
tree or retained in Git/quarantine according to the cleanup policy.

## Before any mutation

1. Read `AGENTS.md`, `docs/WORKFLOW-WITH-CODEX.md` and `docs/AGENTS.md`.
2. Confirm the canonical checkout, clean worktree and latest `origin/main`.
3. Keep one mutation owner; never commit directly to `main`.
4. For production, obtain a separate PM window and exact rollout/rollback
   approval.
