# Dongphugia agent contract

## Purpose

This is the always-on operating contract for this checkout.
Keep it short. Read detailed guidance only when the current task needs it.

## Canonical context

- Checkout: `/Users/m-ac/Projects/dongphugia`
- Repository: `tranhuunguyenhuy-hue/dongphugia.com.vn`; protected branch: `main`
- Production: `https://www.dongphugia.vn`
- Runtime baseline: AWS EC2/Coolify, immutable ARM64 images, AWS PostgreSQL,
  and Bunny-compatible media

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

Before mutation, record the outcome, exact target, exclusions, route,
acceptance evidence, rollback position, and mutation owner: `HELD`.

- Preserve unrelated worktrees, branches, and dirty files.
- Do not reset, stash, clean, rebase, broadly reformat, delete, deploy, or
  alter external state unless that exact action is authorized.
- Report missing evidence as `UNKNOWN`; do not infer a pass.
- Keep diagnosis read-only unless implementation is explicitly requested.
- Release ownership only after the scope is complete or explicitly handed off.

## Delivery lifecycle

Use:

`Request → Route → Preflight → Align → Execute → Validate → Review → Deliver → Release`

- Align is read-only: settle scope, evidence, risk, and acceptance first.
- `FAST_PATH` is the default for small, bounded, reversible work.
- Escalate when persistent state, authority, shared environments, difficult
  rollback, or material blast radius enters scope.
- The complete routing, delivery, review, and release rules live in
  `docs/WORKFLOW-WITH-CODEX.md`.

## Gates

- Local validation, PR/CI, merge, Staging, and Production are separate gates.
- A branch, green CI, merged PR, health check, or Staging proof is not evidence
  of Production.
- Production requires explicit approval for the exact candidate and target.
- Promote the same validated immutable candidate through downstream gates.
- Never reveal secrets, tokens, credential URLs, environment values, PII, or
  database rows.

Read the applicable ADR and deployment runbook before HIGH_RISK or
release-related work. Shared-data Staging is HIGH_RISK and is write-frozen,
noindex candidate validation only.

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
