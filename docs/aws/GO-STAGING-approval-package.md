# GO-STAGING approval package

Date: 2026-07-29

Status: `GO-STAGING WITH CONDITIONS`

This package records Approval Gate 1 evidence. PM approved `GO-STAGING WITH CONDITIONS` for local validation, artefact commit, and creating a CloudFormation change set for review only. Execution is not approved. No EC2, EBS, EIP, IAM, DNS, Cloudflare, GitHub secret, Coolify installation, or application deployment may be created until the separate `EXECUTE-STAGING-STACK` gate.

## Identity and scope

| Item | Evidence |
|---|---|
| AWS CLI | `/Users/m-ac/.local/bin/aws` reports `aws-cli/2.36.10` |
| Profile | `dongphugia-admin` |
| Region | `ap-southeast-1` |
| Caller identity | `arn:aws:iam::503344933326:user/dongphugia-admin` |
| Account guard | Every AWS request group was preceded by `sts get-caller-identity`; account matched `503344933326` |
| Infra worktree | `/Users/m-ac/Projects/dongphugia-aws-production` |
| Infra branch | `codex/aws-production-foundation` |

## Read-only AWS inventory

| Area | Result | Interpretation |
|---|---:|---|
| EC2 instances | 0 | No instance cost from EC2 compute |
| EBS volumes | 0 | No EBS volume cost |
| EBS snapshots owned by account | 0 | No snapshot storage cost |
| Elastic IPs | 0 | No public IPv4/EIP cost |
| VPCs | 1 | Default VPC only: `vpc-038d49d1dee897f9d` |
| Subnets | 3 | Default VPC subnets |
| Route tables | 1 | Default VPC route table |
| Internet gateways | 1 | Default VPC IGW |
| NAT gateways | 0 | No NAT hourly/data processing cost |
| Security groups | 1 | Default security group only: `sg-059c3daca7a9266dd` |
| SSM managed instances | 0 | No managed EC2 nodes yet |
| CloudFormation stacks | 0 | No existing project stack |
| CloudWatch alarms | 0 | No existing alarms |
| CloudWatch log groups | 0 | No current log ingestion/storage |
| DLM lifecycle policies | 0 | No snapshot policy yet |
| IAM roles | 3 | Only AWS service-linked roles for Resource Explorer, Support, Trusted Advisor |
| IAM instance profiles | 0 | No EC2 instance profile yet |

No idle paid resources were found in the requested scope. Existing default VPC networking resources do not have direct hourly cost. They are not reused by the proposed stack.

## Budget, Free Plan, and billing

| Item | Result |
|---|---|
| Budget name | `dongphugia-monthly-cost-guardrail` |
| Budget limit | `$5.00` monthly COST |
| Actual spend in budget API | `$0.00` |
| Notifications | `$1 actual`, `$5 actual`, `$5 forecast` |
| Subscriber | `tranhuunguyenhuy@gmail.com` |
| Notification state | `OK` for all three |
| Free Plan status | `ACTIVE` |
| Remaining credits | `$120.00` |
| Expiration UTC | `2027-01-28T18:05:52.574000+00:00` |
| Expiration Vietnam time | `01:05:52 ngày 29/01/2027` |
| Free Tier usage API | Empty list. This means no tracked free-tier usage has appeared yet; it does not prove every future service is free. |
| Cost Explorer | `DataUnavailableException`. Data is not currently available/ingested; not a permission denial. No service was enabled. |

## Service quotas

| Quota | Value | Assessment |
|---|---:|---|
| Running On-Demand Standard vCPUs | 5 | Enough for one `t4g.small`, `t3a.small`, or `t3.small` host |
| EC2-VPC Elastic IPs | 5 | Enough for one EIP |
| CloudFormation stacks | 2000 | Enough for one staging foundation stack |

## Proposed stack

Template: `infra/cloudformation/dongphugia-ec2-coolify.yaml`

Resources proposed after explicit `GO-STAGING`:

- New VPC, public subnet, route table, Internet Gateway.
- Security group with only TCP 80/443 ingress.
- EC2 IAM role and instance profile with SSM and CloudWatch Agent managed policies.
- Launch template using Amazon Linux 2023 public SSM AMI parameters.
- One EC2 instance, default `t4g.small`, CPU credits `standard`.
- Encrypted 30 GiB gp3 root EBS volume.
- One Elastic IP.
- DLM role and daily EBS snapshot lifecycle policy.
- CloudWatch alarms for EC2 status, CPU, CPU credit balance, and CPU surplus charged.

## CloudFormation review

