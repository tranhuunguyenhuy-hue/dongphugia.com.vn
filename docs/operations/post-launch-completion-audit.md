# Dongphugia post-launch completion audit

Status: **HOLD - preparation complete, production hardening gates open**.

This audit is documentation-only. It does not authorize DNS, Vercel, Coolify,
AWS, database, Bunny or production-data changes. Evidence is sanitized and
must not be replaced with secret values, raw logs, rows or PII.

## Gate matrix

| Gate | Current status | Evidence | Required to close |
| --- | --- | --- | --- |
| AWS is the only public writer | PASS | Current launch handoff; `.com.vn` invalid write remains `503 WRITE_FREEZE_ACTIVE` | Reconfirm immediately before any future mutation |
| `.vn` health and canonical behavior | PASS | Read-only monitor: health/home/listing/search `4/4` `200`; apex HTTP/HTTPS exact `308` with path/query preservation | Recheck in PM window |
| `.com.vn` rollback baseline | PASS | Homepage `200`; invalid quote write blocked by freeze marker | Keep reachable and frozen |
| Exact immutable ARM64 candidate | PASS on staging | GHCR workflow `30804874102`; digest `sha256:73403c...276046`; one ARM64 manifest; SBOM/provenance; Trivy HIGH/CRITICAL `0` | Production rollout only in PM window |
| Exact candidate staging runtime | PASS | Coolify deployment `tvsrq1yc9hl56y89uretmqvi`; running/healthy; restart `0`; route matrix PASS | Reconfirm digest before production rollout |
| Bunny media compatibility | PASS for read path | Staging rendered Bunny hostname marker; no Bunny write credential used | Production media inventory still required |
| Source-role cleanup | PASS | Both fresh/overnight roles `ROLE_ABSENT`; local material absent | Repeat for each future fresh role |
| Monitoring source package safety | PASS | `monitor:verify-package`: `15/15`; aggregate-only sanitizer; no secret-read permissions; fail-closed timer/alarm | Deploy stack and timer in PM window |
| Monitoring AWS resources | PENDING | CloudFormation validates; no production monitoring stack exists | IAM preflight, stack deploy, SNS confirmation and bounded alarm test |
| Production DB readiness | PASS | `pg_isready=ready`; no restart/die/OOM events in last six hours | Recheck in PM window |
| Production DB connection headroom | PASS for total connections; active/idle submetrics UNVERIFIED | Read-only aggregate: `11` connections / `max_connections=30` (`36.7%`), below the `70%` threshold; database size also returned as an aggregate | Capture active/idle/locks through approved monitoring path before final acceptance |
| Production Lighthouse | BASELINE FAIL / CANDIDATE PENDING | Current production LCP exceeded optional `2500ms`; candidate has not been deployed to production | Run mobile/desktop evidence after candidate rollout; keep optional threshold disposition explicit |
| Staging capacity | BOUNDED PASS | `149` GETs at `5 RPS`/`30s`; `0%` failures; p95 `127.8ms`; max `411.3ms` | Full campaign only with approved isolation/window; shared EC2 makes long soak unsafe without approval |
| Production capacity/soak | PENDING | No production load was sent | PM-approved read-only campaign, or explicit deferral |
| Legacy URL inventory | PREPARED / NOT FINAL | Static map yielded `29,476` candidate HTTPS URLs; no Search Console/crawl review merged | Merge reviewed export, classify valid/unknown/spam, verify bounded sample |
| Legacy `.com.vn` redirects | HOLD | Seven-day stable observation not complete; sample verifier saw non-`308` current legacy behavior | Monitoring PASS, reviewed inventory, PM approval, then exactly two web-host redirects; never Bunny |
| Rollback readiness | PASS baseline / FUTURE WINDOW REQUIRED | Vercel and `.com.vn` remain reachable and frozen; DNS rollback records retained | Re-HEAD artifacts and reverify just before any mutation |
| Final ownership release | PENDING | AWS remains sole writer; handoff files current | Release only after final acceptance or verified rollback |

## Next PM-window sequence

1. Re-read handoff files, verify time/window/ownership and confirm the root
   worktree remains untouched for deployment.
2. Revalidate AWS identity/SSM, exact production digests, DNS, backup HEAD and
   rollback records. Load the reviewed AWS secret-safety instructions before
   any credential task.
3. Deploy only the reviewed aggregate-only monitoring package and verify the
   timer, log group, alarms, SNS confirmation and sanitized sample event.
4. If production candidate rollout is approved, create the required fresh
   freeze/backup/reconciliation evidence; never reuse the prior staging or
   night copy as final.
5. Reconcile data, verify DB headroom, run bounded dark smoke and production
   Lighthouse/capacity gates. Any mismatch is NO-GO.
6. Keep `.com.vn`/Vercel reachable and source-write-frozen. Apply no DNS or
   legacy redirect until every mandatory gate is PASS and PM explicitly
   authorizes the exact records/window.

## Evidence hygiene

- The dirty root worktree is user-owned and must not be cleaned, reset, stashed
  or used as a deployment source.
- The clean implementation branch is
  `/private/tmp/dpg-post-launch-hardening`, currently pushed at the latest
  hardening commits.
- No secret values, database URLs, raw logs, request bodies, table rows or PII
  belong in this audit.
