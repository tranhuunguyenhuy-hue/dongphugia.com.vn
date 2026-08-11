# Dongphugia agent contract

This repository is the single active source of truth for Dongphugia.

## Canonical context

- Checkout: `/Users/m-ac/Projects/dongphugia`
- GitHub: `tranhuunguyenhuy-hue/dongphugia.com.vn`
- Protected default branch: `main`
- Production: `https://www.dongphugia.vn`
- Runtime: AWS EC2/Coolify with reviewed immutable ARM64 images
- Database: AWS PostgreSQL is the sole production database
- Media: Bunny CDN compatibility is required
- Baseline tag: `canonical-aws-baseline-20260804`
- Vercel Git integration is disconnected; `.com.vn` is unavailable

Use this checkout only. Another clone, checkout, worktree, historical branch,
Vercel deployment, or Supabase project requires explicit PM approval for a
recovery operation.

## Roles

- **PM — Nguyen Huy:** owns outcome, product decisions, acceptance, merge
  approval, and every production approval.
- **Primary Codex:** the only mutation owner; explores, plans, edits, validates,
  commits, pushes, and opens the task PR.
- **Review agents:** read-only reviewers for the axis assigned by a selected
  skill. They do not edit files, commit, push, merge, deploy, or change external
  state.

Skills define a workflow, not authority. A skill never expands task scope,
mutation ownership, merge authority, or production authority.

## Mandatory preflight

Complete this before any mutation:

1. Confirm `pwd` is exactly `/Users/m-ac/Projects/dongphugia`.
2. Run `git status --short --branch` and identify the intended branch.
3. Read the scope document that matches the task:
   - **Source, Git, issue, or PR work:** `docs/WORKFLOW-WITH-CODEX.md`.
   - **Application code, schema, or tests:** `docs/AGENTS.md`.
   - **Domain terms or architectural decisions:** `docs/agents/domain.md`, then
     the relevant `CONTEXT.md` and ADRs when they exist.
4. Inspect open PRs and the latest `origin/main` before changing files.
5. Keep one mutation owner. A dirty worktree with unrelated user changes is a
   stop condition: preserve it and do not stage, switch, clean, reset, or stash.

Preflight is complete only when the path, branch, relevant instructions, remote
baseline, open mutations, and worktree ownership are known.

## Git guardrails

- Never commit or force-push directly to `main`.
- One Primary Codex owns the task branch and stages only task-owned files.
- PM approval is required for merge; merge authority never implies deployment
  authority.

The task-routing, branch, validation, review, and delivery process lives only in
`docs/WORKFLOW-WITH-CODEX.md`.

## Agent skills

### Issue tracker

Engineering issues and specs live only in GitHub Issues. See
`docs/agents/issue-tracker.md`.

### Domain docs

This is a single-context repository: domain language lives in root
`CONTEXT.md`, and durable decisions live in `docs/adr/`. Both are created lazily.
See `docs/agents/domain.md`.

## Production and secret gates

- A source change, PR, or merge is not a production deployment.
- Production mutation requires an exact Asia/Ho_Chi_Minh window and explicit PM
  rollout approval, plus revalidated AWS identity, monitoring, and the accepted
  Coolify control-plane path using a reviewed immutable ARM64 digest.
- Production data or runtime changes require a fresh backup, checksum, private
  copy, verified rollback readiness, and no-split-brain evidence.
- DNS, production data, AWS runtime, traffic routing, Bunny, and Vercel changes
  are separate scopes and never implied by source work.
- LCP optimization remains deferred and must pass staging gates before any
  production promotion.
- Load `aws-secrets-manager` before AWS credential or secret work. Keep
  credentials, environment values, connection URLs, tokens, OTPs, MFA, and PII
  out of model output. Use `asm-exec` and runtime-safe dynamic references; never
  call `get-secret-value` or `batch-get-secret-value`.
- Human MFA and OTP entry happens only in the provider UI.

## Cleanup gate

Prefer recoverable quarantine and record exact paths plus retention dates.
Preserve unrelated work. Permanent deletion of the 2026-08-04 consolidation
quarantine is unauthorized before 2026-08-18 and still requires fresh explicit
approval after that date.
