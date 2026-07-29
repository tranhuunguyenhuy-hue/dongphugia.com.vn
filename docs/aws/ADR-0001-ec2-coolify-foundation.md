# ADR-0001: AWS EC2 + Coolify foundation for dongphugia.vn

Date: 2026-07-29

Status: Draft for GO-STAGING review

## Decision

Use a single AWS EC2 instance in `ap-southeast-1` as the first production foundation:

```text
Cloudflare Free -> AWS EC2 Singapore -> Coolify -> Next.js container
```

The database remains Supabase. Product and editorial media remain on Bunny CDN. Container images are built outside the server by GitHub Actions and published to GHCR. The EC2 instance pulls immutable image digests; it does not build the application locally.

## Baseline and source-of-truth

Infrastructure branch:

- Worktree: `/Users/m-ac/Projects/dongphugia-aws-production`
- Branch: `codex/aws-production-foundation`
- Base: `origin/main` at `cf98ab78b9fd34403e277b5e23ea8b082b6800ce`

Application security work is in a separate worktree:

- Worktree: `/Users/m-ac/Projects/dongphugia-security-fixes`
- Branch: `codex/security-production-blockers`

`origin/main` is used as the infrastructure baseline because it is `origin/HEAD` and includes the stabilization PRs for order pricing, runtime health, SEO, admin UI, and homepage restoration. `origin/codex/homepage-category-ux` is newer than `origin/main` and remains a PM decision before final application release.

## Why EC2 + Coolify

This project needs low monthly cost, simple operations, and control over a Next.js SSR runtime. EC2 + Coolify gives the team a familiar server model while avoiding Vercel Hobby limits. Coolify provides application management, reverse proxy, TLS automation, and rollback UX without introducing Kubernetes or a managed load balancer cost.

This is intentionally a lean first production foundation, not a high-availability architecture.

## Why `t4g.small`

`t4g.small` is the preferred starting instance:

- 2 vCPU, 2 GiB RAM.
- ARM64 Graviton2 price/performance is better than comparable x86 burstable instances.
- AWS currently advertises a `t4g.small` free trial for up to 750 hours per month until 31 Dec 2026.
- The app is Node/Next.js/Prisma/Sharp based and can run on ARM64 when the container image is built for `linux/arm64`.

Initial CPU credit mode is `standard`, not `unlimited`, to prevent silent surplus CPU charges. If production shows sustained CPU pressure, the response is to right-size upward rather than let burst credits leak cost.

## x86 fallback

Use x86 only if ARM64 validation fails for a runtime dependency or image build:

- First fallback: `t3a.small`
- Second fallback: `t3.small`

Both keep the same 2 GiB RAM class but lose the T4g free-trial compute benefit. The CloudFormation draft maps instance type to the matching Amazon Linux 2023 SSM AMI parameter.

## ARM64 compatibility matrix

| Component | ARM64 decision | Evidence required before GO-STAGING |
|---|---|---|
| Node.js | Supported by official Linux ARM64 builds | Build image for `linux/arm64` and run app healthcheck |
| Next.js | Supported on Linux ARM64 when dependencies support it | `next build` inside ARM64 image |
| Prisma | Supports Linux ARM64 engines when generated in the target image | Run Prisma generate and a DB connectivity smoke test |
| Sharp | Native dependency; must use ARM64-compatible package | `sharp` installed and image processing smoke test passes |
| Docker base image | Must use multi-arch Node image | Buildx manifest includes `linux/arm64` |
| Native dependencies | Must be verified per package lock | Container build plus runtime smoke test |

## Network and VPC

Create a new VPC for the production foundation instead of using the default VPC. This avoids inheriting unknown default security-group or route-table state.

The first deployment uses one public subnet and an Internet Gateway. There is no NAT Gateway and no load balancer in the initial architecture because both add cost and operational surface area that the first release does not need.

## Public IP decision

Use one Elastic IP. DNS and Cloudflare origin configuration need a stable target. Auto-assigned public IP would change on stop/start and makes rollback/runbook work more fragile.

Public IPv4 and Elastic IP both carry hourly IPv4 cost when used. The EIP must be released only through an approved teardown plan, never during same-day go-live.

## Access model

Use AWS Systems Manager Session Manager. Do not open SSH port 22. Do not create or distribute EC2 key pairs.

The instance role uses `AmazonSSMManagedInstanceCore` plus CloudWatch agent permissions. It does not have `AdministratorAccess`.

IMDSv2 is required. Metadata hop limit is set to 2 because the host runs containers and IMDSv2 token responses otherwise fail to cross the container bridge hop.

## Coolify bootstrap

CloudFormation only prepares the host: OS updates, Docker, directories, tags, monitoring primitives, and SSM access. Coolify installation is a separate approved GO-STAGING action executed through SSM.

Coolify admin port must not be exposed publicly. Initial access must use SSM port forwarding or a temporary IP-restricted ingress rule that is removed immediately after bootstrap. The preferred path is SSM port forwarding.

## Container registry and deployment

Use GHCR as the registry. GitHub Actions builds:

- `linux/arm64`
- `linux/amd64`

Images must be tagged by immutable commit SHA. Human-readable tags such as `staging` and `production` are aliases only. Production runbooks must record and deploy by image digest.

## Secrets source-of-truth

Use one concrete model:

- Coolify-managed runtime variables for application secrets.
- SSM Parameter Store Standard for non-secret operational config.
- Secrets Manager only when rotation or service integration justifies the cost.

Secrets must not appear in source, CloudFormation plaintext parameters, user data, GitHub Actions logs, or reports.

## Backup architecture

Minimum first release:

- EBS encrypted root volume.
- DLM daily EBS snapshots with retention.
- Coolify deployment definitions exported after each production change.
- Off-instance copy of Coolify critical config before go-live.
- Supabase backup responsibility documented separately.
- Bunny CDN/storage backup responsibility documented separately.

Backup is not accepted until a restore test has been performed in staging.

## Monitoring architecture

Minimum first release:

- EC2 status check alarm.
- CPU alarm.
- CPU credit balance alarm.
- CPU surplus charge alarm.
- CloudWatch agent path for RAM/disk metrics.
- HTTP availability and latency check through Cloudflare or an external monitor.
- Billing alarms remain in AWS Budgets.

RAM and disk metrics require CloudWatch Agent and must be costed as custom metrics/log ingestion.

## Cloudflare origin security

Cloudflare Free is the public edge. The AWS origin must not expose SSH or Coolify admin. HTTP/HTTPS origin ports are public in the first draft, but final GO-PRODUCTION should prefer origin restriction to Cloudflare IP ranges or an authenticated origin tunnel pattern if it can be maintained safely.

Do not enable an origin lockout until Cloudflare traffic and rollback are verified.

## Single point of failure

This first architecture has a single EC2 instance, one public subnet, and one Elastic IP. If the instance or AZ fails, the app is down until restore or replacement. This is a deliberate cost tradeoff for the first production move.

Upgrade to a high-availability design when one of these becomes true:

- Revenue or customer impact cannot tolerate single-instance downtime.
- Sustained CPU/RAM pressure exceeds the instance class.
- Restore time objective cannot be met from snapshots.
- Team needs zero-downtime deploys rather than fast image rollback.

The next architecture would use at least two instances or ECS behind an ALB, health checks, and automated replacement.

