# Branch and worktree inventory - 2026-08-01

## Evidence snapshot

- Repository: `tranhuunguyenhuy-hue/dongphugia.com.vn`
- Remote default branch: `main`
- `origin/main`: `cf98ab78b9fd34403e277b5e23ea8b082b6800ce`
- Local branches before cleanup: 39
- `origin/*` refs before cleanup: 30
- Registered worktrees before cleanup: 13
- Registered worktrees after orphan-metadata prune: 9
- Open PRs: #29 (`codex/orchestrator-handoff-cleanup`), #26
  (`codex/staging-source-integration`) and #25 (`codex/homepage-category-ux`)
- No local or remote branch was deleted in this phase.

## Recovery archive

- Path: `~/.codex/archives/dongphugia/2026-08-01/pre-cleanup-all-refs.bundle`
- SHA-256: `2e53ee5d41377cd450f11d5a85323ab5eb72b10f8a59ad0f760583429b427049`
- Scope: all refs present before cleanup.
- File permissions: owner-only; artifact is outside the repository.

## Living worktrees

| Worktree | Branch | Classification |
|---|---|---|
| `~/Projects/dongphugia` | `codex/homepage-performance-readiness` | BLOCKED - dirty, preserve |
| `/private/tmp/dpg-release-20260731.YwvjxU/production-image` | `codex/production-image` | HOLD-OBSERVATION |
| `/private/tmp/dpg-release-20260731.YwvjxU/vercel-freeze` | `codex/vercel-freeze-baseline` | HOLD-OBSERVATION |
| `~/Projects/dongphugia-aws-production` | `codex/aws-production-foundation` | KEEP-ACTIVE |
| `~/Projects/dongphugia-repo-cleanup` | `codex/orchestrator-handoff-cleanup` | KEEP-ACTIVE - PR #29 |
| `~/Projects/dongphugia-security-fixes` | `codex/security-production-blockers` | KEEP-ACTIVE |
| `~/Projects/dongphugia-selfhosted-postgres-staging` | `codex/self-hosted-postgres-staging-changeset` | HOLD-OBSERVATION |
| `~/Projects/dongphugia-staging-db-bootstrap` | `codex/staging-db-bootstrap` | HOLD-OBSERVATION |
| `~/Projects/dongphugia-staging-source` | `codex/staging-source-integration` | KEEP-ACTIVE - PR #26 |

## Orphan metadata removed

Only worktree registry entries were removed. Their branches remain intact.

- `/private/tmp/dongphugia-category-ux`
- `/private/tmp/dongphugia-hero-rollback`
- `/private/tmp/dongphugia-homepage-release`
- `/private/tmp/dpg-current-audit-20260721`

`codex/homepage-category-ux` remains protected because PR #25 is open.

## Archive candidates after observation

Branches associated with merged or closed PRs, old SEO/catalog/crawler lanes,
and superseded homepage performance experiments should be reviewed as
`ARCHIVE-CANDIDATE`. They are not deletion candidates until:

1. the migration observation window is complete;
2. no active owner/worktree references them;
3. their PR state and unique commits are recorded; and
4. repository owner approves any remote deletion.
