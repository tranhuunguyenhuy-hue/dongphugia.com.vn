#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { assertDigest, assertSha, assertStagingUrl, STAGING_URL } from './lib.mjs'

const outputPath = process.env.OPERATOR_HANDOFF_PATH ?? 'artifacts/staging-preview/operator-handoff.md'
const repository = process.env.GITHUB_REPOSITORY
const prNumber = Number.parseInt(process.env.PREVIEW_PR_NUMBER ?? '', 10)
const candidateSha = assertSha(process.env.CANDIDATE_SHA, 'Candidate SHA')
const candidateDigest = assertDigest(process.env.CANDIDATE_DIGEST, 'Candidate digest')
const rollbackSha = assertSha(process.env.ROLLBACK_SHA, 'Rollback SHA')
const rollbackDigest = assertDigest(process.env.ROLLBACK_DIGEST, 'Rollback digest')
const stagingUrl = assertStagingUrl(process.env.STAGING_SITE_URL ?? STAGING_URL)

if (!repository || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error('Repository and positive PR number are required.')
}

const imageName = 'ghcr.io/tranhuunguyenhuy-hue/dongphugia-web'
const candidateImage = `${imageName}@${candidateDigest}`
const rollbackImage = `${imageName}@${rollbackDigest}`
const runUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : 'workflow-run-url-recorded-in-artifact-metadata'

const handoff = `# Private staging operator handoff

This handoff is generated from the exact source-gated workflow. The GitHub-hosted
workflow stops before any Coolify API or deployment call. Do not add a token,
environment variable, public control-plane URL, or GitHub Environment secret.

## Verified source and images

- Repository: ${repository}
- Pull request: #${prNumber}
- Candidate source: \`${candidateSha}\`
- Candidate image: \`${candidateImage}\`
- Exact-main rollback image: \`${rollbackImage}\`
- Exact-main source: \`${rollbackSha}\`
- Platform: \`linux/arm64\`
- SBOM/provenance: verified for both images
- Trivy HIGH/CRITICAL: \`0/0\` for both images
- Workflow run: ${runUrl}

The exact-main image is a canonical-source rollback artifact and is not claimed
to be byte-identical to any legacy staging image. Before changing staging, the
operator must record the currently running immutable staging digest separately;
that recorded digest is the only one-time manual rollback target for this UI
operation.

## Private Coolify UI procedure

1. Open the existing Coolify UI through the already approved private operator
   path. Confirm the resource is the existing staging application and the
   public hostname is exactly \`${stagingUrl}\`.
2. Record the current running image as an immutable digest (\`repo@sha256:<64 hex>\`).
   Stop if the app is not running and healthy, the image is mutable, the domain
   differs, or the current digest cannot be recorded.
3. Change only the existing image reference to the candidate digest above. In
   Coolify's native fields this is the repository ending in \`@sha256\` plus the
   raw 64-hex digest; do not create a \`sha256-…\` tag, use \`latest\`, or alter
   environment values, domains, volumes, networks, database settings, or
   traffic. Keep auto-deploy disabled.
4. Deploy from the private UI once. Verify the running digest equals the exact
   candidate digest, the app is healthy, and the public \`/api/health\` response
   succeeds. Verify \`/api/revision\` reports \`${candidateSha}\`.
5. Verify staging-only database isolation through \`/api/staging-identity\`:
   accept only the non-secret fingerprint and aggregate evidence (46 tables,
   3 synthetic products, 3 canonical synthetic products, 0 sensitive rows).
   Never copy database names, hosts, ports, URLs, rows, or logs.
6. After the digest and isolation checks pass, run the route report and the
   desktop/mobile Playwright acceptance against the public staging URL. This is
   the only browser acceptance path; do not run a synthetic localhost preview.
7. If any mandatory check fails after the UI deploy begins, switch back once to
   the digest recorded in step 2 and verify health/running state. Preserve the
   staging database and volumes. Do not retry, reset, drop, seed, or migrate the
   database, and do not use the exact-main artifact as an unrecorded substitute.

## Closeout evidence

Attach the candidate manifest, the recorded current/rollback digest, running
digest, aggregate database-isolation result, route report, desktop/mobile
screenshots and traces, and the UI deployment/rollback timestamps. Keep this
handoff free of credentials, environment values, connection URLs, raw logs,
database rows, PII, and Coolify identifiers not already approved for disclosure.
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, handoff, { mode: 0o600 })
console.log(`Private staging operator handoff written for PR #${prNumber} at ${candidateSha}.`)
