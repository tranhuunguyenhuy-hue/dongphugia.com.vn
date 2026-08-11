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

## Task routing

- **Clear, small change:** work directly; no interview or issue is required.
- **Unresolved product or design decisions:** use `$grill-with-docs`; Codex finds
  facts and the PM makes decisions.
- **Multi-session or risky change:** after alignment, use `$to-spec` to publish
  one GitHub issue.
- **Concrete approved spec or issue:** use `$implement` on a task branch.
- **Hard bug or performance regression:** use `$diagnosing-bugs` and establish a
  tight red-capable loop before a fix.
- **Diff or PR review:** use `$code-review <fixed-point>`; its review agents stay
  read-only.

## Git delivery

- Mutations start from updated `main` on one `codex/<short-description>` branch.
- Direct commits and force pushes to `main` are blocked.
- Stage only task-owned files and run the checks required by
  `docs/WORKFLOW-WITH-CODEX.md`.
- Deliver one PR through protected `main`; required CI and PM approval remain
  mandatory.
- Delete the remote task branch and return the checkout to clean `main` only
  after merge.

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
  rollout approval, plus revalidated AWS identity, immutable digest, monitoring,
  backup, rollback, and no-split-brain state.
- DNS, production data, AWS runtime, traffic routing, Bunny, and Vercel changes
  are separate scopes and never implied by source work.
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
