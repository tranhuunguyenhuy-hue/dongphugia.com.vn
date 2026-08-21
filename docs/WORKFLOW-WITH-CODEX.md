# Dongphugia delivery workflow

This is the authoritative release-path, source, GitHub Issue, and PR workflow.
Root `AGENTS.md` owns the short always-on safety contract; `docs/AGENTS.md`
owns application conventions.

## Route the task first

Before implementation, state one classification and its reason:

- `FAST_PATH` covers low-risk runtime-only work: CSP/headers, non-persistent
  configuration, small UI/rendering fixes, and behavior that does not mutate
  persistent state.
- `STANDARD` covers API/runtime behavior, authentication, uploads, schedulers,
  or application logic with meaningful operational risk but no destructive
  persistent-state migration. It needs stronger functional Staging validation
  and rollback readiness proportional to the concrete risk.
- `HIGH_RISK` covers database/schema/data mutation, destructive work,
  storage/network authority changes, infrastructure with plausible data loss or
  split-brain, and difficult rollback.

Choose from blast radius and persistence, not task size. A source change does
not itself change runtime configuration or authorize a rollout.

## Request surface

A normal request can be short:

```text
Outcome: <what should be true>
Done when: <observable acceptance>
Production: no | separately approved later
```

This format is helpful, not mandatory. Codex finds facts in the repository or
primary sources. The PM decides product trade-offs, scope, and acceptance.

## Source delivery: one request, one branch, one PR

1. **Preflight.** Complete root `AGENTS.md` preflight. Read `docs/AGENTS.md` only
   when application code, schema, or tests are in scope.
2. **Branch.** For a mutation task, fast-forward local `main` from `origin/main`
   and create one `codex/<task>` branch before a file-writing skill runs.
3. **Align.** A clear small task proceeds directly. Use `$grill-with-docs` only
   when a product or architecture decision remains unresolved.
4. **Specify when needed.** Small one-session work needs no Issue. Use a
   dedicated Issue/spec for `STANDARD`, `HIGH_RISK`, risky, or multi-session work.
5. **Implement.** The Primary Codex is the sole mutation owner. Use `$tdd` at
   pre-agreed public seams for behavior changes, one red-green slice at a time.
6. **Validate.** Run focused tests and the applicable lint/typecheck before the
   PR; use the smallest sufficient validation set.
7. **Review.** Run `$code-review origin/main`. Its Standards and Spec reviewers
   report independently and remain read-only; the Primary Codex resolves accepted
   findings and reruns affected checks.
8. **Deliver.** Commit only on the task branch, push, open one PR, and wait for
   required CI. PM approval is required to merge through protected `main`.
9. **Release.** Follow the selected release path below. Do not treat a merge as
   a deployment.

The source-delivery portion is complete only when the PR identifies scope,
acceptance source, validation evidence, remaining blockers, release-path
classification, and the next authorized action.

## FAST_PATH: default release path

Use the following flow for an ordinary application change:

1. Start from clean, latest `main`.
2. Create the task branch.
3. Implement the minimal change.
4. Run focused tests plus the applicable lint/typecheck.
5. Open a PR.
6. Required CI must pass.
7. Merge through protected `main` with PM merge approval.
8. Build or select one immutable ARM64 Production Candidate from that merged
   revision.
9. Deploy that exact digest to the separate Staging runtime.
10. Run focused non-destructive Staging smoke and acceptance checks relevant to
    the task. Verify a recoverable Production rollback target when the
    deployment mechanism has one; otherwise record the gap and obtain explicit
    PM acceptance of its residual risk. A check blocked by Shared-data Staging
    write-freeze may be recorded as
    `NOT_APPLICABLE_ON_WRITE_FROZEN_STAGING` only under the Staging runbook's
    strict deferral rule; it then becomes immediate mandatory Production
    acceptance of this same digest.
11. Obtain one explicit PM Production rollout approval.
12. Promote the same immutable digest to Production; never rebuild an
    application image between Staging and Production.
13. Run Production post-deploy smoke verification.
14. Close the task.

Routine branch, test, PR, CI, candidate, and Staging actions in this path are
already authorized by this workflow. Stop for an unresolved product or
architecture decision, a newly discovered high-risk Production-impacting
mutation, or the Production rollout approval. A Fast Path does **not**
automatically require a restore rehearsal, full AWS/Coolify audit, backup/restore
proof, or exhaustive infrastructure review.

## STANDARD: operational-risk release path

