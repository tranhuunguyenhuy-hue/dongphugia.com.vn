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

## GitHub Issue policy

- GitHub Issues is the only engineering tracker.
- A small task may move from the conversation straight to a branch and PR.
- `$to-spec` creates one issue for multi-session or risky work; minor follow-up
  work stays in that issue or PR unless it is independently deliverable.
- Pull requests are delivery and review surfaces, not incoming request queues.
- GitHub Issues use no triage workflow or state labels.

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

Production requires a separate scope, exact Asia/Ho_Chi_Minh maintenance window,
explicit rollout approval, reviewed immutable ARM64 digest, monitoring, fresh
backup, verified rollback, and no-split-brain evidence. No source task implies a
database, DNS, Bunny, Vercel, AWS runtime, or traffic change.
