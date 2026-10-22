# Issue tracker: Linear

V02 roadmap, scope, active execution state, blockers, and work coordination live
in Linear. GitHub Issues are not the canonical V02 task ledger.

GitHub remains canonical for code, Pull Requests, ADRs/specs, CI, and technical
evidence. Link those artifacts from the active Linear Issue instead of copying
technical history into the task record.

## Conventions

For a managed V02 task:

- **Read:** fetch the full Linear Issue before mutation, including Outcome,
  In Scope, Out of Scope, Acceptance, Dependencies, Environment, and relations.
- **Start:** move the Issue from `Todo` to `In Progress` when mutation ownership
  is actually taken. Read-only investigation may remain `Todo` until execution
  starts if no state mutation is needed.
- **Block:** keep the Issue `In Progress` and add label `Blocked`; use linked
  `blocked by / blocks` Issues for out-of-scope blockers.
- **Review:** use `In Review`; add `Staging QA` or `Ready for Production` labels
  when those gates apply.
- **Complete:** move to `Done` only when the Issue acceptance/exit condition is
  satisfied. Otherwise use the documented blocker/scope-change exit state in a
  comment or handoff.

Do not create a second GitHub Issue for the same V02 execution task.
Historical GitHub Issues may be read as evidence or provenance only.

If Linear access is unavailable for a managed V02 task, stop before mutation and
report `BLOCKED: Linear control plane unavailable`. Do not silently fall back to
GitHub Issues or chat as a replacement task ledger.

Never expose credentials, tokens, environment values, database rows, PII, or
other sensitive material in Linear content.

## Skill adapter

- When a skill says **publish to the issue tracker**, update or create the
  appropriate Linear Issue for V02-managed work.
- When a skill says **fetch the relevant ticket**, read the full Linear Issue and
  its relations.
- When durable technical detail is needed, place it in the linked PR, ADR/spec,
  runbook, or evidence artifact rather than duplicating it into Linear.
- This repository does not install `triage` and does not use triage roles or a
  `ready-for-agent` label. Omit that label when upstream skill text requests it.