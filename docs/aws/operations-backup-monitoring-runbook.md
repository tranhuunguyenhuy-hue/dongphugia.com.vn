# Operations, backup, monitoring, and rollback runbook

Date: 2026-07-29

Status: Draft for GO-STAGING review. Do not execute any production action from this document before approval.

## Operating principle

The first AWS release is intentionally simple: one EC2 instance runs Coolify and the Next.js container. That keeps cost low, but it also means the host is a single point of failure. Operations must therefore be boring, documented, and reversible.

No operator should need inbound SSH. All host access must use AWS Systems Manager Session Manager after identity/account/region are reconfirmed.

## Ownership

| Area | Owner before handoff | Required customer input |
|---|---|---|
| AWS account and budgets | Project owner | Confirm billing contact and escalation phone |
| Domain and Mắt Bão | Customer | Confirm domain manager and go-live contact |
| Cloudflare zone | To be decided | Decide customer-owned or project-owned account |
| Supabase | Customer/project owner | Confirm plan, backup policy, and dashboard access |
| Bunny CDN/storage | Customer/project owner | Confirm storage zone, CDN hostname, and recovery policy |
| GHCR/GitHub Actions | Project owner | Confirm repository permissions and environment approval availability |

## Backup design

### What must be backed up

| Data | Backup method | Retention | Restore proof required |
|---|---|---:|---|
| EC2 root volume | AWS DLM daily EBS snapshot | 7 snapshots initial | Restore to a staging replacement instance |
| Coolify state/config | Coolify export plus off-instance copy | After every production change | Import/export dry run in staging |
| Docker Compose/deployment definitions | Store exported definitions outside the instance | Keep current and previous 3 releases | Redeploy previous image digest |
| Runtime env variable inventory | Record variable names only, never values | Keep with release notes | Confirm required names exist in Coolify |
| Supabase database | Supabase-native backups | Per Supabase plan | Restore rehearsal or point-in-time restore evidence |
| Bunny media | Bunny responsibility plus manifest/export plan | To be confirmed | Verify representative media recovery |

### What must not be backed up into reports

- Secret values.
- Database URLs.
- Bunny API keys.
- Private keys.
- OAuth tokens.
- Session cookies.
- Full customer PII exports.

## Backup procedure after GO-STAGING

1. Confirm AWS identity and region.
2. Confirm the stack name and instance ID.
3. Confirm DLM snapshot policy exists and targets the root volume tag set:
   - `Project=dongphugia`
   - `Environment=staging`
   - `Backup=ebs-daily`
4. After Coolify bootstrap, export Coolify deployment definitions.
5. Record image digest and runtime variable names.
6. Store the export off-instance.
7. Run a restore test before any GO-PRODUCTION recommendation.

## Restore test acceptance criteria

A restore test is accepted only when all of these are true:

- A replacement host or staging target is prepared without SSH.
- Coolify deployment definition imports successfully.
- The app starts from a recorded GHCR image digest.
- `/api/health` returns success without exposing internal counts or raw errors.
- A public page, a product page, a blog page, and cart/order submission smoke tests pass.
- Rollback to previous digest has been tested.
- Restore notes include exact commands/actions, without secrets.

## Monitoring plan

### AWS metrics and alarms

The CloudFormation draft includes first-pass alarms:

| Signal | Alarm style | Missing data handling | Why |
|---|---|---|---|
| EC2 status check | 2 of 2, 1-minute periods | `breaching` | If status metrics disappear, treat host as unhealthy |
| CPU utilization | 3 of 3, 5-minute periods | `notBreaching` | Sustained pressure indicates right-sizing issue |
| CPU credit balance | 3 of 3, 5-minute periods | `notBreaching` | Prevent burst exhaustion on T instance |
| CPU surplus charged | 1 of 1, 5-minute periods | `notBreaching` | Should remain zero with `standard` credit mode |

CloudWatch Agent is configured by the CloudFormation user data to publish memory and root disk/inode metrics. After staging exists, confirm actual metric names and dimensions, then add or confirm:

| Signal | Source | Initial threshold |
|---|---|---|
| Memory used percent | CloudWatch Agent custom metric | > 80% for 15 minutes |
| Disk used percent | CloudWatch Agent custom metric | > 75% warning, > 85% critical |
| Inode used percent | CloudWatch Agent or host script | > 80% |
| Container restart count | Docker/Coolify metric or log-derived check | Any repeated restart in 10 minutes |
| HTTP availability | External monitor or Cloudflare health check equivalent | 2 failed checks |
| HTTP latency | External monitor | p95 above baseline x2 |
| HTTP 5xx | Cloudflare analytics / app logs | > 1% for 5 minutes |
| TLS expiry | External monitor | < 14 days |
| Backup failure | DLM/CloudWatch/EventBridge | Any failure |
| Budget actual | AWS Budgets | Existing $1 and $5 alerts |
| Budget forecast | AWS Budgets | Existing $5 forecast |

Alarms should avoid `M=N=1` except for sparse failure signals. Tail latency must use p95/p99 once a latency source exists; average latency is not an acceptable production alarm.

