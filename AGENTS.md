# Dongphugia agent contract

This checkout is the single active source of truth for Dongphugia.

## Canonical context

- Checkout: `/Users/m-ac/Projects/dongphugia`
- GitHub: `tranhuunguyenhuy-hue/dongphugia.com.vn`
- Protected default branch: `main`
- Production: `https://www.dongphugia.vn`
- Runtime: AWS EC2/Coolify with reviewed immutable ARM64 images
- Database: AWS PostgreSQL is the sole Production database
- Media: Bunny CDN compatibility is required
- Baseline tag: `canonical-aws-baseline-20260804`
- Vercel Git integration is disconnected; `.com.vn` is unavailable

Use only this checkout. Another clone, checkout, worktree, historical branch,
Vercel deployment, or Supabase project requires explicit PM approval for a
recovery operation.

## Authority

- **PM — Nguyen Huy:** owns outcome, product decisions, scope, acceptance,
  merge approval, and every Production approval.
- **Primary Codex:** is the sole mutation owner for the active task and may
  explore, edit, validate, commit, push, and open its PR.
- **Review agents:** are read-only. They do not edit, commit, push, merge,
  deploy, or change external state.

Skills are optional workflow tools. They never expand scope, mutation
ownership, merge authority, or Production authority. The repository routing in
`docs/WORKFLOW-WITH-CODEX.md` overrides default behavior in the pinned upstream
skill snapshot.

## Delivery routing

For every delivery task, follow `Request → Route → Preflight → Align → Execute
→ Validate → Review → Deliver → Release` in
`docs/WORKFLOW-WITH-CODEX.md`. State `FAST_PATH`, `STANDARD`, or `HIGH_RISK`
with a brief reason before implementation. `FAST_PATH` is the default for
small, bounded, low-risk work.

Read additional context only when its branch applies:

- Application code, schema, or tests: `docs/AGENTS.md`.
- Domain terms or architectural decisions: `docs/agents/domain.md`, then the
  relevant `CONTEXT.md` and ADRs.
- Production operations, incident follow-up, or project handoff:
  `docs/ops/project-current-state.md`.

## Safety preflight

Every task confirms the canonical path, current branch/worktree, applicable
instructions, and mutation ownership. Add evidence in proportion to the route:

- **Read-only:** inspect remote, PR, or live state only when freshness affects
  the requested conclusion.
- **Source mutation:** before the first write, confirm a clean worktree, latest
  `origin/main`, open PRs, intended task branch, and sole mutation ownership.
- **Production or HIGH_RISK:** revalidate the exact target, identity,
  authorization, monitoring, rollback, and every risk-specific gate immediately
  before mutation.

Unrelated dirty work is a stop condition. Preserve it; do not switch, stage,
clean, reset, or stash around it.

## Git guardrails

- Never commit or force-push directly to `main`.
- Create one `codex/<task>` branch immediately before the first task-owned file
  write; the branch is an execution detail, not an approval gate.
- Stage only task-owned files and open one PR for one deliverable or phase.
- Required CI must pass. PM approval is required to merge through protected
  `main`; merge authority never implies deployment authority.

Engineering issues and specs live only in GitHub Issues; see
`docs/agents/issue-tracker.md`.

## Production and secret gates

- A source change, PR, or merge is not a Production deployment.
- Promote only the immutable ARM64 digest validated on Staging; never rebuild a
  different image between Staging and Production.
- Runtime-only Production changes require explicit PM approval and an
  Asia/Ho_Chi_Minh window; revalidated target and identity; exact digest and
  provenance; monitoring and health; a verified rollback target when the
  mechanism has one, or explicit acceptance of the documented residual risk;
  and task-relevant post-deploy acceptance.
- A Shared-data Staging check may be deferred only under
  `docs/deploy/staging-coolify.md`: related same-digest non-destructive evidence
  must pass, feasible checks remain required, and the deferred check becomes
  immediate mandatory Production acceptance.
- Persistent-state Production mutations require the `HIGH_RISK` controls
  applicable to the affected state, including fresh backup, checksum, private
  copy, restore verification, rollback readiness, and no-split-brain evidence.
- Database, permissions, destructive data, AWS/network/security, Coolify
  infrastructure, CDN/storage, DNS, broad authentication/authorization,
  irreversible work, and difficult rollback are `HIGH_RISK` scopes.
- DNS, Production data, AWS runtime, traffic, Bunny, and Vercel changes are
  separate scopes and are never implied by source work.
- For AWS credential or secret work, load `aws-secrets-manager`. Use `asm-exec`
  and runtime-safe dynamic references; never call `get-secret-value` or
  `batch-get-secret-value`. Keep credentials, environment values, connection
  URLs, tokens, OTPs, MFA, and PII out of output. Human MFA/OTP entry occurs only
  in the provider UI.

## Cleanup

Preserve unrelated work and retention constraints. Prefer recoverable
quarantine; permanent deletion requires fresh explicit approval.
