# Repository and worktree hygiene

## Classification

Every local and remote branch must have one state:

- `KEEP-ACTIVE`: open PR, active mutation owner or required release baseline.
- `HOLD-OBSERVATION`: rollback/recovery branch retained through observation.
- `ARCHIVE-CANDIDATE`: closed/merged work whose unique refs are preserved.
- `DELETE-CANDIDATE`: archived, no active owner, no open PR and no gate dependency.
- `BLOCKED`: dirty worktree, unknown owner or unresolved evidence.

Branch age or `git branch --merged` alone is never sufficient for deletion.
This repository has rebased/diverged histories, so PR state and object recovery
evidence must also be checked.

## Current preservation boundary

Until migration and its observation window finish, preserve:

- `codex/staging-source-integration`
- `codex/production-image`
- `codex/vercel-freeze-baseline`
- `codex/self-hosted-postgres-staging-changeset`
- `codex/staging-db-bootstrap`
- `codex/aws-production-foundation`
- `codex/security-production-blockers`
- every branch with an open PR
- every branch checked out by a living worktree
- the dirty root worktree and all of its untracked files

## Safe cleanup sequence

1. Audit status, worktrees, branches, PRs and active owners.
2. Create a full-ref Git bundle and SHA-256 checksum outside the repository.
3. Run `git worktree prune --dry-run --verbose`.
4. Prune only entries whose directory is already absent.
5. Mark branches in an inventory; do not bulk-delete from name or age patterns.
6. After observation, archive unique refs before deleting local branches.
7. Delete remote branches only with explicit repository-owner approval.

## Hard rules

- Never clean, reset, stash or switch a dirty worktree owned by another task.
- Never remove a living worktree while its branch may be owned by an agent.
- Never delete release or rollback refs during the observation window.
- Never run remote branch deletion as part of automatic housekeeping.
- Record every destructive cleanup target and recovery path before execution.

## Routine cadence

- At agent takeover: read-only audit.
- At PR merge/close: update branch classification.
- At release gate: verify release/rollback refs are protected.
- After observation: archive and delete approved candidates.
- Monthly: prune orphan metadata and review remote branches.