Current template gap: EC2 alarms can optionally publish to an existing SNS topic via `AlarmNotificationTopicArn`, but no SNS topic is created by the foundation stack. Blank `AlarmNotificationTopicArn` means alarms exist without notification actions. This is acceptable only for initial staging smoke tests, not production operations.

### Dashboard plan

Dashboard name: `dongphugia-staging-foundation`

Minimum rows:

1. Alarm status row.
2. EC2 CPU, credit balance, surplus charged.
3. Memory and disk once CloudWatch Agent is configured.
4. HTTP availability, 5xx, and latency.
5. Deployment metadata: image digest, app version, last rollback target.
6. Billing panel with current month spend and forecast once Cost Explorer/Budgets data is available.

### CloudTrail operations audit

Before GO-STAGING execution, use CloudTrail Event History to correlate changes during the deployment window. Long-term CloudTrail trail to S3 is recommended but not required for the first staging stack unless PM accepts the extra storage/logging scope.

During incidents, check CloudTrail for:

- `RunInstances`
- `TerminateInstances`
- `StopInstances`
- `StartInstances`
- `AuthorizeSecurityGroupIngress`
- `RevokeSecurityGroupIngress`
- `AssociateAddress`
- `DisassociateAddress`
- `CreateChangeSet`
- `ExecuteChangeSet`
- `DeleteStack`
- `StartSession`
- `SendCommand`

## Incident runbooks

### EC2 unavailable

Business impact: the website may be down because this architecture has one host.

1. Confirm external symptom from at least two networks or monitors.
2. Check EC2 status check alarm.
3. Check CloudWatch CPU/credit/disk/memory if available.
4. Use SSM Session Manager only if the instance is online.
5. If instance status check failed and recovery is not quick, prepare replacement from latest snapshot.
6. Do not terminate the old instance until snapshot and forensic state are preserved.
7. If DNS is already on Cloudflare, keep old Vercel deployment available as rollback path if still valid.

### Coolify unavailable

1. Confirm website health separately from Coolify admin.
2. Access Coolify through SSM port forwarding only.
3. Check Docker service and Coolify containers.
4. Restart Coolify only after recording current container state.
5. Do not open port 8000 to the public Internet.

### Application crash loop

1. Check latest deployed image digest.
2. Inspect container logs for the current digest.
3. Confirm runtime variable names exist in Coolify; do not print values.
4. Roll back to previous known-good image digest.
5. Run smoke tests after rollback.
6. Record the failed digest as blocked.

### Disk full

1. Confirm disk and inode usage.
2. Stop non-critical log growth first.
3. Prune unused Docker images only after confirming previous rollback digest is still pullable from GHCR.
4. Export Coolify state before risky cleanup where possible.
5. Increase EBS size through CloudFormation only after PM approval if it changes cost.

### High CPU or depleted credits

1. Confirm `CPUCreditBalance` and `CPUUtilization`.
2. Confirm `CPUSurplusCreditsCharged` remains zero.
3. If CPU is sustained high, do not switch to unlimited as a first response.
4. Reduce traffic, roll back bad release, or right-size instance after cost approval.

### Certificate failure

1. Confirm whether failure is at Cloudflare edge or origin.
2. If edge certificate fails, pause DNS/traffic migration.
3. If origin certificate fails behind Full Strict, switch only according to approved rollback plan.
4. Do not disable HTTPS permanently as a workaround.

### GHCR pull failure

1. Confirm image digest exists in GHCR.
2. Confirm Coolify registry credentials are present without printing values.
3. Roll back to a digest already present on host if safe.
4. If all pulls fail, keep current container running and postpone deployment.

### Supabase outage

1. Confirm `/api/health` DB status.
2. Confirm Supabase status/dashboard outside app.
3. Do not restart EC2 repeatedly for a Supabase outage.
4. Communicate degraded state and pause writes if needed.

### Bunny outage or media failure

1. Confirm HTML/API app health separately from image delivery.
2. Confirm sample CDN URLs.
3. Avoid app rollback unless the image URL generation changed in the release.
4. Prepare temporary fallback messaging if media is unavailable.

## Application rollback

Rollback unit: GHCR image digest.

Required before rollback:

- Current digest.
- Previous known-good digest.
- Reason for rollback.
- Whether database/schema changes are backward-compatible.

Rollback steps after approval:

1. In Coolify, select the previous image digest.
2. Deploy without changing runtime secrets.
3. Verify `/api/health`.
4. Verify homepage, product page, blog page, cart/order tamper test, admin auth smoke test.
5. Record rollback time and result.

## Origin and DNS rollback

Before production DNS migration, keep the previous Vercel deployment available for at least 7-14 days if access and cost allow.

Rollback options:

1. Cloudflare route back to old Vercel target.
2. Revert Cloudflare DNS record to old target.
3. If nameserver migration itself fails, ask customer to revert nameservers at Mắt Bão.

Do not delete old DNS records or old hosting on go-live day.
