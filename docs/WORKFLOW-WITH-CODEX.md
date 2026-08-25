# Dongphugia delivery workflow

This is the single authority for task routing, source delivery, GitHub Issues,
PRs, validation, review, and release paths. Root `AGENTS.md` owns always-on
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

### 2. Route

State one route and its reason before implementation. Escalate whenever
Preflight or Execute reveals a larger blast radius.

- `FAST_PATH` is the default for small, bounded, reversible changes with low
  operational risk and no persistent-state or authority mutation. Examples
  include documentation, CSP/headers, non-persistent configuration, and small
  UI/rendering fixes.
- `STANDARD` covers meaningful API/runtime behavior, bounded authentication
  behavior that does not change authority, uploads, schedulers, workflow safety
  contracts, or application logic risk without destructive persistent-state
  migration.
- `HIGH_RISK` covers database/schema/data mutation, permissions, destructive
  work, storage/network authority, infrastructure with plausible data loss or
  split-brain, irreversibility, and difficult rollback.

Choose from blast radius and persistence, not diff size. Source work does not
authorize runtime mutation.

Route is complete when the classification and reason are recorded. Reclassify
when current evidence supports it, and always escalate when risk increases.

### 3. Preflight

Start with the root `AGENTS.md` safety preflight, then add only the evidence the
route and scope require:

- Read-only work checks remote, PR, or live state only when freshness affects
  the conclusion.
- Source mutation checks latest `origin/main`, open PRs, worktree ownership, and
  branch readiness before the first write.
- Production and `HIGH_RISK` work revalidates target identity, authorization,
  monitoring, rollback, and risk-specific gates immediately before mutation.

Preflight is complete when the route is supported by current evidence and no
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

- A clear, one-session `FAST_PATH` task needs no Issue or formal spec.
- Use a bounded GitHub Issue/spec when acceptance is unclear, the work is risky,
  or independent phases need a durable handoff.
- `HIGH_RISK` work requires a dedicated Issue/spec and risk plan.

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

Validate is complete only when every route-required local check passes. If a
check is blocked, stop and report the blocker; validation remains incomplete.

### 7. Review

Review effort follows risk:

- A small `FAST_PATH` change may combine review with Validation: inspect the
  complete diff for scope, acceptance, documented standards, and unintended
  behavior.
- `STANDARD` uses independent review when behavior, API/auth, operational risk,
  or diff breadth makes a second pass valuable.
- `HIGH_RISK` requires independent Standards/Spec review plus the applicable
  architecture and safety review.
- Run `$code-review origin/main` whenever the PM requests it or these triggers
  apply. Review agents remain read-only; the Primary resolves accepted findings
  and reruns affected checks.

Review is complete when accepted findings are resolved and affected validation
is rerun.

### 8. Deliver

Commit only task-owned files, push one task branch, open one PR, and wait for
required CI. The PR records scope, acceptance source, route, validation/review
evidence, remaining risk, Production requirement, and next authorized action.

PM approval is required to merge through protected `main`. A task with
`Production: no` may finish at Deliver.

Deliver is complete when the PR contains the required evidence and required CI
passes; merge still waits for PM approval.

### 9. Release

Source delivery and Production rollout are separate:

`source PR validation → merge → immutable ARM64 candidate → applicable Staging validation → PM Production approval → promote the same digest → Production acceptance`

Routine candidate selection and legally safe Staging validation do not need
repeated PM approval on `FAST_PATH`. Any Staging configuration, Production-data
permission, or external-system mutation outside the established candidate path
is a separately routed scope.

Release is complete only after every applicable root `AGENTS.md` Production
gate and task-specific post-deploy acceptance passes.

## Release paths

### FAST_PATH

Use the core flow with focused validation and integrated review when the change
is small and low risk. Required CI, PM merge approval, and the root `AGENTS.md`
Production gates remain mandatory when their stage applies.

`FAST_PATH` does not automatically require a restore rehearsal, broad
AWS/Coolify audit, backup/restore proof, exhaustive infrastructure review, a
formal spec, or independent review.

### STANDARD

Define focused functional Staging validation, monitoring, and runtime rollback
readiness proportional to the concrete operational risk. Add a bounded Issue,
independent review, or broader validation only when clarity, duration, behavior,
or risk requires it. Escalate to `HIGH_RISK` when persistence, authority,
irreversibility, or difficult rollback enters scope.

### HIGH_RISK

Use a dedicated Issue/spec and add the controls the affected state needs:
architecture review, fresh backup, checksum, private copy, restore verification,
rollback readiness, no-split-brain evidence, infrastructure preflight,
additional approvals, staged migration/rollback, and broader acceptance.

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
  yield to this route's focused Validate and risk-based Review stages.
- `$tdd` applies to behavior changes at an agreed public seam when test-first
  work adds useful protection; it is not a documentation or mechanical-edit
  gate.
- `$diagnosing-bugs` is for hard bugs or performance regressions. Use a bounded,
  sanitized signal and never collect secrets, URLs, environment values, tokens,
  metadata, or PII.
- `$code-review` runs on explicit request or the `STANDARD`/`HIGH_RISK` triggers
  above, not automatically for every diff.
- Interpret `/improve-codebase-architecture` as `$codebase-design`. Ignore
  setup-template assumptions for uninstalled `triage` or `wayfinder`; active
  tracker and domain configuration lives only in `docs/agents/`.

## Scope control

- Stop when acceptance and the selected route are satisfied.
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
Production-data/media runtime remains `HIGH_RISK` and historical only; see
`docs/deploy/staging-coolify.md` and ADR 0010.
