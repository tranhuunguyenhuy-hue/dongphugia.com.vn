# Dongphugia Codex operating rules

This repository is the single active source of truth for Dongphugia.

## Canonical context

- Local checkout: `/Users/m-ac/Projects/dongphugia`
- GitHub: `tranhuunguyenhuy-hue/dongphugia.com.vn`
- Protected default branch: `main`
- Production website: `https://www.dongphugia.vn`
- Runtime: AWS EC2/Coolify using reviewed immutable ARM64 images
- Database: AWS PostgreSQL is the sole production database
- Media: Bunny CDN compatibility must be preserved
- Canonical baseline tag: `canonical-aws-baseline-20260804`
- Vercel Git integration is disconnected and `.com.vn` is intentionally unavailable

Do not use another checkout, clone, worktree, Vercel deployment, Supabase
project, or historical branch as current context unless the PM explicitly
approves a recovery operation.

## Mandatory session start

1. Confirm `pwd` is exactly `/Users/m-ac/Projects/dongphugia`.
2. Read this file and `docs/WORKFLOW-WITH-CODEX.md` completely.
3. Run `git status --short --branch` and confirm the intended branch.
4. Inspect open PRs and the latest `origin/main` before changing files.
5. Keep one mutation owner. Do not run a competing production or Git mutation.
6. For production work, revalidate the active PM window, AWS identity, runtime
   digest, monitoring, backup and rollback state before mutation.

If the checkout is dirty with unrelated user changes, preserve them and stop
before staging, switching, cleaning, resetting or stashing.

## Git workflow

- Never commit directly to `main`.
- Start from updated `main`: `git pull --ff-only origin main`.
- Use one short-lived branch per task: `codex/<short-description>`.
- Stage only task-owned files; never default to unrelated `git add -A`.
- Run proportionate checks before pushing.
- Open a PR, wait for required CI, merge through protected `main`, then delete
  the remote task branch and return the local checkout to clean `main`.
- Do not create another project checkout or worktree for routine sequential
  work. A temporary worktree requires explicit PM approval and must be removed
  or quarantined at task closeout.

## Validation baseline

For normal application changes:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Run focused tests first when available. Monitoring, container, database,
performance and browser checks are added according to the affected scope.

## Production safety

- A Git merge is not a production deployment.
- Production deploys require an exact PM window and explicit rollout approval.
- Use the accepted Coolify control-plane path and immutable ARM64 digest.
- Never change DNS, production data, Vercel, AWS runtime or traffic routing as
  an implied side effect of a source-code task.
- Preserve fresh backup, checksum, private copy, rollback readiness and
  no-split-brain for every production-data or runtime change.
- LCP optimization remains deferred work; it must pass staging gates before
  any production promotion.

## Secrets and credentials

- Never print credentials, environment values, connection URLs, tokens, OTPs
  or PII.
- Load the `aws-secrets-manager` skill before every AWS credential or secret
  task.
- Never call `get-secret-value` or `batch-get-secret-value`.
- Use `asm-exec` and runtime-safe dynamic references.
- Human MFA/OTP is entered only by the human in the provider UI.

## Cleanup safety

- Prefer recoverable quarantine over deletion.
- Record exact paths and retention date before moving legacy material.
- Never reset, clean, stash or delete unrelated user work.
- Permanent deletion of the 2026-08-04 consolidation quarantine is not
  authorized before 2026-08-18 and requires a fresh explicit approval.

Application-specific conventions and gotchas remain in `docs/AGENTS.md`.
