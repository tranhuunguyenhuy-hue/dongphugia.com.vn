# Migration free-tier and Owner-gate policy

Status: current preflight contract for LEO-532. Later migration issues must
link this document and record its checks before crossing a budget, security,
data-placement, Production, traffic, paid-tier, or irreversible boundary.

This policy consumes the accepted LEO-531 evidence and the [canonical
migration implementation baseline](migration-implementation-baseline.md). It
does not reopen the feasibility audit, change the target architecture, or
authorize an external service, Production, DNS, credential, paid-tier, or AWS
operation.

## Fail-closed preflight rule

For every control below, the later issue must record the observed value, the
measurement date, the exact candidate/source identity, and the evidence source.
`UNKNOWN`, a missing measurement, a changed provider limit, an exceeded
threshold, or a missing Owner approval is `BLOCKED`; it is never a pass by
assumption. A local fixture or historical result is not evidence for a live
provider account or Production target.

Provider quotas and plan terms can change. The LEO-531 values marked as
accepted references are planning baselines, not permanent provider promises.
Before implementation or target use, verify the current provider
documentation and the intended account/project plan. If the current value
cannot be verified without accessing credentials or mutating an external
system, record `UNKNOWN` and stop.

## Budget and compatibility contract

| Control | Accepted LEO-531 reference | Required preflight and stop condition |
| --- | --- | --- |
| Runtime database size | Preferred ceiling: **350 MiB / 367,001,600 bytes**. Accepted local restored runtime: **108,181,171 bytes (103 MiB)**. Alerts: **250 MiB** and **300 MiB**. | Measure the candidate runtime database using a sanitized size report. Pass only at or below 350 MiB. Alert at 250/300 MiB and stop at the ceiling. Verify the current target plan/quota separately; the 350 MiB ceiling remains the project acceptance ceiling even if a provider advertises more. |
| Static artifact inventory | Accepted proof inventory: **4,093 files**, **7,559,256 total bytes**. Accepted Cloudflare Pages references: **20,000 files** and **25 MiB per file**. | Produce a build inventory containing file count, total bytes, largest file, routes, redirects, and Preview noindex evidence. Pass only when file count and every individual file are within the currently verified provider limits. The accepted total is a regression baseline, not a provider total-size quota. |
| Worker/Edge compatibility | Accepted reference: Supabase Edge **256 MB** memory, **150 seconds** Free wall time, **2 seconds** CPU per request; Sharp/libvips is unsupported. Required dynamic responsibilities are apex-to-www redirect, query-string category redirects, maintenance rewrite, and API routing. | Keep Worker/Edge code on supported Web APIs and streams; do not depend on Node-only APIs, Sharp, or libvips. Verify the current runtime limits, bindings, CPU/memory use, and all required dynamic routes on the intended plan. Missing compatibility evidence or a Node/native dependency is `BLOCKED`. |
| Cloudflare Images transforms | Accepted reference: **5,000 unique transformations/month**; the current media contract has at most **7 variants/source**, giving a planning envelope of **714 complete seven-variant sources/month**. | Count unique source/variant transformations, reserve the verified current allowance before execution, and stop before the allowance is exhausted. Reverify the account allowance and transformation definition. Any additional variant, overage, paid Images tier, or changed binding requires Owner approval. |
| Scheduler/free tier | Accepted architecture reference: Supabase `pg_cron` plus `pg_net`, with a one-minute schedule model. The existing **<=5 minute** freshness expectation remains unproven end-to-end. | Before enabling a schedule, verify current scheduler, invocation, database, egress, retry, and log limits for the intended plan. Calculate scheduled runs plus retries/catch-up against the verified allowance; unknown limits, unmeasured end-to-end freshness, runaway retries, or write-freeze state is `BLOCKED`. Keep the one-shot scheduler, advisory-lock/idempotency controls, failure evidence, and no silent catch-up. |
| Retained Bunny cost boundary | Bunny remains the existing media storage/CDN contract. LEO-531 did not establish a current monthly usage or cost figure. | Do not create a new zone, storage target, credential, or paid feature. Before any media work, record the existing contract, current usage/cost evidence from an authorized owner, and the exact retained target. Unknown usage/cost permits only local/disposable proof; a new cost or configuration change requires Owner approval. |

The accepted Images and provider values above must not be copied into a
runtime assumption without the current-plan verification step. No policy in
this document authorizes provisioning Cloudflare, Supabase, Bunny, GitHub, or
AWS resources.

## Explicit Owner gates

Owner approval is required immediately before the exact action, target, and
candidate are recorded. Approval is narrow: it does not carry to another
issue, provider, region, account, candidate, or later gate.

| Boundary | Owner gate and minimum evidence | Roadmap references |
| --- | --- | --- |
| Production-derived external data placement | Owner approves the exact provider/project, region, data classes, retention, encryption, access boundary, and deletion plan. A read, restore, export, archive, or copy from Production is prohibited until this gate is recorded. | LEO-538, LEO-540, LEO-545, LEO-547 |
| Production database or write target | Owner/PM approves the exact database, schema, role, write operation, maintenance window, backup/recovery evidence, migration checksum, and rollback owner. No Production read/write or target write is implied by a local or Preview pass. | LEO-538, LEO-542, LEO-543, LEO-547, LEO-549 |
| Credential or security change | Owner and named service/security owner approve the exact credential, binding, role, policy, hostname allowlist, RLS/RPC/Edge permission, or security-control change, with a secret-safe procedure and rollback. No credential access, rotation, or security mutation is part of LEO-532. | LEO-539, LEO-541, LEO-542, LEO-544 |
| DNS or traffic cutover | Owner/PM and DNS/traffic owner approve the exact hostname, route, candidate identity, monitoring, maintenance window, and tested revert path. A Preview URL, health check, or green CI does not open this gate. | LEO-546, LEO-549, LEO-551 |
| Paid tier or overage | Owner approves the exact provider/resource, plan or overage, expected cost, time window, budget owner, and rollback/disable action. If the free allowance or current price is unknown, stop; do not infer that the service is free. | Any later issue |
| Irreversible AWS deletion or retirement | Owner/PM approves the exact inventory only after the observation pass, dependency check, retained rollback evidence, and recoverable execution plan. No broad cleanup or deletion is allowed. | LEO-548, LEO-550 |

These gates complement, and do not replace, the independent Local, PR,
Preview, Production, DNS/traffic, and Deletion gates in the canonical baseline.

## Required handoff record

Each later issue that consumes this policy must include:

1. the policy version/path and the exact candidate identity;
2. measured DB and static inventories, Worker compatibility result, Images
   transformation budget, scheduler budget, and Bunny cost boundary;
3. current provider/account verification evidence or explicit `UNKNOWN`;
4. any Owner gate with exact target, scope, evidence, and approval; and
5. `PASS`, `BLOCKED`, or `REQUIRES_SCOPE_CHANGE` for each applicable control,
   plus the next independent release gate.

LEO-532 itself performs no runtime, data, provider, credential, DNS, traffic,
paid-tier, or deletion operation. Later implementation issues remain subject
to the exclusions and candidate/rollback controls in the canonical baseline.