| Review item | Result |
|---|---|
| Retain EC2 | Changed. The EC2 instance itself is no longer retained so stack deletion should stop compute cost. |
| Protect volume/snapshots | For staging, root EBS now uses `DeleteOnTermination: true` to avoid orphaned root-volume cost after stack deletion. DLM snapshots can still retain restore points after they are created. |
| EIP Retain | Still retained to avoid losing production-origin IP accidentally. This can become an idle EIP charge if stack is deleted and the EIP is not released by runbook. |
| DLM trust | Trust principal is `dlm.amazonaws.com`. |
| DLM permissions | Includes snapshot create/delete/describe and create-tags. Uses `Resource: '*'` for EC2 snapshot/describe actions; local `cfn-lint` and project `cfn-guard` pass. IAM Access Analyzer remains a future enhancement if available. |
| Snapshot tag match | Launch template volume tags include `Project=dongphugia`, `Environment=<param>`, `Backup=ebs-daily`; DLM target tags match those values. |
| CloudWatch Agent | Added RAM and root disk/inode metric config in user data. No custom metric alarms are added until actual CWAgent metric dimensions are confirmed in staging. |
| Alarm notifications | Added optional `AlarmNotificationTopicArn`. If blank, alarms are created without actions. This is acceptable only for initial smoke staging, not production operations. |
| CPU credit alarm dimension | Uses `InstanceId`, matching EC2 credit metrics. |
| CPU credits | `standard`, not `unlimited`. |
| IMDSv2 | `HttpTokens: required`. |
| IMDS hop limit | `2`, needed for container workloads on EC2 bridge networking. |
| Ingress 22/8000 | Not present. |
| Secrets in user data | None found by local scan. |
| User data idempotence | Bootstraps with deterministic package install, Docker log config, CloudWatch Agent config, and directory creation. EC2 user data still runs once by default; post-bootstrap operations must use SSM/Coolify runbooks. |
| ARM/x86 AMI selection | `t4g.small` maps to ARM64 AL2023 SSM parameter; `t3a.small`/`t3.small` map to x86_64 AL2023 SSM parameter. |
| Rollback/delete paid remnants | Possible retained EIP and retained DLM snapshots. Root EBS should terminate with the instance in staging. Compute should not be retained after the EC2 Retain change. |

## Validation evidence

| Check | Result |
|---|---|
| YAML parse | Pass, one YAML document |
| Secret scan for infra template | Pass: no plaintext env secret assignment, AWS long-term access key, or private key block. Broad text scan produced only expected false positives such as `HttpTokens`, service names, and GitHub Actions secret placeholder. |
| `aws cloudformation validate-template` | Pass |
| CloudFormation capability | `CAPABILITY_IAM` required because template creates IAM roles |
| `cfn-lint` | Pass using local temp `cfn-lint 1.46.0`; output `[]` for `ap-southeast-1`. Not installed globally. |
| `cfn-guard` | Pass using local temp `cfn-guard 3.2.0`; rules passed: launch template security, no public admin ports, explicit EIP Retain, DLM backup role/policy and tag match. Not installed globally. |
| Change set | Approved to create for review only. Not approved to execute. |

## Paid-remnant cleanup checklist

If a staging change set is executed later and the stack is rolled back or deleted, confirm all of the following before declaring the environment cleaned up:

1. EC2 instance is terminated and no replacement instance remains running.
2. Root EBS volume is gone; staging root volume uses `DeleteOnTermination: true`.
3. Any retained EIP is either still intentionally associated to the active origin or released after DNS/Cloudflare no longer references it.
4. DLM-created snapshots are reviewed and deleted if PM no longer needs restore points.
5. DLM lifecycle policy and IAM role are gone with the stack unless CloudFormation reports a retained/orphaned resource.
6. CloudWatch alarms/log groups/custom metrics are checked for ongoing charge-bearing remnants.
7. Budget alerts remain active because AWS Budgets can lag and cannot prevent spend.

## Cost estimate

Current actual AWS spend is `$0.00` per Budget API.

Planning estimate before traffic/log/custom metric growth:

| Scenario | Monthly estimate |
|---|---:|
| `t4g.small` compute trial applies | about `$7.28` |
| `t4g.small` full on-demand | about `$22.76` |
| `t3a.small` fallback | about `$24.51` |
| `t3.small` fallback | about `$26.55` |

Included assumptions: 730 hours/month, 30 GiB gp3 root EBS, 15 GiB snapshot storage, one in-use public IPv4/EIP. Excluded: traffic, CloudWatch custom metrics/log ingestion, Docker/GHCR transfer effects, and human-operated external monitors.

