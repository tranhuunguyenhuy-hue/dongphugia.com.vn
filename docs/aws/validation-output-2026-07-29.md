# Validation output — 2026-07-29

Scope: `/Users/m-ac/Projects/dongphugia-aws-production`, branch `codex/aws-production-foundation`.

## Template digest

```text
976be94187a129ad4da6699e62f7fb853af1d52f5bb18e2d993490b149eb3053  infra/cloudformation/dongphugia-ec2-coolify.yaml
```

## YAML parse

```text
YAML parse: PASS
```

## Deterministic template checks

```text
PASS root DeleteOnTermination true
PASS DLM target Backup=ebs-daily
PASS volume tag Backup=ebs-daily
PASS no ingress 22 or 8000
PASS no plaintext env assignment secrets in user data
PASS no AWS long-term access key literal
PASS no private key block
```

## cfn-lint

Tool: local temporary `cfn-lint 1.46.0`, not installed globally.

```json
[]
```

## cfn-guard

Tool: local temporary `cfn-guard 3.2.0`, not installed globally.

```text
/Users/m-ac/Projects/dongphugia-aws-production/infra/cloudformation/dongphugia-ec2-coolify.yaml Status = PASS
PASS rules
dongphugia-foundation.guard/launch_template_security            PASS
dongphugia-foundation.guard/no_public_admin_ports               PASS
dongphugia-foundation.guard/eip_retain_is_explicit              PASS
dongphugia-foundation.guard/dlm_backup_role_and_policy_exist    PASS
```

```json
{
  "name": "/Users/m-ac/Projects/dongphugia-aws-production/infra/cloudformation/dongphugia-ec2-coolify.yaml",
  "metadata": {},
  "status": "PASS",
  "not_compliant": [],
  "not_applicable": [],
  "compliant": [
    "dlm_backup_role_and_policy_exist",
    "eip_retain_is_explicit",
    "launch_template_security",
    "no_public_admin_ports"
  ]
}
```

## AWS identity

```json
{
  "UserId": "AIDAXKMNSFHHJKZFU2AKF",
  "Account": "503344933326",
  "Arn": "arn:aws:iam::503344933326:user/dongphugia-admin"
}
```

## CloudFormation validate-template

```json
{
  "Description": "Dong Phu Gia EC2 Coolify foundation draft. Creates no secrets and opens no SSH.",
  "Capabilities": [
    "CAPABILITY_IAM"
  ],
  "CapabilitiesReason": "The following resource(s) require capabilities: [AWS::IAM::Role]"
}
```

The full command output also listed ten non-`NoEcho` parameters: `Environment`, `Owner`, `CostCenter`, `InstanceType`, `RootVolumeSizeGiB`, `SnapshotRetentionCount`, `EnableDetailedMonitoring`, `AlarmNotificationTopicArn`, `LatestAmiArm64`, and `LatestAmiX86`.
