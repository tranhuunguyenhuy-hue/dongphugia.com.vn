# Dongphugia — Current Project Status

Updated: 11/08/2026

## Canonical environment

| Area | Current source of truth |
| --- | --- |
| Source | `/Users/m-ac/Projects/dongphugia`, protected `main` |
| Production | `https://www.dongphugia.vn` on AWS EC2/Coolify |
| Production database | AWS PostgreSQL only |
| Media | Bunny CDN compatibility retained |
| Vercel | Disconnected; `.com.vn` is intentionally unavailable |

## Current delivery state

The website-stability and index-readiness baseline is merged to `main` through
GitHub PR #38. The active engineering process is defined only in
`docs/WORKFLOW-WITH-CODEX.md`.

No production, database, DNS, Bunny or Vercel mutation is approved by this
repository state. Staging validation, merge and production rollout remain
separate explicit gates.

## Deferred

Content rewriting, crawler/import tooling, conversion redesign, data
normalization, comprehensive monitoring, security hardening and merchandising
belong to Phase 2. Historical material has been removed from the active source
tree or retained in Git/quarantine according to the cleanup policy.
