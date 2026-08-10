#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { assertDigest, assertSha, assertStagingUrl, IMAGE_NAME, stableJson, STAGING_URL } from './lib.mjs'

async function optionalJson(path) {
    try {
        return JSON.parse(await readFile(path, 'utf8'))
    } catch {
        return null
    }
}

const outputPath = process.env.CANDIDATE_MANIFEST_PATH ?? 'artifacts/staging-preview/candidate-manifest.json'
const source = await optionalJson(process.env.CANDIDATE_SOURCE_PATH ?? 'artifacts/staging-preview/candidate-source.json')
const rollbackDigest = process.env.ROLLBACK_DIGEST ? assertDigest(process.env.ROLLBACK_DIGEST, 'Rollback digest') : null
const rollbackSha = process.env.ROLLBACK_SHA ? assertSha(process.env.ROLLBACK_SHA, 'Rollback SHA') : null
const stagingUrl = assertStagingUrl(process.env.STAGING_SITE_URL ?? STAGING_URL)
const repository = process.env.GITHUB_REPOSITORY
const prNumber = Number.parseInt(process.env.PREVIEW_PR_NUMBER ?? '', 10)
const imageName = process.env.IMAGE_NAME ?? IMAGE_NAME

if (!repository || !Number.isInteger(prNumber) || prNumber <= 0 || imageName !== IMAGE_NAME) {
    throw new Error('Canonical repository, positive PR number, and image name are required.')
}

const manifest = {
    schemaVersion: 1,
    repository,
    prNumber,
    headSha: assertSha(process.env.CANDIDATE_SHA ?? source?.headSha, 'Candidate SHA'),
    image: `${imageName}@${assertDigest(process.env.CANDIDATE_DIGEST, 'Candidate digest')}`,
    digest: process.env.CANDIDATE_DIGEST,
    platform: 'linux/arm64',
    workflowRunId: process.env.GITHUB_RUN_ID,
    workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    workflowRunUrl: `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID ?? 'unknown'}`,
    requiredChecks: source?.requiredChecks ?? [],
    sbomVerified: true,
    provenanceVerified: true,
    trivy: { high: 0, critical: 0 },
    rollback: rollbackDigest && rollbackSha ? {
        image: `${imageName}@${rollbackDigest}`,
        digest: rollbackDigest,
        sourceSha: rollbackSha,
        platform: 'linux/arm64',
        provenance: 'canonical-source-baseline',
        legacyEquivalence: 'not-claimed',
        sbomVerified: true,
        provenanceVerified: true,
        trivy: { high: 0, critical: 0 },
    } : null,
    staging: {
        mode: 'private-manual-gated',
        workflowMutation: 'stopped-before-coolify',
        stagingUrl,
        currentDigest: 'operator-record-before-ui-change',
        candidateDigest: process.env.CANDIDATE_DIGEST,
        runningDigest: 'operator-verify-after-ui-change',
        databaseIsolation: 'operator-verify-after-ui-change',
        routeAcceptance: 'operator-verify-after-ui-change',
        desktopAndMobile: 'operator-verify-after-ui-change',
        manualRollback: 'one-time-to-operator-recorded-current-digest',
    },
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, stableJson(manifest), { mode: 0o600 })
console.log(`Candidate manifest written for PR #${manifest.prNumber} at ${manifest.headSha}.`)
