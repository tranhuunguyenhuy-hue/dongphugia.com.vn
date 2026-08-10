# Staging application deploy change set — private UI only

Status: operator checklist for the LEO-495 manual staging gate. The GitHub
workflow publishes and verifies immutable image artifacts only; it does not
call Coolify or deploy staging.

This change set does not authorize production DNS, traffic, data migration,
AWS, Security Group, IAM, Vercel, Bunny, or database mutation. Production is
the reviewed AWS EC2/Coolify runtime with AWS PostgreSQL. Vercel is disconnected
legacy context and is never a rollback target.

## Candidate package supplied by the workflow

Copy these values from the matching `operator-handoff.md` and
`candidate-manifest.json`; do not invent or substitute values:

| Field | Operator-recorded value |
| --- | --- |
| PR / exact source SHA | `#<open-pr> / <40-hex SHA>` |
| Candidate image | `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:<64 hex>` |
| Exact-main image | `ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:<64 hex>` |
| Platform | `linux/arm64` |
| SBOM / provenance | verified for both images |
| Trivy HIGH / CRITICAL | `0 / 0` for both images |

The exact-main image is labeled `canonical-source-baseline` and is not claimed
to be byte-identical to the legacy staging image. Before any UI change, record
the actual current staging digest separately. That recorded digest—not a
mutable tag and not an unproven legacy reference—is the one-time manual
rollback target for this change set.

## Existing staging foundation

- Existing Coolify staging application only: `dongphugia-web-staging`
- Public staging URL: `https://dongphugia-staging.47-131-92-97.sslip.io`
- Container port: `3000` behind the existing HTTPS proxy
- PostgreSQL: existing internal-only staging service; no public database port
- Platform: `linux/arm64`

Do not create a second application, publish a direct app or database port,
change the internal network, alter runtime values, or change domains/traffic.

## Private UI sequence

1. Open the existing Coolify UI through the approved private operator path.
2. Confirm the application name and staging hostname, then confirm the app is
   running and healthy.
3. Record its current immutable `repo@sha256:<64 hex>` image digest before any
   change. If it is missing, mutable, unhealthy, or ambiguous, stop.
4. Change only the image to the exact candidate digest. Coolify's native image
   fields are the repository ending in `@sha256` and the raw 64-hex digest;
   `sha256-<digest>` is never a valid replacement tag. Keep auto-deploy off.
5. Deploy once from the UI and verify running digest, health, `/api/health`,
   and `/api/revision` against the candidate SHA.
6. Verify `/api/staging-identity` using only its SHA-256 fingerprint and safe
   aggregates: 46 tables, 3 synthetic products, 3 canonical synthetic
   products, and 0 sensitive rows. Never copy connection values or rows.
7. Run the public route report plus desktop/mobile Playwright acceptance after
   the manual deploy. Do not run a synthetic localhost preview.
8. If any mandatory check fails after mutation begins, switch back once to the
   digest recorded in step 3, verify health, and preserve PostgreSQL and its
   volumes. Do not reset, drop, seed, migrate, or retry.

## Evidence ledger

Retain only sanitized evidence bound to the PR, exact source SHA, workflow run,
candidate digest, recorded previous digest, running digest, aggregate database
fingerprint result, route report, screenshots/traces, and deployment/rollback
timestamps. Keep credentials, environment values, connection URLs, raw logs,
database rows, PII, and unapproved control-plane identifiers out of the ledger.

The workflow's manifest remains `private-manual-gated` until the operator has
completed this procedure and PM has reviewed the evidence. A blocked or failed
manual gate leaves staging unchanged or restored to the recorded digest and
requires a fresh approval; it never authorizes production action.
