# Dongphugia delivery workflow

This is the single authority for source delivery, GitHub Issues, PRs,
validation, review, and release. Root `AGENTS.md` owns always-on
safety; `docs/AGENTS.md` owns application conventions.

## Core flow

### 1. Request

A request may be short:

```text
Outcome: <what should be true>
Done when: <observable acceptance>
Production: no | separately approved later
```

Codex finds repository and primary-source facts. The PM decides product
trade-offs, scope, acceptance, merge, and Production approval.

Request is complete when outcome, observable acceptance, and Production intent
are recorded, or the unresolved decision is named for Align.

### 2. Plan controls

Use the one standard workflow for every task. Before implementation, record the
controls proportionate to the actual risk. Increase validation, recovery, and
approval controls whenever Preflight or Execute reveals a larger blast radius.

- Small, bounded, reversible changes can use focused validation and integrated
  review.
- Material API/runtime behavior, authentication, uploads, schedulers, workflow
  safety contracts, or broad application changes need functional validation,
  monitoring, and rollback readiness proportional to their effect.
- Database/schema/data mutation, permissions, destructive work, storage/network
  authority, plausible data loss or split-brain, irreversibility, and difficult
  rollback require dedicated recovery evidence and explicit approvals before
  mutation.

Choose controls from blast radius and persistence, not diff size. Source work
does not authorize runtime mutation.

Planning is complete when proportionate controls and their reason are recorded.
Increase them when current evidence supports it.

### 3. Preflight

Start with the root `AGENTS.md` safety preflight, then add only the evidence the
scope and recorded controls require:

- Read-only work checks remote, PR, or live state only when freshness affects
  the conclusion.
- Source mutation checks latest `origin/main`, open PRs, worktree ownership, and
  branch readiness before the first write.
- Production and materially risky work revalidate target identity, authorization,
  monitoring, rollback, and risk-specific gates immediately before mutation.

Preflight is complete when the controls are supported by current evidence and no
unowned work or unresolved authority blocks the next action.

### 4. Align

Confirm outcome, acceptance, scope, exclusions, and unresolved decisions. A
clear task proceeds directly. Use `$grill-with-docs` only when a product,
architecture, or material risk decision remains unresolved.

Align is read-only by default. Record glossary or ADR changes during Execute
only after the PM confirms the decision and those files are in scope.

Align is complete when the PM has resolved every material product,
architecture, scope, acceptance, and risk decision, or each unresolved item is
explicitly blocked or deferred. Defer every GRILL-generated file write until
Execute.

### 5. Execute

The Primary Codex is the sole mutation owner. For source work, create one
`codex/<task>` branch from clean, latest `main` immediately before the first
write. Branch creation is an execution detail, not a separate user gate.

Specify only when useful:

- A clear, one-session task needs no Issue or formal spec.
- Use a bounded GitHub Issue/spec when acceptance is unclear, the work is risky,
  or independent phases need a durable handoff.
- Work with persistent state, authority, irreversibility, or difficult rollback
  requires a dedicated Issue/spec and recovery plan.

Implement the smallest change that satisfies acceptance. Use `$tdd`,
`$diagnosing-bugs`, `$codebase-design`, or other skills only when their specific
trigger applies; they are not default pipeline stages.

Execute is complete when task-owned changes implement the recorded acceptance
without entering an unapproved scope.

### 6. Validate

Run the smallest sufficient validation set for the affected scope:

- Focused tests first; application source uses applicable lint/typecheck.
- Run a full suite or build only when affected scope, dependencies, repository
  CI, or the release plan requires it.
- Documentation-only changes use structural, reference, discovery, and diff
  checks instead of an unrelated application build.
- Required CI remains the final merge gate.

Record commands, results, and any justified `N/A` checks.

Validate is complete only when every scope- and control-required local check
passes. If a check is blocked, stop and report the blocker; validation remains
incomplete.

### 7. Review

Review effort follows risk:

- A small bounded change may combine review with Validation: inspect the
  complete diff for scope, acceptance, documented standards, and unintended
  behavior.
- Use independent review when behavior, API/auth, operational risk, persistent
  state, or diff breadth makes a second pass valuable. Work with difficult
  rollback or material authority/state effects requires independent
  Standards/Spec review plus applicable architecture and safety review.
