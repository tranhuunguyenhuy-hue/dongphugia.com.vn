# Dongphugia delivery workflow

This is the authoritative release-path, source, GitHub Issue, and PR workflow.
Root `AGENTS.md` owns the short always-on safety contract; `docs/AGENTS.md`
owns application conventions.

## Route the task first

Before implementation, state one classification and its reason:

- `FAST_PATH` is the default for ordinary application changes: UI/UX, CSS or
  layout, content, SEO, image/rendering bugs, normal application bugs,
  low-risk security patches, and non-destructive API behavior changes.
- `FULL_PATH` is required when the actual blast radius includes a database
  schema migration, database permissions, destructive data operation,
  Production data mutation, infrastructure, AWS/network/security, Coolify
  infrastructure, CDN/storage configuration, DNS, broad authentication or
  authorization impact, irreversible migration, major security-sensitive
  change, or difficult rollback.

Choose from blast radius, not task size. When evidence does not show a
`FULL_PATH` trigger, use `FAST_PATH`. A source change does not itself change
runtime configuration or authorize a rollout.

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
   dedicated Issue/spec for `FULL_PATH`, risky, or multi-session work.
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
10. Run focused smoke and acceptance checks relevant to the task, and confirm
    the known Production rollback target.
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

## FULL_PATH: risk-triggered release path

Use `FULL_PATH` when one or more routing triggers above materially apply. Add
only the controls the concrete risk needs: a dedicated Issue/spec, architecture
review, explicit backup/restore readiness, infrastructure preflight, additional
approval gates, a staged migration and rollback plan, and broader acceptance
testing. A difficult or irreversible rollback is itself a trigger.

`FULL_PATH` does not mean every possible safety check. It is a tailored plan
that fails closed for evidence whose absence could materially harm Production.

## Mandatory invariants

Regardless of release path:

1. Never commit directly to `main`.
2. Required CI must pass.
3. Staging validates the candidate before Production rollout.
4. Production has a known rollback target.
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
is `FULL_PATH` infrastructure work. The separate Staging runtime reads
Production data/media, remains write-frozen and noindex, and must use the
preferred database-level read-only principal when technically feasible; see
`docs/deploy/staging-coolify.md` and ADR 0010.
