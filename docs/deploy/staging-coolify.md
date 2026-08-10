# Exact-commit staging preview — private Coolify UI gate

This runbook is the LEO-495 staging path for the existing staging application:

`open PR head → required checks → exact-main rollback image + PR-head candidate
image → immutable evidence → private Coolify UI gate → running-digest,
database-isolation and browser acceptance`

The GitHub workflow is a source/image gate only. It builds and verifies images,
writes a manifest and operator handoff, then stops before any Coolify API or
deployment call. No Coolify credential, control-plane URL, application UUID,
GitHub Environment secret, or public control-plane endpoint is needed by the
workflow. The Coordinator/PM operator performs the private UI steps below.

This procedure never authorizes a merge, production deployment or database
access, DNS, Bunny, Vercel, AWS resource, IAM, Security Group, or traffic
mutation. Production remains the reviewed AWS EC2/Coolify runtime with AWS
PostgreSQL. Vercel is disconnected legacy context and is never a rollback
target.

## Fixed staging scope

- Workflow: `.github/workflows/staging-ghcr.yml`
- Registry: `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web`
- Platform: `linux/arm64`
- Existing application: `dongphugia-web-staging`
- Public staging URL: `https://dongphugia-staging.47-131-92-97.sslip.io`
- Database: existing internal-only staging PostgreSQL with synthetic `STG-DEMO-*`
  data
- Concurrency: one global `dongphugia-staging-preview` workflow owner

The workflow is `workflow_dispatch` only. Dispatch requires an open PR number
and its exact 40-character head SHA. A push or pull-request event cannot deploy
or publish a staging candidate.

## Automated source and image gates

The workflow fails closed unless:

1. the supplied PR is open, targets `main`, belongs to the canonical repository,
   and still has the supplied head SHA;
2. every required protected-branch check is successful for that exact SHA;
3. `origin/main` resolves to a 40-character SHA and the rollback checkout is
   exactly that commit;
4. both images are built natively for `linux/arm64` with the job-scoped
   `GITHUB_TOKEN`, never with a PAT or provider credential;
5. each unique run-scoped tag is absent before push, the pushed digest is
   remotely pullable, and the source revision label is exact;
6. each image has non-empty registry SBOM/provenance evidence and Trivy
   HIGH/CRITICAL `0/0`;
7. the candidate passes the safe ephemeral build-database smoke. This is an
   image health check only, not a staging deployment or localhost preview.

The exact-main image is labeled `canonical-source-baseline`. It is a
workflow-built rollback artifact and is **not** claimed to be byte-identical to
the legacy image that happened to be running in staging. The operator must
record the actual current staging digest before changing the UI; that recorded
digest is the only one-time manual rollback target for the UI operation.

The raw Trivy report stays on the runner. The workflow uploads only the
deterministic sanitized summaries with aggregate counts and safe advisory,
package, installed-version, and fixed-version fields. No URLs, titles,
environment values, credentials, logs, or database data are copied into the
manifest or handoff.

## Generated artifacts

The candidate artifact contains:

- `candidate-source.json` — PR/head and required-check binding;
- `candidate-manifest.json` — candidate and exact-main immutable image refs,
  digests, source SHAs, platform, SBOM/provenance/Trivy gates, and the explicit
  `private-manual-gated` staging state;
- `operator-handoff.md` — the exact digest values and the UI-only procedure;
- sanitized candidate and rollback Trivy summaries.

The manifest intentionally records runtime acceptance as operator-pending. It
must not be edited to claim a deployment, running digest, database fingerprint,
route result, screenshot, or rollback that has not happened.

## Private Coolify UI procedure

Use the already approved private, authenticated Coolify UI path. Do not expose
the control plane publicly and do not configure a GitHub-hosted runner.

1. Open the existing staging application and confirm its public hostname is
   exactly `https://dongphugia-staging.47-131-92-97.sslip.io`. Stop on any
   application, domain, database, volume, network, or environment mismatch.
2. Confirm the app is running and healthy. Record the currently running image
   as `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:<64 hex>`. A mutable
   tag, missing digest, unhealthy app, or unknown current digest is a hard stop.
3. Change only the image reference to the candidate digest in
   `operator-handoff.md`. Coolify's native fields are the repository ending in
   `@sha256` and the raw 64-hex digest. Never create a `sha256-…` registry tag,
   use `latest`, or modify runtime values, domains, volumes, networks, database
   settings, or traffic. Keep auto-deploy disabled.
4. Deploy from the private UI once. Verify the running digest equals the exact
   candidate digest, the app is healthy, `GET /api/health` succeeds, and
   `GET /api/revision` reports the candidate SHA.
5. Verify `GET /api/staging-identity` and retain only its non-secret fingerprint
   and aggregate evidence: 46 tables, 3 synthetic products, 3 canonical
   synthetic products, and 0 sensitive rows. Never retain database names,
   hosts, ports, connection URLs, rows, or raw logs.
6. After the digest and isolation gates pass, run `node
   scripts/staging-preview/route-report.mjs` and `npm run test:staging-preview`
   with the public staging URL and candidate SHA. These are the only route,
   desktop, and mobile acceptance checks. Do not run a synthetic localhost
   preview.
7. If any mandatory check fails after the UI deploy begins, switch back once to
   the digest recorded in step 2 and verify health and running state. Preserve
   PostgreSQL and its volumes. Do not retry, reset, drop, seed, or migrate the
   database, and do not substitute the exact-main artifact for an unrecorded
   current digest.

## Evidence and closeout

The operator handoff must be updated only with sanitized evidence bound to the
PR, exact SHA, workflow run, candidate digest, recorded previous digest,
running digest, aggregate database-isolation result, route report,
desktop/mobile screenshots and traces, and UI deployment/rollback timestamps.

Never write credentials, environment values, connection URLs, raw logs,
database rows, PII, or unapproved Coolify identifiers into artifacts, comments,
or PR text. Report staging and source ownership explicitly as RELEASED when the
manual gate is complete or blocked. The workflow remains unconsumed until a
separate PM approval authorizes the private staging validation.
