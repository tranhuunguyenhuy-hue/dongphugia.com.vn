# Codex project context - Dongphugia

This file is the canonical instruction entry point for every Codex session or
thread working in this repository. Codex is the only technical execution agent
for the project. The user/PM remains the approval owner for product scope,
production data, DNS/traffic, credentials and spending.

## Mandatory reading order

Before planning or changing anything, read:

1. this file;
2. [`docs/operations/MIGRATION-CHARTER.md`](docs/operations/MIGRATION-CHARTER.md);
3. [`docs/operations/CODEX-CONTEXT.md`](docs/operations/CODEX-CONTEXT.md);
4. the latest task-specific hand-off, if one exists; and
5. the relevant source and technical documentation.

Historical material under `docs/archive/` is evidence only. It is not current
authority and must never override the files above.

## Authority and precedence

When information conflicts, use this order:

1. the user's latest explicit PM decision;
2. newly verified exact evidence;
3. the migration charter and hard stops;
4. the living Codex context;
5. current technical documentation;
6. historical plans and archived records.

Always label important statements as `FACT`, `PM DECISION`, `ASSUMPTION` or
`UNKNOWN`. Never turn an assumption into a mutation.

## Session start protocol

1. Read the mandatory context above.
2. Run `scripts/repository/audit-git-state.sh` read-only.
3. Record absolute `pwd`, worktree, branch, HEAD, tree, upstream and dirty files.
4. Verify the exact PR/check/artifact/runtime identity relevant to the task.
5. Confirm that no other thread owns the resource to be mutated.
6. State the intended resource and scope before the first mutation.

Dirty worktrees and unrelated changes belong to the user. Do not switch, reset,
clean, stage or overwrite them. Prefer a dedicated `codex/*` branch/worktree.

## Execution rules

- Codex is the single technical coordinator, but each resource still has only
  one mutation writer at a time.
- Use exact commits, tree hashes and immutable digests; branch names and mutable
  tags are not release evidence.
- Do not repeat a probe, workflow or deployment when its inputs and evidence
  have not changed.
- Make only evidence-backed changes and verify them in proportion to risk.
- Never weaken a check or acceptance threshold to manufacture a green result.
- Do not expose secrets, credentials, DSNs, tokens, PII or row contents in chat,
  logs, command arguments, artifacts or repository files.
- Stop for a PM decision when required authority, credentials, production data,
  traffic, DNS or unapproved spending is needed.

## Current release hard stops

- No production write-freeze, final copy or production database write before a
  new `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` approval.
- No DNS, nameserver, canonical traffic or old-domain redirect before
  `DNS-SWITCH-APPROVAL-GATE` approval.
- Do not disable, delete or alter the Vercel and `.com.vn` rollback baseline
  during the observation period.
- The maintenance window reserved for 31 July 2026 has expired and grants no
  authority for a later mutation.

## AWS guidance

- Prefer the AWS MCP server for AWS interactions; use AWS CLI only when the MCP
  path is unavailable.
- Read the relevant AWS skill before acting and verify uncertain AWS parameters
  against official documentation.
- Prefer AWS CDK or CloudFormation for persistent infrastructure.
- Follow AWS Well-Architected principles and use only hyphens in AWS resource
  names and descriptions.

### Secret safety

For every task involving a secret, credential, API key, token or password, load
the `aws-secrets-manager` skill first. If that skill is unavailable, stop before
handling the secret. Never call `secretsmanager get-secret-value` or
`batch-get-secret-value`, and never query a Secrets Manager Agent daemon
directly. Use runtime resolution such as
`{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with `asm-exec` so
the value does not enter model context, shell output, argv or an artifact.

## Session/thread closeout protocol

Every session that performed project work must end with the structure in
[`docs/operations/CODEX-SESSION-CLOSEOUT.md`](docs/operations/CODEX-SESSION-CLOSEOUT.md).

Before releasing ownership:

1. update [`docs/operations/CODEX-CONTEXT.md`](docs/operations/CODEX-CONTEXT.md)
   when documentation mutation is authorized, or provide a ready-to-apply
   closeout block when it is not;
2. record exact source, runtime, checks, mutations, blockers and next action;
3. close or explicitly hand off temporary tunnels, processes and terminals;
4. state whether mutation ownership is `RELEASED` or `RETAINED`; and
5. provide a self-contained continuation prompt.

Never place secret values or personal data in a closeout. A new session must
verify mutable facts rather than trusting a stale snapshot.
