# Dongphugia agent contract

## Purpose

This is the always-on operating contract for this checkout.
Keep it short. Read detailed guidance only when the current task needs it.

## Canonical context

- Checkout: `/Users/m-ac/Projects/dongphugia`
- Repository: `tranhuunguyenhuy-hue/dongphugia.com.vn`; default branch: `main`
- Production: `https://www.dongphugia.vn`
- Historical runtime baseline: AWS EC2/Coolify, immutable ARM64 images,
  AWS PostgreSQL and Bunny-compatible media. Cloudflare/Supabase recovery work
  also exists. Verify the runtime currently serving Production before release.

Another clone, worktree, historical branch, Vercel deployment, or Supabase
project requires explicit PM approval for a recovery operation.

## Authority

- PM owns outcome, product choices, scope, acceptance, merge, and Production.
- Primary Codex owns only the explicitly authorized technical scope.
- One active mutation owner may change a shared target at a time.
- Review agents are read-only.
- Skills, green CI, historical evidence, and prior approval do not grant new
  scope, merge, Production, or external-system authority.
- “Approved” applies only to the immediately recorded scope.

## Sources of truth

- GitHub Issue: outcome, scope, acceptance, and durable execution status.
- Pull Request: source diff, review, validation, and merge evidence.
- Repository documentation: canonical policy, architecture, and procedures.
- Dated runtime/control-plane evidence: current state only when revalidated.
- Chat: temporary context; record durable decisions in their canonical home.

## Read progressively

Read, in order:

1. This file.
2. The current Issue or explicit request.
3. Only the applicable guide, ADR, runbook, or state snapshot.
4. Relevant source and tests.

Do not scan all documentation by default. Stop and report an authoritative
source conflict rather than choosing silently.

## Scope and ownership

Before mutation, know the outcome, exact affected target, acceptance check and
 mutation owner: `HELD`. Record a dedicated recovery/rollback plan only when
 persistent data, external authority or difficult rollback is actually at risk.
 A bounded code change needs no lengthy checklist or formal specification.

- Preserve unrelated worktrees, branches, and dirty files.
- Do not reset, stash, clean, rebase, broadly reformat, delete, deploy, or
  alter external state unless that exact action is authorized.
- Report missing evidence as `UNKNOWN`; do not infer a pass.
- Keep diagnosis read-only unless implementation is explicitly requested.
- Release ownership only after the scope is complete or explicitly handed off.

## Delivery lifecycle

Use the fast default:

`Request → Implement → Focused validation → PR / Preview if useful → Owner approval → Production → Smoke check`

- One clear customer-facing request normally means one task branch and one PR;
  no default Issue, formal spec, architecture review, or repeated alignment.
- Scope and risk determine validation depth. Run backup/restore and dedicated
  safety checks only for changes that could actually affect protected state.
- After two failed attempts with the same approach, diagnose or change course
  rather than generating repetitive repair PRs.
- Deliver small independent fixes even while unrelated Phase 2 infrastructure
  or backup work is blocked.
- Full procedure and the remaining mandatory safety limits live in
  `docs/WORKFLOW-WITH-CODEX.md`.

## Gates

- Repository policy requires a task-owned PR, required CI and PM approval
  before merge to `main`. Verify actual branch protection rather than
  assuming documentation enforces it.
- Routine reversible changes use focused validation and may skip a standalone
  Staging environment when it adds no relevant evidence. Use Preview or
  isolated validation for meaningful user flows and material state changes.
- Prefer one Owner go/no-go covering merge and Production **only when** the
  reviewed candidate and exact target are identified and the automation
  guarantees the same artifact. Otherwise obey separate existing gates.
- Do not mutate Production without explicit authorization of its exact
  candidate and target. Validate the actual serving runtime and smoke-test
  after deployment; a green CI or merged PR is not Production evidence.
- Preserve a safe rollback for app changes and proportionate recoverable
  data evidence for risky migrations. Never expose secrets, tokens,
  credential URLs, environment values, PII or database rows.
- Read an environment-specific runbook only for a relevant release/operation,
  not for routine code edits. Shared-data Staging is historical, remains
  write-frozen and is not a prerequisite for unrelated low-risk work.

## Documentation map

- `docs/README.md`: documentation map and ownership.
- `docs/AGENTS.md`: application, schema, test, UI, and media conventions.
- `docs/WORKFLOW-WITH-CODEX.md`: routing, delivery, review, and release.
- `docs/ops/project-current-state.md`: dated runtime baseline and deferrals.
- `docs/adr/`: durable technical and policy decisions.
- `docs/deploy/`: environment-specific deployment runbooks and procedures.
- `CONTEXT.md`: canonical domain language.
- `.agents/skills/`: immutable upstream snapshot, not policy authority.

## Completion

Report outcome and evidence; completed scope and exclusions; branch, commit,
and PR where applicable; gates passed, blocked, or `UNKNOWN`; remaining risk;
next authorized action; and mutation ownership: `HELD` or `RELEASED`.
