# GO-STAGING change set draft

Date: 2026-07-29

Status: Approved for change-set creation only. Do not execute before explicit `EXECUTE-STAGING-STACK`.

## Executive summary

This change set prepares a low-cost AWS foundation for `dongphugia.vn` without moving production traffic. The proposed staging foundation creates one EC2 host in Singapore, managed through SSM, with no public SSH and no public Coolify admin port. It is designed for Coolify to run the Next.js container image built by GitHub Actions/GHCR.

AWS MCP is still not exposed as a callable tool, but AWS CLI is available at `/Users/m-ac/.local/bin/aws`. Caller identity, read-only inventory, local `cfn-lint`, local `cfn-guard`, deterministic template checks, and CloudFormation `validate-template` have now been completed successfully.

## Baseline

- Infrastructure worktree: `/Users/m-ac/Projects/dongphugia-aws-production`
- Infrastructure branch: `codex/aws-production-foundation`
- Base commit: `cf98ab78b9fd34403e277b5e23ea8b082b6800ce`
- Application security branch: `codex/security-production-blockers`
- Dirty original worktree preserved: `/Users/m-ac/Projects/dongphugia`

## Proposed AWS resources

CloudFormation template: `infra/cloudformation/dongphugia-ec2-coolify.yaml`

Resources to create after approval:

| Resource | Purpose | Stateful | Cost note |
|---|---|---:|---|
| VPC | Isolated network foundation | No | No direct hourly charge |
| Public subnet | Single host subnet | No | No direct hourly charge |
| Internet Gateway | Public ingress/egress | No | No direct hourly charge |
| Route table and route | Internet routing | No | No direct hourly charge |
| Security Group | Allows only 80/443 ingress | No | No direct hourly charge |
| IAM Role | SSM and CloudWatch agent | No | No direct hourly charge |
| Instance Profile | Attach role to EC2 | No | No direct hourly charge |
| Launch Template | Reusable EC2 definition | No | No direct hourly charge |
| EC2 Instance | Coolify host | Yes, by attached root EBS | t4g.small compute may be trial-covered |
| EBS gp3 root volume | Host OS, Docker, Coolify state | Yes | 30 GB gp3 charged monthly |
| Elastic IP | Stable Cloudflare origin target | No | Public IPv4 hourly charge |
| DLM role/policy | Daily EBS snapshots | No | Snapshots consume paid storage |
| CloudWatch alarms | Health/cost signal | No | Standard alarm charges may apply |

## Security decisions

- No SSH key pair.
- No inbound port 22.
- No inbound Coolify admin port 8000.
- IMDSv2 required.
- IMDS hop limit 2 for containers.
- CPU credit mode `standard`.
- Instance role has SSM and CloudWatch agent permissions only, no AdministratorAccess.
- User data contains no secrets.
- CloudFormation parameters contain no secrets.
- Docker daemon log rotation is configured.
- CloudWatch Agent RAM and root disk/inode metrics are configured.
- Alarm notifications can use an existing SNS topic through `AlarmNotificationTopicArn`; blank means alarms have no actions.

## Known design limitations

- Single EC2 instance is a single point of failure.
- No load balancer in the first release.
- No NAT Gateway by design to control cost.
- HTTP/HTTPS ingress is public in the first draft. Final production hardening should restrict origin access to Cloudflare IPs or use an authenticated origin pattern after Cloudflare is verified.
- RAM/disk metrics need staging confirmation before adding metric alarms because CloudWatch Agent disk metric dimensions can vary by host.
- Alarm notifications require an existing SNS topic ARN or will be silent.
- Stack deletion can leave paid remnants: retained EIP and retained snapshots. The staging root EBS volume is configured to delete with the instance.

## Cost model summary

These are planning numbers from AWS public pricing data and prior deterministic calculation. They must be reconfirmed against the account before GO-STAGING.

| Scenario | Estimated monthly infrastructure |
|---|---:|
| t4g.small compute trial applies | about USD 7.28 before traffic/log growth |
| t4g.small full on-demand | about USD 22.76 before traffic/log growth |
| t3a.small x86 fallback | about USD 24.51 before traffic/log growth |
| t3.small x86 fallback | about USD 26.55 before traffic/log growth |

Important caveats:

- Public IPv4/EIP is charged while in use.
- EBS and snapshots are charged even if compute is trial-covered.
- T-family `unlimited` mode can create CPU surplus charges; draft uses `standard`.
- AWS Budgets alerts are delayed and do not stop spend.
- Forecast alerts can be weak before enough usage history exists.

## Exact commands after GO-STAGING

These commands are approved only for validation and creating a CloudFormation change set for review. They are not approval to execute the change set.

```bash
/Users/m-ac/.local/bin/aws sts get-caller-identity --profile dongphugia-admin --region ap-southeast-1
/Users/m-ac/.local/bin/aws configure get region --profile dongphugia-admin
/Users/m-ac/.local/bin/aws cloudformation validate-template \
  --template-body file://infra/cloudformation/dongphugia-ec2-coolify.yaml \
  --profile dongphugia-admin \
  --region ap-southeast-1
```

Create a change set for review only. Do not execute it until PM gives the exact approval phrase `EXECUTE-STAGING-STACK`.

```bash
/Users/m-ac/.local/bin/aws cloudformation create-change-set \
  --stack-name dongphugia-staging-foundation \
  --change-set-name dongphugia-staging-foundation-$(date +%Y%m%d%H%M%S) \
  --change-set-type CREATE \
  --template-body file://infra/cloudformation/dongphugia-ec2-coolify.yaml \
  --capabilities CAPABILITY_IAM \
  --parameters ParameterKey=Environment,ParameterValue=staging \
    ParameterKey=InstanceType,ParameterValue=t4g.small \
    ParameterKey=EnableDetailedMonitoring,ParameterValue=false \
    ParameterKey=AlarmNotificationTopicArn,ParameterValue= \
  --profile dongphugia-admin \
  --region ap-southeast-1
/Users/m-ac/.local/bin/aws cloudformation describe-change-set \
  --stack-name dongphugia-staging-foundation \
  --change-set-name <change-set-name> \
  --profile dongphugia-admin \
  --region ap-southeast-1
```

Note: current `validate-template` output reports `CAPABILITY_IAM`. `CAPABILITY_NAMED_IAM` is not required by the current template because IAM resources do not have fixed names.

Execution of the change set requires a second human review if the actual change set differs from this draft.

## Validation still required

- AWS inventory read-only. Completed 2026-07-29.
- `cfn-lint` validation. Completed locally with `cfn-lint 1.46.0`, output `[]`.
- `cfn-guard` validation. Completed locally with `cfn-guard 3.2.0`, all project rules passed.
- CloudFormation validate-template. Completed 2026-07-29.
- CloudFormation change-set diff review.
- Secret scan on all infra files.
- Shell lint for bootstrap commands.
- Docker multi-arch build validation.
- Staging smoke/auth/order-tamper/XSS/privacy/performance/rollback tests.
- Backup and restore test.

## Recommendation today

`GO-STAGING WITH CONDITIONS`.

Conditions:

1. PM accepts possible paid remnants on rollback/delete: retained EIP and retained snapshots. The staging root EBS volume is configured to delete with the instance.
2. PM provides an existing SNS topic ARN for alarm notifications or accepts silent alarms for initial staging smoke tests.
3. Security branch P0 fixes are reviewed and merged or explicitly included before production.
4. Docker multi-arch build and runtime health are validated before app deployment.
