# Dedicated isolated Staging EC2 (LEO-527)

This directory is the infrastructure-as-code source of truth for the
dedicated Staging host. It is intentionally separate from the historical
`dongphugia-staging-foundation` stack, whose single EC2 host is the current
Production + legacy Staging co-host.

## Contract

The stack creates only resources tagged `Environment=staging`,
`Role=isolated-staging-only`, and `SourceOfTruth=LEO-527`:

- a new subnet and route table inside the already verified project VPC;
- a new Staging-only security group with HTTP/HTTPS ingress, no SSH, no
  PostgreSQL ingress, and no Coolify admin ingress;
- a new ARM64 EC2 instance using IMDSv2, standard CPU credits, encrypted EBS,
  and a separate encrypted Docker data volume;
- a new instance profile containing only SSM/CloudWatch managed policies, with
  an optional exact-object clone read policy that is removed after restore; and
- status/CPU alarms without an SNS dependency by default.

The stack does not alter the existing Production host, its security group,
volume, containers, routes, EIP, IAM role, DNS, or database. The dedicated
host has no Production database/application credentials in its instance role.

## Apply gate

Apply only the exact template from the merged LEO-527 PR, after revalidating
the AWS account, region, VPC, unused subnet CIDR, and the Production host
identity. Use a change set and pass live values as parameters; do not commit
account, host, subnet, security-group, volume, EIP, or secret identifiers.

The normal source gate is:

```text
branch → commit → PR → required checks → review → PM merge approval → apply
```

The stack name is `dongphugia-dedicated-staging`. `CAPABILITY_IAM` is required
because the stack creates a new Staging-only role and instance profile.

## Bounded clone capability

Leave `CloneBackupObjectArn` and `CloneBackupChecksumObjectArn` empty for the
normal stack. For the one-time Production-derived clone only, set them to the
exact approved `daily/target/...dump` object and its `.sha256` sidecar in the
existing backup bucket. The conditional policy grants the new Staging role
`s3:GetObject` on exactly those two objects and nothing else. It grants no
bucket listing, deletion, write, KMS, database, or Production host access.

After checksum verification and restore into the Staging-owned database, update
the same stack with both parameters empty and verify that the conditional IAM
policy is gone. Delete the transient dump from the dedicated Staging volume
only after the restore and post-restore checks pass; retain the source backup
under its existing backup retention policy.

The LEO-523 database principal must be re-attested before any direct database
clone is considered. A role name or secret description is not sufficient:
`rolsuper`, `rolbypassrls`, role membership, and effective table DML privileges
must prove read-only. If the effective boundary fails, use the approved backup
object path or stop; do not repair Production grants in this task.

The candidate image may be pulled from the exact GHCR digest when an approved
registry-read path is available. The package is not assumed public and no
registry credential is embedded in this stack. If a pull credential is not
available, build on the ARM64 dedicated host from the exact
`c14f64cd1f3ea9f43cd1538e52534d08e02b9296` checkout, set the OCI revision label
to that SHA, and run the resulting content-addressed image by its inspected
image ID. Record only the image ID, architecture, and revision label.

## Host bootstrap and acceptance

CloudFormation user data installs Docker and the CloudWatch agent, enables SSM,
mounts the dedicated data volume at `/var/lib/dongphugia-staging`, configures
Docker to use that volume as its data root, and writes the non-secret host
contract. The operator then creates the canonical label-owned Docker network
and volume through the fail-closed isolated-Staging procedure. The host must
pass a bounded SSM RunCommand probe from start to success before any
application or database setup continues.

On the host, provision only the canonical isolated contract from
[`../../docs/deploy/isolated-staging-foundation.md`](../../docs/deploy/isolated-staging-foundation.md):

- `dpg_isolated_staging`, `dpg_staging_migrator`, and `dpg_staging_app`;
- marker `dongphugia:isolated-staging:v1`;
- network `dpg-isolated-staging-backend`, volume
  `dpg-isolated-staging-volume`, PostgreSQL container
  `dpg-isolated-staging-postgres`, and app container
  `dpg-isolated-staging-app`;
- loopback-only PostgreSQL publication, Staging runtime role, write freeze,
  noindex, and disabled scheduler/background/external side effects; and
- the immutable ARM64 candidate whose OCI revision is exactly
  `c14f64cd1f3ea9f43cd1538e52534d08e02b9296`.

Do not deploy Production containers, restore into the Production volume, add a
public PostgreSQL rule, use Production write credentials, change DNS, or run
LEO-525 MS885 migration QA here. Old co-hosted resources remain untouched and
are residual cleanup debt for LEO-528 until the dedicated acceptance is
complete.