- Run `$code-review origin/main` whenever the PM requests it or those controls
  apply. Review agents remain read-only; the Primary resolves accepted findings
  and reruns affected checks.

Review is complete when accepted findings are resolved and affected validation
is rerun.

### 8. Deliver

Commit only task-owned files, push one task branch, open one PR, and wait for
required CI. The PR records scope, acceptance source, controls,
validation/review evidence, remaining risk, Production requirement, and next
authorized action.

Repository policy requires PM approval to merge to `main`. Required CI and PR
review evidence remain merge gates. GitHub branch-protection enforcement is
live control-plane state, not a documentation fact: verify it immediately
before relying on it. A task with `Production: no` may finish at Deliver.

Deliver is complete when the PR contains the required evidence and required CI
passes; merge still waits for PM approval.

### 9. Release

Source delivery and Production rollout are separate:

`source PR validation → merge → immutable ARM64 candidate → applicable Staging validation → PM Production approval → promote the same digest → Production acceptance`

Routine candidate selection and legally safe Staging validation do not need
repeated PM approval when they use the established candidate path. Any Staging
configuration, Production-data permission, or external-system mutation outside
that path needs separately recorded controls and approval.

Release is complete only after every applicable root `AGENTS.md` Production
gate and task-specific post-deploy acceptance passes.

## Risk-proportionate controls

Every task follows the same lifecycle above. Risk changes the controls, never
the workflow or release path.

- Small, bounded, reversible work uses focused validation and may combine review
  with Validation. Required CI, PM merge approval, and the root `AGENTS.md`
  Production gates remain mandatory when their stage applies.
- Meaningful behavior or operational changes add functional Staging validation,
  monitoring, rollback readiness, an Issue/spec, and independent review when
  justified by the actual effect.
- Persistent state, authority, irreversibility, or difficult rollback adds the
  controls the affected state needs: a dedicated Issue/spec, architecture and
  safety review, fresh backup/checksum/private copy where applicable, restore
  verification, rollback readiness, no-split-brain evidence, staged
  migration/rollback, and explicit approval before mutation.

Mandatory Production safety invariants live only in root `AGENTS.md`.

## Pinned-skill routing

`.agents/skills/` is an unmodified upstream snapshot. These repository rules
control when its tools participate:

- `$grill-with-docs` supports Align only when a material decision is unresolved;
  it is not required for clear tasks and follows Align's no-write boundary.
- `$to-spec` is optional synthesis after alignment. Keep the Issue bounded to
  acceptance and risk; publish through `docs/agents/issue-tracker.md` without a
  triage label.
- `$implement` is optional. Its upstream full-suite and mandatory-review steps
  yield to this workflow's focused Validate and risk-proportionate Review
  stages.
- `$tdd` applies to behavior changes at an agreed public seam when test-first
  work adds useful protection; it is not a documentation or mechanical-edit
  gate.
- `$diagnosing-bugs` is for hard bugs or performance regressions. Use a bounded,
  sanitized signal and never collect secrets, URLs, environment values, tokens,
  metadata, or PII.
- `$code-review` runs on explicit request or when the recorded controls require
  independent review, not automatically for every diff.
- Interpret `/improve-codebase-architecture` as `$codebase-design`. Ignore
  setup-template assumptions for uninstalled `triage` or `wayfinder`; active
  tracker and domain configuration lives only in `docs/agents/`.

## Scope control

- Stop when acceptance and the recorded controls are satisfied.
- Record unrelated technical debt as optional follow-up; do not turn it into a
  blocker, Issue, or PR without current scope.
- Reuse previously proven infrastructure facts unless concrete drift requires
  revalidation.
- Preserve unrelated work and retention constraints; quarantine is the default
  for legacy material.
- Optimize for delivery speed, low infrastructure cost, efficient Codex quota,
  and sufficient Production safety.

Database-backed candidate delivery uses the isolated PostgreSQL foundation in
`docs/deploy/isolated-staging-foundation.md` and ADR 0013. The legacy shared
Production-data/media runtime is historical only and must remain write-frozen;
see `docs/deploy/staging-coolify.md` and ADR 0010.
