# ORCHESTRATOR HAND-OFF

**Timestamp:** YYYY-MM-DD HH:MM Asia/Ho_Chi_Minh

**Status:** IN-PROGRESS | BLOCKED | GATE-READY | COMPLETE

**Next stop gate:** `<GATE-NAME>`

**Charter/version:** `<path and updated date>`

**Approved window:** `<exact time/timezone or NONE/EXPIRED>`

## 1. Authority

- FACT - Current mutation owner:
- FACT - Previous owner stopped:
- PM DECISION - Authorized scope:
- PM DECISION - Forbidden actions:
- FACT - Approval/window still valid at hand-off time:

## 2. Local source

- `pwd`:
- Worktree:
- Branch:
- HEAD:
- Tree:
- Upstream/ahead/behind:
- Dirty/staged/untracked files:
- Other owned worktrees:

## 3. GitHub

- Repository:
- PR/base/head:
- Checks and workflow run IDs:
- Accepted source/tree:

## 4. Artifact

- Image repository:
- Full immutable digest:
- Platform:
- SBOM:
- Provenance:
- Security scan:

## 5. Runtime

- Current production:
- Staging:
- Dark production:
- Runtime digest/health/restarts:
- Acceptance evidence:
- Rollback identity:

## 6. Data safety

- Source database:
- Target database:
- Backup/checksum/off-host copy:
- Restore/reconciliation/sequence:
- Write-freeze/final copy status:

## 7. DNS/TLS/traffic

- Current zone exports:
- Proposed records/TTL:
- TLS status:
- DNS operator:
- Traffic switch status:
- Rollback records:

## 8. Mutation ledger

| Time | Resource | Action | Owner | Input identity | Result | Rollback |
|---|---|---|---|---|---|---|
| | | | | | | |

## 9. Blockers

### Technical

- None | `<blocker>`

### Human-only

- None | `<decision/access/operator required>`

### Unknowns

- None | `<unknown and how to resolve read-only>`

## 10. Next action

- Exact action:
- Entry conditions:
- Completion evidence:
- Owner:
- Safe parallel work:

## 11. Suggested continuation prompt

```text
<Self-contained prompt including exact identities, authority and hard stops.>
```
