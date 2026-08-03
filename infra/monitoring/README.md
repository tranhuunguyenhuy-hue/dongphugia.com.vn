# Dongphugia minimum monitoring

This directory contains the deployable, secret-free monitoring package for the
single production EC2 instance in `ap-southeast-1`.

## Contents

- `cloudwatch-agent.json` collects CPU, memory, root-disk and swap metrics and
  forwards Docker stdout/stderr to a 14-day CloudWatch log group.
- `ec2-cloudwatch-agent-policy.json` is the least-privilege policy to add to
  the existing EC2 instance role. It cannot read Secrets Manager or application
  environment variables.
- `cloudwatch-monitoring.yaml` creates the log group, metric filter, alarms,
  dashboard, query definition and SNS topic. The optional email subscription
  requires the operator to confirm the email from AWS.

## Safe deployment boundary

The template has not been deployed by this change. Deploying it changes AWS
resources and requires a fresh PM maintenance window plus an IAM preflight. The
operator must first confirm that the existing EC2 instance profile can publish
the `Dongphugia/EC2` metrics and Docker logs, or apply the reviewed policy to
that role. Do not attach a new role blindly and do not inspect or print runtime
environment variables.

Before applying the stack, validate it locally with:

```sh
aws cloudformation validate-template \
  --profile dongphugia-admin \
  --region ap-southeast-1 \
  --template-body file://infra/monitoring/cloudwatch-monitoring.yaml
```

The production alert thresholds are intentionally symptom-oriented and
conservative:

- EC2 status failure: two consecutive one-minute periods.
- CPU: above 80% for three five-minute periods.
- Memory: above 85% for three five-minute periods.
- Root disk: above 80% for three five-minute periods.
- Application dependency health failure: one event in five minutes.

Missing agent metrics are treated as breaching so a silent monitoring failure
cannot look healthy. The application health route logs only a structured event
and Prisma error code; the log group must never receive request bodies,
connection strings, tokens or PII.
