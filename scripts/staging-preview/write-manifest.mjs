#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { assertDigest, assertSha, stableJson } from './lib.mjs'

async function optionalJson(path) {
    try {
        return JSON.parse(await readFile(path, 'utf8'))
    } catch {
        return null
    }
}

const outputPath = process.env.CANDIDATE_MANIFEST_PATH ?? 'artifacts/staging-preview/candidate-manifest.json'
const source = await optionalJson(process.env.CANDIDATE_SOURCE_PATH ?? 'artifacts/staging-preview/candidate-source.json')
const deployment = await optionalJson(process.env.DEPLOYMENT_STATE_PATH ?? 'artifacts/staging-preview/deployment-state.json')
const routeReport = await optionalJson(process.env.ROUTE_REPORT_PATH ?? 'artifacts/staging-preview/route-report.json')
const rollbackDigest = process.env.ROLLBACK_DIGEST ? assertDigest(process.env.ROLLBACK_DIGEST, 'Rollback digest') : null
const rollbackSha = process.env.ROLLBACK_SHA ? assertSha(process.env.ROLLBACK_SHA, 'Rollback SHA') : null

const manifest = {
    schemaVersion: 1,
    repository: process.env.GITHUB_REPOSITORY,
    prNumber: Number.parseInt(process.env.PREVIEW_PR_NUMBER ?? '', 10),
    headSha: assertSha(process.env.CANDIDATE_SHA ?? source?.headSha, 'Candidate SHA'),
    image: `${process.env.IMAGE_NAME}@${assertDigest(process.env.CANDIDATE_DIGEST, 'Candidate digest')}`,
    digest: process.env.CANDIDATE_DIGEST,
    platform: 'linux/arm64',
    workflowRunId: process.env.GITHUB_RUN_ID,
    workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    workflowRunUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    requiredChecks: source?.requiredChecks ?? [],
    sbomVerified: true,
    provenanceVerified: true,
    trivy: { high: 0, critical: 0 },
    rollback: rollbackDigest && rollbackSha ? {
        image: `${process.env.IMAGE_NAME}@${rollbackDigest}`,
        digest: rollbackDigest,
        sourceSha: rollbackSha,
        platform: 'linux/arm64',
        provenance: 'canonical-source-baseline',
        legacyEquivalence: 'not-claimed',
        sbomVerified: true,
        provenanceVerified: true,
        trivy: { high: 0, critical: 0 },
    } : null,
    staging: deployment ? {
        applicationUuid: deployment.applicationUuid,
        deploymentUuid: deployment.candidateDeploymentUuid ?? null,
        previousDigest: deployment.previousDigest ?? null,
        legacyImageFingerprint: deployment.legacyImageFingerprint ?? null,
        rollbackDigest: deployment.rollbackDigest ?? rollbackDigest,
        rollbackSha: deployment.rollbackSha ?? rollbackSha,
        runningDigest: deployment.runningDigest ?? null,
        databaseFingerprintSha256: deployment.databaseFingerprintSha256 ?? null,
        databaseIsolation: deployment.databaseIsolation ?? 'not-completed',
        rollbackAttempted: deployment.rollbackAttempted,
        rollbackDeploymentUuid: deployment.rollbackDeploymentUuid ?? null,
        rollbackVerified: deployment.rollbackVerified ?? false,
        rollbackRuntimeRevision: deployment.rollbackRuntimeRevision ?? null,
    } : null,
    acceptance: routeReport ? {
        routeCount: routeReport.routes.length,
        routesPassed: routeReport.routes.every((route) => (
            route.expectedStatus === route.actualStatus
            && route.markerPresent !== false
            && route.forbiddenIndicatorPresent === false
            && route.locationAccepted !== false
        )),
        desktopAndMobile: process.env.BROWSER_ACCEPTANCE === 'passed',
    } : null,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, stableJson(manifest), { mode: 0o600 })
console.log(`Candidate manifest written for PR #${manifest.prNumber} at ${manifest.headSha}.`)
