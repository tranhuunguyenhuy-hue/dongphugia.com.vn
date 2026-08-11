# Dongphugia delivery workflow

This is the source, GitHub Issue, and PR workflow. Root `AGENTS.md` owns the
always-on safety gates; `docs/AGENTS.md` owns application conventions.

## Request surface

A normal request can be short:

```text
Outcome: <what should be true>
Done when: <observable acceptance>
Production: no | separately approved later
```

This format is helpful, not mandatory. Codex finds facts in the repository or
primary sources. The PM decides product trade-offs, scope, and acceptance.

## Happy path: one request, one branch, one PR

1. **Preflight.** Complete root `AGENTS.md` preflight. Read `docs/AGENTS.md` only
   when application code, schema, or tests are in scope.
2. **Branch.** For a mutation task, fast-forward local `main` from `origin/main`
   and create one `codex/<task>` branch before a file-writing skill runs.
3. **Align.** A clear small task proceeds directly. Use `$grill-with-docs` only
   when decisions remain. The grilling frontier is complete when every reachable
   decision is settled and the PM confirms shared understanding.
4. **Specify when needed.** Small one-session work needs no issue. For risky or
   multi-session work, use `$to-spec` to publish one GitHub Issue after alignment.
5. **Implement.** The Primary Codex is the sole mutation owner. Use `$tdd` at
   pre-agreed public seams for behavior changes, one red-green slice at a time.
6. **Validate.** Run the narrowest useful check during implementation, then the
   affected-scope baseline before commit and PR.
7. **Review.** Run `$code-review origin/main`. Its Standards and Spec reviewers
   report independently and remain read-only; the Primary Codex resolves accepted
   findings and reruns affected checks.
8. **Deliver.** Commit only on the task branch, push, open one PR, and wait for
   required CI. PM approval is required to merge through protected `main`.
9. **Close out.** After merge, delete the remote task branch and return the local
   checkout to clean, updated `main`.

The happy path is complete only when the PR identifies scope, acceptance source,
validation evidence, remaining blockers, and the next authorized action.

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

Run focused tests first. For normal application changes, the pre-PR baseline is:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm ci` when dependencies are unavailable, the lockfile or dependencies
changed, or a clean reproducible install is needed. Add browser, monitoring,
container, database, performance, or migration checks only when the affected
scope requires them. Documentation- and skill-only changes use structural,
reference, and discovery checks instead of an unrelated application build.

## Exception gates

- **Database or schema:** production writes require a PM window, fresh backup,
  rollback plan, and explicit migration approval. Run `npx prisma generate`
  after an approved schema sync.
- **Authentication:** changes to the auth flow require explicit technical
  approval before implementation.
- **Dependencies:** a new major production dependency requires explicit
  technical approval.
- **Cleanup:** quarantine is the default for untracked legacy material; preserve
  unrelated work and retention constraints.

## Deployment

Source delivery and production rollout are separate workflows:

`source commit → CI image/digest → staging validation → PM review → merge → production rollout`

Every production mutation must satisfy the production gates in root `AGENTS.md`.
