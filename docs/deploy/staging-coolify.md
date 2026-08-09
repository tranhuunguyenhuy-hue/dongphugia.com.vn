# Exact-commit Coolify staging preview

This runbook defines the LEO-495 preview path for the existing staging
application only:

`open PR head → required checks → native ARM64 digest → protected manual gate →
Coolify staging deploy → runtime/dataset/browser evidence`.

It does not authorize a merge, production deployment, production database
access, DNS, Bunny, Vercel, AWS resource, IAM, Security Group, or traffic
mutation. Production remains the reviewed AWS EC2/Coolify runtime with AWS
PostgreSQL. Vercel is disconnected legacy context and is never a staging or
production rollback target.

## Fixed staging scope

- Workflow: `.github/workflows/staging-ghcr.yml`
- Registry: `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web`
- Platform: `linux/arm64`
- Existing resource name: `dongphugia-web-staging`
- URL: `https://dongphugia-staging.47-131-92-97.sslip.io`
- Database: existing internal-only staging PostgreSQL with synthetic
  `STG-DEMO-*` data
- Deployment concurrency: one global `dongphugia-staging-preview` owner

The workflow is `workflow_dispatch` only. It never deploys on push. Dispatch
requires an open PR number and its exact 40-character head SHA.

## Source and image gates

Before building, the workflow reads the applicable `main` ruleset and requires:

1. the PR is open, targets `main`, and belongs to the canonical repository;
2. the supplied SHA is exactly the current PR head;
3. every required status check is successful for that exact SHA;
4. checkout resolves to that SHA with no branch-name fallback.

The image gate then requires one native `linux/arm64` manifest, an exact source
revision label, registry digest verification, non-empty SBOM and provenance
attestations, Trivy HIGH/CRITICAL `0/0`, and a synthetic ephemeral-database
runtime smoke. The unique SHA tag is only a build lookup; deployment and
acceptance use `repo@sha256:<digest>`. `latest` is forbidden.

The raw Trivy JSON remains runner-local. Before enforcing the zero gate, the
workflow always writes and uploads a deterministic sanitized summary containing
the candidate SHA/digest, scan status, aggregate HIGH/CRITICAL counts, and only
component, advisory, package, installed-version, and fixed-version fields.
URLs, titles, metadata, environment values, logs, and database data are never
copied into evidence. Missing or invalid evidence fails closed. The separate
`npm audit --omit=dev` check covers application dependencies; image Trivy also
covers OS/base-layer findings.

## Protected GitHub environment

The deploy job uses the GitHub environment `staging`. A PM reviewer gate and
disabled administrator bypass are required before any runner receives the
staging credential.

Non-secret environment variables:

| Name | Contract |
| --- | --- |
| `COOLIFY_API_URL` | HTTPS Coolify control-plane origin reachable by the GitHub-hosted runner |
| `COOLIFY_STAGING_APPLICATION_UUID` | Exact UUID from a fresh read-only inventory of `dongphugia-web-staging` |
| `STAGING_SITE_URL` | Exact staging URL above (workflow also pins this value) |
| `STAGING_BUNNY_CDN_HOSTNAME` | `cdn.dongphugia.com.vn` compatibility hostname |

Protected environment secret name:

| Name | Contract |
| --- | --- |
| `COOLIFY_API_TOKEN` | Staging-scoped token entered by the human directly in GitHub UI |

Never paste, read back, print, log, or transmit the token value. Missing
reviewer protection, URL, application UUID, or token is a stop condition, not a
reason to bypass the gate. The historical localhost tunnel at
`127.0.0.1:18000` is useful for human read-only inventory but is not reachable
from a GitHub-hosted runner and must not be configured as `COOLIFY_API_URL`.

## Exact-digest deployment

After environment approval, the deploy client:

1. reads the existing application through the official Coolify API;
2. rejects a different UUID/name/domain, non-Docker-image resource, enabled
   auto-deploy, production hostname, or mutable previous tag;
3. requires the current application status to be exactly `running:healthy` and
   the public staging `/api/health` endpoint to return `{ "ok": true }` before
   accepting the previous digest as a rollback target;
4. records the previous immutable digest and application state;
5. patches only Coolify's native immutable image fields:
   `docker_registry_image_name: repo@sha256` and
   `docker_registry_image_tag: <64 hex digest>`. This resolves to
   `repo@sha256:<digest>`; it is not a pushed or invented registry tag. Auto-
   deploy remains disabled;
6. queues one deployment and waits for a successful terminal state;
7. re-reads the application and requires the exact candidate digest in
   `running:healthy` state;
8. requires `/api/revision` to report the accepted PR SHA and
   `/api/staging-identity` to pass.

No runtime environment value, database row, raw Coolify response, or deployment
log is copied into workflow output or artifacts.

## Database isolation proof

`/api/staging-identity` exists only when both the staging build marker and exact
staging site URL are present. It performs read-only aggregates and returns:

- a SHA-256 fingerprint of database/server identity, never the underlying
  database name, address, port, or connection URL;
- expected public table count;
- `STG-DEMO-*` and canonical-category aggregate counts;
- one combined sensitive-table row count.

Acceptance requires `46` tables, `3` synthetic products, all `3` in canonical
staging categories, and `0` rows across admin, session, customer, order, and
quote tables. Any mismatch fails closed. The workflow never writes, resets,
drops, seeds, or migrates the staging database.

## Browser and route evidence

Mandatory public acceptance covers HTTPS health, home, category, synthetic
product, search, robots, sitemap, admin login, and unauthenticated admin
redirect. Desktop `1440×1000` and mobile `390×844` Playwright runs require
`STG-DEMO` markers, the exact candidate revision, the database-isolation proof,
and no production canonical URL, Vercel, or Supabase indicator.

The 14-day evidence artifact contains:

- `candidate-source.json` bound to PR/SHA/required checks;
- `candidate-manifest.json` bound to workflow run, digest, SBOM, provenance,
  Trivy, deployment, previous/running/rollback digest, and DB fingerprint;
- `route-report.json`;
- desktop/mobile screenshots, traces, and HTML report.

## One-time rollback

If deployment or any mandatory post-deploy gate fails after mutation begins,
the workflow claims the rollback attempt before calling Coolify, restores the
recorded previous digest once, waits for a successful deployment, and verifies
running state plus `/api/health`. A second attempt is rejected. PostgreSQL and
its volumes are preserved.

If rollback verification fails, staging is considered unavailable and requires
operator action. Do not retry blindly, change AWS ingress, expose Coolify, or
use Vercel. Source rollback is limited to closing or reverting the unmerged PR;
it has no production effect.