## Application security branch review

Security worktree: `/Users/m-ac/Projects/dongphugia-security-fixes`

Branch: `codex/security-production-blockers`

Evidence:

| Requirement | Evidence |
|---|---|
| Admin revalidate fail-closed | `/api/admin/revalidate` returns 503 if no configured secret; tests cover no secret and wrong secret. |
| GET no longer mutates admin revalidate | `GET /api/admin/revalidate` returns 405; tests cover this. |
| Health endpoint does not expose counts/region/raw stack | Counts and `region` removed; DB failure returns generic error and 503; tests cover this. |
| Sale assigned-order rule | `updateOrderStatus` allows sale user only for assigned order; tests cover assigned and unassigned paths. |
| Admin permissions | Product/blog/partner/project mutations require permissions; admin order reads require auth; tests cover blocked unauthorized writes. |
| Server-side order pricing | Public `POST /api/orders` ignores client name/SKU/price and calculates from DB via `calculateOrderUnitPrice`; existing tests cover this. |
| Stored HTML sanitation | `sanitizeRichHtml` added; public blog page and product detail tabs sanitize before `dangerouslySetInnerHTML`; tests cover scripts, event handlers, and JavaScript URLs. |
| Draft blog boundary | `getBlogPostBySlug` now requires `status='published'` and `published_at <= now`; test covers query shape. |
| Phone-only lookup/privacy | `GET /api/quote-requests` returns 405; test covers no public quote history by phone. No public order lookup by phone was found in `src/app/api`. |
| Production dependency audit | `npm audit --omit=dev --json` reports 0 vulnerabilities. |
| Focused tests | 8 files, 23 tests passed. |
| Full unit tests | 21 files, 60 tests passed. |
| Typecheck | `npx tsc --noEmit --incremental false` exited 0. |

Open security observations before production:

- `/api/revalidate` is a separate cross-domain endpoint. It rejects GET with 405 and fails closed if no secret, but currently uses simple string comparison and returns 500 when `REVALIDATION_SECRET` is missing. It should be reviewed/hardened before production cutover.
- CSP is not configured in `next.config.ts`.
- HSTS is not configured in `next.config.ts`; it may be handled at Cloudflare, but the production owner must decide and verify.
- Admin `createOrder` server action still accepts admin-entered unit prices. It now requires `orders:edit`, so it is not the public order tamper P0, but it remains a business-control decision.
- The security branch is unmerged and uncommitted in its worktree. It must be reviewed and merged or explicitly included in the release branch before go-live.

## Monitoring and backup

Backup plan:

- Encrypted root EBS volume.
- Daily DLM snapshots, retention default 7.
- Coolify export and off-instance copy after bootstrap.
- Restore test required before GO-PRODUCTION.
- Supabase and Bunny backup responsibilities remain external and must be confirmed.

Monitoring:

- EC2 status/CPU/credit/surplus alarms are in the template.
- CloudWatch Agent RAM/disk metrics are now configured.
- Custom RAM/disk alarms are intentionally not in the template until staging confirms actual metric dimensions.
- No alarm notification topic is created. Provide an existing SNS topic ARN or accept silent alarms only for short-lived staging smoke tests.
- External HTTP availability, latency, TLS, Cloudflare 5xx, and application SLO monitoring remain open.

## Conditions for `GO-STAGING`

`GO-STAGING WITH CONDITIONS` has been accepted for change-set creation only, with the conditions below:

1. Create staging foundation only, with no production DNS or traffic.
2. Do not install Coolify or deploy the app until the stack is created and SSM access is verified.
3. Accept local validation results: `cfn-lint`, `cfn-guard`, YAML parse, deterministic template checks, and AWS `validate-template` all pass.
4. Accept possible paid remnants on rollback/delete: retained EIP and retained snapshots. The staging root EBS volume is configured to delete with the instance.
5. Provide an existing SNS topic ARN for alarm notifications, or accept that staging alarms may initially have no notification actions.
6. Keep Budget alerts active and monitor daily because AWS Budgets are delayed and do not stop spend.
7. Merge or explicitly release the P0 security branch before GO-PRODUCTION.
8. Harden `/api/revalidate`, CSP, and HSTS before GO-PRODUCTION, or document equivalent Cloudflare controls with evidence.
9. Validate Docker multi-arch image build and runtime health before app deployment.
10. Run backup/restore proof in staging before GO-PRODUCTION.

## Change Set Review Gate

Waiting for explicit PM approval: `EXECUTE-STAGING-STACK`.

The next allowed AWS action is change-set review only. Execution still requires a second human review.
