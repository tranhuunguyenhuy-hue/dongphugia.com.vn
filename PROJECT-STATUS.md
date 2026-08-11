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
GitHub PR #38. New engineering work uses GitHub Issues when a durable spec is
needed, plus one task branch and one PR. Small one-session work needs no issue.

No production, database, DNS, Bunny or Vercel mutation is approved by this
repository state. Staging validation, merge and production rollout remain
separate explicit gates.

## Deferred

Content rewriting, crawler/import tooling, conversion redesign, data
normalization, comprehensive monitoring, security hardening and merchandising
belong to Phase 2. Historical material has been removed from the active source
tree or retained in Git/quarantine according to the cleanup policy.

## Before any mutation

1. Follow root `AGENTS.md` and read only the scope documents it points to.
2. Confirm the canonical checkout, clean worktree and latest `origin/main`.
3. Keep one mutation owner; never commit directly to `main`.
4. For production, obtain a separate PM window and exact rollout/rollback
   approval.
