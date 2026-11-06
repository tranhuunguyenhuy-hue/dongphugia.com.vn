# Dongphugia delivery workflow — fast delivery

This document is the single source of truth for delivering a request from intake
to a verified Production result. Root `AGENTS.md` retains mandatory authority
and safety rules. Optimize for restoring a working customer website, not for
producing process artifacts.

## Default flow

`Request → Implement → Focused validation → PR / Preview if needed → Owner approval → Production → Smoke check`

Treat each arrow as an execution step, not a separate meeting or permission.
Codex handles the work between intake and the final decision. A green CI run,
merged PR, or built artifact is progress, not a completed user-facing request.

### 1. Intake — a short message is enough

The user can say what to fix in ordinary language. Capture only:

- **Outcome:** what must work or change for customers.
- **Done when:** one or two observable acceptance checks.
- **Destination:** source only, Preview, or Production.

Infer routine technical details from the repository. Ask only when a material
product decision or missing permission genuinely prevents progress. Do not create
a formal spec, issue, ADR, or approval comment for a simple, bounded fix.
Use an Issue only for multi-day handoff, cross-team coordination, or genuinely
risky state changes.

If the user asks to restore website functionality or launch a change, plan the
whole route to Production, but never treat that intent as authorization to
perform an unconfirmed Production mutation.

### 2. Implement — one task, one branch, one PR

Read root `AGENTS.md`, inspect only affected source and necessary operational
facts, and start from current `main`. Use one short-lived `codex/<task>`
branch and the smallest change that satisfies acceptance.

Avoid unrelated cleanup, architecture rewrites, backup-system projects,
review-agent cascades, and speculative hardening. Defer unrelated discoveries
as follow-up notes; do not open additional blocking PRs.

Preflight is one quick check: current main, task scope, relevant open PRs,
and (for a release) the real target. Reuse previously validated information
unless a concrete change makes it stale.

### 3. Validate — test the actual change

- Documentation or process-only: check diff, links/references, and syntax.
  Skip unrelated application builds and large test suites.
- UI, layout, SEO, content: run relevant checks, lint/typecheck if affected,
  and inspect the rendered output if user-visible.
- Application behavior: run focused unit/integration tests and exercise the
  affected user flow. Use the full suite when impact crosses modules or required
  CI demands it.
- Database, authorization, payments, uploads, network/storage changes:
  add narrow functional and recovery/security checks covering the actual risk.

Required CI remains a merge condition. One integrated diff review is enough
for small reversible work; independent review is reserved for material
security, data integrity, financial, or irreversible risk. Do not ask for
multiple reviews of the same unchanged candidate.

### 4. Deliver — automated PR and Preview where useful

Commit only task-owned files, open one PR, and let CI run automatically.
Create a reachable Preview for visual or customer-flow changes when the
established environment supports it. Do not require a separate Staging
deployment for a bounded, reversible text/style fix when focused validation
and Production smoke checks are sufficient.

A Preview artifact that was built but never deployed is **not** a Preview.
If Preview infrastructure is blocked for a low-risk fix, report the limitation
and use local/rendered evidence rather than starting a separate infrastructure
project. For high-risk or difficult-to-reverse changes, do not bypass required
isolated validation.

### 5. Approve — one meaningful Owner decision

The Owner decides whether to release the reviewed change. Where the release
system supports it, **one recorded go/no-go** may approve both merge and
Production promotion **only for the same identified candidate and target**.
The automation must validate that no code or deployment target changed after
approval. If either changes, a new decision is required.

Until the release automation actually supports combined approval, comply with
the existing merge and Production gates. Never represent an approval of an
Issue, a historical run, or a different commit as release approval.

### 6. Release — one candidate, verify the real website

Identify the actual runtime serving `https://www.dongphugia.vn` before
deploying. Documentation contains historical AWS EC2/Coolify details alongside
Cloudflare/Supabase migration work; do not choose a provider by assumption.

Promote the exact validated build when supported, then check a small set of
relevant live URLs and user actions plus health/error signals. Record the
Production link, deployed version and result. For reversible application
updates, keep a known-good prior version available for rollback; database
rollback follows a separate data-safe recovery plan.

A request is complete only when the agreed behavior works on the intended
environment. Do not continue optimizing after the acceptance checks pass.

## Risk determines the extra work — not a new workflow

| Impact | Typical changes | Extra controls |
| --- | --- | --- |
| Low | Copy, CSS, labels, docs, non-sensitive SEO | No database backup, restore rehearsal, dedicated security review, or unrelated staging gate. Focused checks + required CI + Owner release decision. |
| Medium | Cart UI, public feature logic, search, ordinary API behavior | Targeted integration/smoke checks, Preview if useful, and application rollback readiness. |
| High | Persistent data/schema migration, credentials, staff permissions, payment/order integrity, CDN/DNS cutover, destructive work | Confirm exact target, authorize the mutation, protect affected data with an appropriate recoverable copy, and validate an isolated or controlled recovery path. Test authorization/data integrity as relevant. |

Backups are **not** a universal Phase 2 prerequisite. A blocked database backup
must not block unrelated CSS, footer, editorial, or other read-only releases.
Conversely, never skip a necessary recoverable copy for a migration that could
lose customer or catalogue data. For each high-impact change, choose the
simplest available reliable method; do not mandate a custom backup framework
when a tested managed or manual backup is sufficient.

Preserve essential boundaries at all risk levels: do not leak secrets or personal
data; do not bypass authentication/authorization; do not silently change
Production credentials, payments, infrastructure, or data; do not deploy to an
unverified target.

## Anti-loop rules

- After **two failed attempts using the same approach**, stop retrying that
  approach. Inspect the exact failure and choose a different method or report
  the blocker.
- Separate **blocking** findings (affect acceptance or safe rollout) from
  **follow-up** findings (nice-to-have). Fix only the former in the current PR.
- Reuse passing evidence from an unchanged candidate. Do not re-run a long
  pipeline or request approval merely to reconfirm the same result, unless
  a changed dependency or explicit release control requires it.
- Prefer a small, functioning customer-facing release over an unfinished
  all-in-one Phase 2 bundle when the pieces can be safely deployed separately.

## Current automation boundary

The desired operator experience is:
`Open PR → automatic CI / Preview → Owner approves → automated Production
promotion → smoke check / rollback option`.

The repository currently has separate legacy and Cloudflare workflow paths,
some with manual SHA, run-ID, and artifact inputs. This document **does not
remove those enforced gates** or by itself make Production one-click.
Consolidate the relevant deploy workflows only after verifying the actual
Production target, secrets, candidate provenance, and rollback. Do not
rewrite or enable unrelated deployments just to simplify a source task.

## Completion report

Use a short status with: user-visible result; PR and deployed version/link;
checks passed; unresolved blocker if any; and whether Production was actually
changed. If no Production change was made, say so explicitly.
