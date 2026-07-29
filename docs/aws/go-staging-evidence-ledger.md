# GO-STAGING evidence ledger

Date: 2026-07-29

This ledger tracks what is proven, what is drafted, and what remains before PM can approve `EXECUTE-STAGING-STACK`.

## Evidence status

| Requirement | Status | Evidence |
|---|---|---|
| Original dirty worktree preserved | Proven | `/Users/m-ac/Projects/dongphugia` still dirty with crawl/docs changes, not modified by infra work |
| Separate infra worktree | Proven | `/Users/m-ac/Projects/dongphugia-aws-production`, branch `codex/aws-production-foundation` |
| Separate security worktree | Proven | `/Users/m-ac/Projects/dongphugia-security-fixes`, branch `codex/security-production-blockers` |
| Baseline selected | Provisional | `origin/main` is `origin/HEAD` at `cf98ab7`; `origin/codex/homepage-category-ux` remains a PM decision |
| AWS MCP available | Missing | Tool discovery does not expose AWS MCP |
| AWS CLI available | Proven | `/Users/m-ac/.local/bin/aws`, version `aws-cli/2.36.10` |
| Caller identity | Proven | `arn:aws:iam::503344933326:user/dongphugia-admin`, account `503344933326` |
| AWS inventory | Proven read-only | No EC2/EBS/EIP/snapshot/stack/DLM/alarm/log group/SSM node; default VPC resources only |
| Budget | Proven | `dongphugia-monthly-cost-guardrail`, $5 monthly, $0 actual, $1/$5/$5 alerts to `tranhuunguyenhuy@gmail.com` |
| Free Plan | Proven | ACTIVE, `$120.00` remaining credits, expiration `2027-01-28T18:05:52Z` |
| Cost Explorer | Unavailable data | API returned `DataUnavailableException`; no permission denial and no service enablement was performed |
| Cost model | Updated | Current spend $0; public pricing estimate remains $7.28 trial-covered base / $22.76 full t4g.small before traffic/log growth |
| P0 order price tamper | Proven on baseline | Existing `src/app/api/orders/route.test.ts` verifies server-side DB pricing |
| P0 admin auth/RBAC | Draft fixed and tested | Security worktree tests pass, not merged |
| P0 stored XSS | Draft fixed and tested | Security worktree sanitizer tests pass, not merged |
| Health endpoint privacy | Draft fixed and tested | Health route no longer emits counts/region, not merged |
| Public quote phone lookup | Proven blocked | `GET /api/quote-requests` returns 405 test |
| CloudFormation draft | Draft updated | `infra/cloudformation/dongphugia-ec2-coolify.yaml` now includes Docker log rotation, CloudWatch Agent RAM/disk config, optional SNS alarm target, no EC2 Retain, and root EBS `DeleteOnTermination=true` for staging |
| CloudFormation guardrails | Draft added | `infra/cloudformation/dongphugia-foundation.guard` checks launch template security, public ingress ports, explicit EIP Retain, and DLM/root-volume backup tag match |
| IaC syntax | Proven | Ruby/Psych parses YAML stream |
| cfn-lint | Proven local | Local temp tool `cfn-lint 1.46.0`; result `[]` for `ap-southeast-1` |
| cfn-guard | Proven local | Local temp tool `cfn-guard 3.2.0`; all four project guard rules pass |
| CloudFormation validate-template | Proven | AWS CLI `validate-template` passed; capability required: `CAPABILITY_IAM` |
| Template SHA-256 | Proven | `976be94187a129ad4da6699e62f7fb853af1d52f5bb18e2d993490b149eb3053`; see `docs/aws/validation-output-2026-07-29.md` |
| Dockerfile | Draft | `infra/container/Dockerfile.nextjs` |
| Docker build amd64/arm64 | Missing | Docker CLI unavailable |
| GitHub Actions GHCR workflow | Draft only | Stored under `docs/aws`, intentionally not active |
| Backup plan | Draft | `docs/aws/operations-backup-monitoring-runbook.md` |
| Monitoring plan | Draft updated | EC2 alarms drafted; CloudWatch Agent RAM/disk metrics configured; notification target optional; external HTTP/TLS/SLO monitoring still open |
| Cloudflare/DNS/SEO plan | Draft | `docs/aws/cloudflare-dns-seo-migration-plan.md` |
| Rollback plan | Draft | Infra/app/DNS rollback documented |
| Secret scan infra | Proven for current template | Deterministic scan found no plaintext env secret assignment, AWS long-term access key, or private key block. Broad text scan only found expected words/references such as `HttpTokens`, GHCR, Supabase/Bunny names, and GitHub Actions `${{ secrets.GITHUB_TOKEN }}` placeholder |

## Current recommendation

`GO-STAGING WITH CONDITIONS`.

Reason: AWS identity, read-only inventory, budget/free-plan state, service quotas, YAML parse, local `cfn-lint`, local `cfn-guard`, deterministic secret scan, and CloudFormation `validate-template` now have evidence. Conditions remain around alarm notification target, paid rollback remnants, Docker multi-arch validation, and unmerged security fixes before production.

See `docs/aws/GO-STAGING-approval-package.md` for the full Approval Gate 1 package.