Use `STANDARD` for non-destructive changes whose runtime behavior is materially
broader than Fast Path. Define focused functional Staging validation, monitoring,
and runtime rollback readiness that match the actual operational risk. Escalate
to `HIGH_RISK` when persistent state, authority, irreversibility, or difficult
rollback enters scope.

## HIGH_RISK: persistent-state and authority release path

Use `HIGH_RISK` when one or more routing triggers above materially apply. Add
the controls the concrete risk needs: a dedicated Issue/spec, architecture
review, fresh backup, checksum, private copy, restore verification, rollback
readiness, no-split-brain evidence, infrastructure preflight, additional
approval gates, a staged migration/rollback plan, and broader acceptance where
applicable.

`HIGH_RISK` is tailored to affected persistent state, but does not weaken its
required recovery and authority controls.

## Mandatory invariants

Regardless of release path:

1. Never commit directly to `main`.
2. Required CI must pass.
3. Staging validates every legally and safely executable candidate check before
   Production rollout. A deferred write-frozen-Staging check follows the strict
   rule in `docs/deploy/staging-coolify.md` and is mandatory immediate
   Production acceptance.
4. Production has a verified rollback target when its deployment mechanism has
   a recoverable one; otherwise the rollout approval explicitly accepts the
   documented residual risk.
5. Database, destructive, and infrastructure changes receive stricter controls
   than ordinary application changes.
6. Promote the same immutable candidate that Staging validated; do not rebuild
   a different application image between those steps.
7. Fail closed only when the failed invariant can materially harm Production.

## Pinned-skill compatibility

The files under `.agents/skills/` remain an exact upstream snapshot. These local
rules resolve assumptions in that snapshot without silently modifying it:

- `$to-spec` performs synthesis only after test seams are agreed. If a seam is
  unresolved, return to `$grill-with-docs`; do not interview inside `$to-spec`.
  Publish through `docs/agents/issue-tracker.md` without a triage label.
- `$implement` uses `$tdd` for behavior changes at agreed seams. After each
  red-green slice, run its focused test. Completion requires the affected-scope
  validation below to exit successfully, `$code-review origin/main`, resolution
  of accepted findings, and a task-branch commit.
- `$diagnosing-bugs` must not collect or echo arbitrary error text. Before using
  its HITL template, copy it to a task-owned path and replace free-form diagnostic
  capture with a bounded, sanitized signal that contains no secret, URL,
  environment value, token, metadata, or PII.
- Interpret the upstream `/improve-codebase-architecture` handoff as the installed
  `$codebase-design` skill.
- Ignore setup-template sections for uninstalled skills such as `triage` and
  `wayfinder`. The active tracker and domain configuration is only in
  `docs/agents/`.

## Validation

Run focused tests first. For application source changes, run the applicable
lint/typecheck before the PR. Required CI remains the final required check.
Run the full local suite or build only when the affected scope, a release-path
plan, or repository CI requires it:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm ci` when dependencies are unavailable, the lockfile or dependencies
changed, or a clean reproducible install is needed. Add browser, monitoring,
container, database, performance, migration, or restore checks only when the
affected scope requires them. Documentation- and skill-only changes use
structural, reference, and discovery checks instead of an unrelated application
build.

## Efficient validation and scope control

- Do not add a check merely because more safety could theoretically be achieved.
  Stop when the acceptance criteria and applicable release path are satisfied.
- Do not turn unrelated technical debt into a release blocker. Record it as
  follow-up work when useful, without creating an Issue or PR unless the current
  acceptance criteria require it.
- Reuse previously proven infrastructure facts unless there is a concrete reason
  they may have changed.
- Avoid repeated expensive full-suite checks when focused validation plus
  required CI provides sufficient evidence.
- Optimize for fast customer delivery, low infrastructure cost, efficient Codex
  quota use, and sufficient Production safety—not maximum theoretical pipeline
  strictness.
- **Cleanup:** quarantine is the default for untracked legacy material; preserve
  unrelated work and retention constraints.

## Deployment

Source delivery and production rollout remain separate:

`source PR validation → merge → immutable Production Candidate → Staging validation of that exact digest → one approved Production promotion of that same digest`

For the repository-wide shared-data Staging architecture, data/media alignment
is `HIGH_RISK` infrastructure work. The separate Staging runtime reads
Production data/media, remains write-frozen and noindex, and must use the
preferred database-level read-only principal when technically feasible; see
`docs/deploy/staging-coolify.md` and ADR 0010.
