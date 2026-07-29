# Storage update evidence — 2026-07-29

Scope: staging foundation precondition before Coolify installation.

## Reason

Coolify requires at least 30 GB free disk space before installation. The initial 30 GiB root volume had only 28G available:

```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p1   30G  2.5G   28G   9% /
```

## IaC change

`RootVolumeSizeGiB` default changed from `30` to `40`.

No intentional changes were made to:

- instance type;
- Elastic IP;
- security group ingress/egress;
- IAM permissions;
- CloudWatch alarm definitions;
- DLM policy.

The existing stack update must pass `RootVolumeSizeGiB=40` explicitly because existing stack parameters do not automatically adopt a new template default.

## Validation output

Template SHA-256 after this change:

```text
f5ec0f637a6f55850b91584fbebd5d41f4de8facd1af83cb06d07a31d242f9f8  infra/cloudformation/dongphugia-ec2-coolify.yaml
```

Validation:

```text
YAML parse: PASS
PASS RootVolumeSizeGiB default 40
PASS BlockDeviceMappings uses RootVolumeSizeGiB
PASS root DeleteOnTermination true
PASS DLM target Backup=ebs-daily
PASS volume tag Backup=ebs-daily
PASS no ingress 22/6001/6002/8000
PASS no plaintext env assignment secrets in user data
PASS no AWS long-term access key literal
PASS no private key block
cfn-lint: []
cfn-guard: PASS
aws cloudformation validate-template: PASS, CAPABILITY_IAM
```
