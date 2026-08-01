# Codex session/thread closeout

Copy this structure at the end of every Codex project session. Update the living
context when authorized; otherwise include a ready-to-apply context update in
the final hand-off. Never include secrets, credentials, PII or row contents.

## Session identity

- Timestamp and timezone:
- Thread/task:
- Status: `COMPLETE` | `BLOCKED` | `GATE-READY` | `IN-PROGRESS`
- Stop gate:
- Mutation ownership: `RELEASED` | `RETAINED` | `NOT-CLAIMED`

## Authority

- `PM DECISION` - Authorized scope:
- `PM DECISION` - Forbidden actions:
- `FACT` - Approval/window validity at closeout:

## Local source identity

- Absolute `pwd` / worktree:
- Branch / upstream:
- HEAD / tree:
- Ahead/behind:
- Staged, modified and untracked files:
- Other relevant worktrees and owners:

## Work completed

| Resource | Mutation or read-only action | Exact input | Result | Recovery/rollback |
|---|---|---|---|---|
| | | | | |

## Verification evidence

- Local checks/tests/build:
- PR/checks/workflow run IDs:
- Artifact/digest/SBOM/provenance/scan:
- Runtime/health/acceptance:
- Backup/restore/reconciliation:
- DNS/TLS/traffic:

## Processes and access

- Open tunnel/session/process:
- Closed tunnel/session/process:
- Secret handling statement:

## State classification

### Facts

-

### PM decisions

-

### Assumptions

- None | `<assumption and validation required>`

### Unknowns

- None | `<unknown and safe way to resolve it>`

## Blockers

- Technical:
- Human-only:
- Required access/cost/approval:

## Continuation

- One exact next action:
- Entry conditions:
- Completion evidence:
- Safe parallel read-only work:
- Living context updated: `YES` | `NO - update below`

```text
<Self-contained continuation prompt with exact identities, authority, hard
stops and ownership state.>
```
