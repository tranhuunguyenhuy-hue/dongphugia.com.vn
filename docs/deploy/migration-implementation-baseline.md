# Canonical Migration Implementation Baseline

Status: current implementation baseline for LEO-533. This document is the
single reference for later migration issues. It records the locked target and
release controls; it does not reopen the architecture audit or authorize an
external mutation.

## Proof authority and boundary

The completed [LEO-531 feasibility audit](https://linear.app/leonguyen/issue/LEO-531/free-infrastructure-feasibility-audit-cloudflaresupabasebunny)
is the proof authority for the target direction. Later issues may reference
that completed proof and this baseline instead of re-deciding the architecture.

This baseline does not authorize implementation, target provisioning, data
access, credential work, Production access, DNS or traffic changes, paid tiers,
Phase 2 work, PR #115 merge, or deletion. Phase 2 remains paused; completed
Product and Family decisions must be preserved throughout the migration.

## 1. Locked target architecture

The implementation target is fixed as follows:

- Cloudflare static-first public delivery.
- Supabase Free for the runtime database and backend.
- Supabase Edge Functions and RPC for server-side operations.
- Supabase `pg_cron` for the scheduler path.
- Cloudflare Images stream transform with `streams_enable_constructors`.
- Bunny remains the media storage/CDN contract.
- GitHub remains the source and CI authority.
- AWS remains current Production and rollback until controlled cutover and an
  observation pass are complete.
- There is no Vercel layer.

These are implementation constraints, not evidence that any target service is
currently provisioned or serving traffic. The current AWS Production state and
rollback boundary remain governed by the current-state snapshot and the
applicable release procedures.

## 2. Immutable candidate identity

Every candidate is identified by the complete, exact tuple below:

1. full source commit SHA;
2. task-owned PR number and URL, with the PR head SHA equal to the source SHA;
3. CI workflow run ID and required-check conclusions for that same SHA;
4. the immutable build/deployment artifact identity, such as an image digest
   or equivalent content digest, when the delivery surface produces one; and
5. the migration/schema manifest checksum when the candidate changes
   persistent state.

Promotion must carry this same identity forward. A branch name, mutable tag,
`latest` reference, timestamp, successful health check, or deployment record is
not a candidate identity. Any change to the tuple creates a new candidate and
reopens the applicable gates.

## 3. Separate delivery gates

The following gates are independent. Passing one never implies that a later
gate passed or is authorized.

| Gate | Required evidence | Does not authorize |
| --- | --- | --- |
| Local | Focused documentation/policy checks pass on the task branch; the diff is limited to the recorded scope. | PR merge, Preview, Production, DNS/traffic, or deletion. |
| PR | Task-owned branch and PR, exact head SHA, required CI checks, review evidence, and acceptance-linked description. | Merge without PM approval or any runtime/external mutation. |
| Preview | The exact PR candidate is deployed to the approved noindex Preview surface; isolation, side-effect freeze, and Preview acceptance are recorded. | Production, DNS/traffic, or deletion. |
| Production | PM approval for the exact candidate and target, current rollback evidence, applicable backup/recovery evidence, and all required pre-cutover acceptance. | DNS/traffic or deletion unless those separate gates also pass. |
| DNS/traffic | Separate PM approval for the exact hostname/traffic target, same candidate identity, monitoring, and a tested revert path. | Resource deletion or retirement. |
| Deletion | Separate approval after the observation pass, an exact inventory, dependency check, retained rollback evidence, and a recoverable execution plan where possible. | Any earlier gate or broad cleanup. |

Local checks, a green PR, a Preview URL, a health endpoint, or a completed
deployment record is not Production or deployed-digest proof by itself.

## 4. Branch, PR, and CI gates

- Each issue uses one task-owned `codex/*` branch from the latest clean
  `main`; unrelated branches, worktrees, and dirty files remain untouched.
- The PR is the review and delivery record for that issue. It names the issue,
  exact scope, exclusions, candidate identity, checks, residual risk, and next
  gate.
- Required CI must pass for the exact PR head SHA. A local branch or historical
  CI result cannot substitute for current PR evidence.
- Review and PM approval remain separate. The repository's live branch
  protection is verified immediately before relying on it; documentation does
  not prove that enforcement is enabled.
- Merge to `main` is a separate PM-controlled gate. LEO-533 does not merge PR
  #115 or any other PR.

## 5. Approval matrix

Approval applies only to the exact target and scope recorded immediately before
the action; it is not standing authorization.

| Action | Required owner/approval | Minimum evidence before action |
| --- | --- | --- |
| Documentation/source change | Primary Codex owns the task branch; reviewer checks scope and acceptance. | Clean task boundary, focused checks, exact diff, and task-owned PR. |
| Merge to `main` | PM approval after required CI and review. | Exact PR head, required checks, review, and merge decision. |
| Preview delivery | Authorized delivery operator under the approved Preview contract. | Same candidate identity, noindex, isolation, side-effect freeze, and Preview acceptance. |
| Target/resource or credential change | PM plus the named service/resource owner. | Exact target, security boundary, secret-safe procedure, and rollback/recovery plan. |
| Schema/data migration | PM plus the named migration owner. | Backup/restore or equivalent recovery proof, migration checksum, no-split-brain control, and staged validation. |
| Production cutover | PM approves the exact candidate; named migration and rollback owners execute. | Production acceptance, rollback target, monitoring, and cutover record. |
| DNS/traffic change | PM plus the DNS/traffic owner. | Exact hostname/route, same candidate identity, monitoring, and tested revert path. |
| Deletion/retirement | PM approves the exact inventory after observation; resource owner executes. | Observation evidence, dependency check, retained rollback evidence, and deletion record. |

No approval in this table authorizes a broader target, a different candidate,
or a later roadmap issue.

## 6. Rollback ownership

- Until controlled cutover and the observation pass are complete, the current
  AWS Production owner retains the authoritative Production rollback boundary.
- The named migration owner owns target backup/restore rehearsal, migration
  recovery evidence, and the target-side rollback procedure.
- The DNS/traffic owner owns route reversion when a traffic gate is opened.
- The PM owns the go/no-go decision and authorizes a rollback window; the
  operator named for that window executes it.
- One active mutation owner is recorded for each shared target. A source PR,
  Preview result, or new candidate never silently changes rollback ownership.

The rollback record must name the exact prior candidate or AWS rollback target,
the trigger, the operator, the monitoring signal, and the point at which the
new target may be retired. No Production or rollback action is part of LEO-533.

## 7. Seven-stage migration sequence

Later issues consume this order and must not skip a gate or promote a different
candidate.

1. **Baseline and controls** — LEO-533 locks this architecture, candidate
   identity, approvals, rollback ownership, exclusions, and gate vocabulary.
2. **Source and Preview foundation** — preserve completed Product/Family work;
   establish the static-first public build, CI, task-owned PR delivery, and
   noindex per-PR Preview controls (LEO-534 through LEO-537).
3. **Target, data, backend, scheduler, and media implementation** — establish
   the reduced schema/data path, Supabase Free boundary, recovery proof, Edge
   Functions/RPC, Admin/Publishing, `pg_cron`, and Cloudflare Images/Bunny
   integration (LEO-538 through LEO-544).
4. **Shadow candidate assembly** — build the exact noindex candidate with
   side effects frozen and its immutable identity recorded (LEO-545).
5. **Parity proof** — prove SEO/crawl parity, then data and functional parity,
   against the current public/Production contracts (LEO-546 and LEO-547).
6. **Controlled cutover** — approve the exact candidate and rehearse rollback,
   then perform the separately authorized Production data and traffic cutover
   (LEO-551 and LEO-549).
7. **Observation and retirement** — observe Production on the retained AWS
   rollback boundary, then delete only the separately approved residual AWS
   resources (LEO-550 and LEO-548).

The sequence is complete only when each applicable issue records its own
evidence and the same immutable candidate is carried through the downstream
gates. LEO-533 stops after source validation and PR review.
