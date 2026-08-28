# Cloudflare Production promotion contract

LEO-537 adds a reusable, fail-closed promotion workflow at
`.github/workflows/production-promotion.yml`. It is a merge-to-main delivery
path for the static-first Cloudflare target; it does not change the current
AWS Production runtime or perform a cutover.

## Candidate handoff

The operator supplies the exact completed LEO-535 Preview workflow run, its
`dongphugia-preview-<sha>` artifact, the Preview evidence digest, the Preview
PR-head SHA, and the task-owned PR number. The workflow downloads that artifact
from the recorded run, verifies the complete identity tuple and recomputes the
content digest before any Cloudflare action. The Pages `--commit-hash` is the
same Preview PR-head SHA. A different source, run, artifact, or digest fails
closed.

The same inputs with `mode=rollback` select a previously validated Preview
artifact. Rollback does not accept a mutable tag, latest reference, or an
unverified artifact.

## Protection and enablement

The deployment job targets the GitHub `production` environment. Before this
path can be enabled, the Owner must configure that environment's required
reviewers and branch restriction to `main`, and provide existing least-
privilege `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and
`CLOUDFLARE_PAGES_PRODUCTION_PROJECT` values. `PRODUCTION_PROMOTION_ENABLED`
must remain absent or not `true` until the separate cutover gate is approved.

When disabled, the workflow records `BLOCKED_BY_CUTOVER_OWNER_GATE` and does
not start the protected environment job. A failed promotion records a
`FAILED_CLOSED` summary and does not retry, alter DNS/traffic, or delete a
deployment. The target workflow has no SSM, EC2, Docker, Coolify, or AWS
delivery step.

This contract is source evidence only. Live GitHub environment reviewers,
variables, secrets, Cloudflare project identity, and the cutover approval are
not asserted by this file and must be revalidated at the later release gate.
