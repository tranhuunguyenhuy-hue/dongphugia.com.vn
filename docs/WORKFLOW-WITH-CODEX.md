# Dongphugia delivery workflow

The canonical checkout is `/Users/m-ac/Projects/dongphugia`; GitHub default is
protected `main`; production is `https://www.dongphugia.vn`.

## Normal source task

1. Read root `AGENTS.md` and `docs/AGENTS.md`; verify `pwd`, branch, clean
   worktree, `origin/main` and open PRs.
2. Create one short-lived `codex/<task>` branch from updated `main`.
3. Keep one mutation owner, edit only task-owned files, then run focused checks
   followed by lint, typecheck, tests and build.
4. Push one PR, wait for required CI and record commit, scope, validation,
   blocker and next action in Linear/GitHub.
5. Merge only through protected `main` after PM approval; clean the task branch
   only after merge.

## Deployment gates

Source merge does not deploy production. Each candidate uses:

`source commit → CI image/digest → staging validation → PM review → merge → production rollout`

Staging validation, merge and production rollout are independent approval
events. Production requires an exact Asia/Ho_Chi_Minh maintenance window,
runtime digest, backup/rollback evidence and explicit approval. Never imply a
database, DNS, Bunny, Vercel, AWS or traffic change from a source task.

## Phase 1 limits

LEO-496 owns Website Stability & Google Index Readiness. Use one persistent
worker and one PR; do not create dashboards, research threads or additional
issues for minor work. Stop after Phase 1 technical acceptance; Phase 2 work is
deferred.

## Safe cleanup

Prefer Git-tracked deletion or quarantine with a retention date. Never reset,
clean, stash or delete unrelated user work. The 04/08/2026 consolidation
quarantine cannot be permanently removed before 18/08/2026 without fresh PM
approval.

## Secrets

Never print credentials, environment values, URLs containing credentials,
tokens, MFA or OTP. Human authentication is entered only in provider UI.
