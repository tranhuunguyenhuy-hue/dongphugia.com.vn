#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
    STAGING_HOST,
    STAGING_URL,
    assertDigest,
    assertSha,
    assertStagingUrl,
    assertPublicHealth,
    assertRunningHealthyStatus,
    claimRollback,
    coolifyImageDigest,
    coolifyDigestPayload,
    imageReferenceFingerprint,
    selectRollbackTarget,
    stableJson,
} from './lib.mjs'

const command = process.argv[2]
const apiUrl = process.env.COOLIFY_API_URL
const apiToken = process.env.COOLIFY_API_TOKEN
const applicationUuid = process.env.COOLIFY_STAGING_APPLICATION_UUID
const candidateDigest = process.env.CANDIDATE_DIGEST
const candidateSha = process.env.CANDIDATE_SHA
const rollbackDigest = process.env.ROLLBACK_DIGEST
const rollbackSha = process.env.ROLLBACK_SHA
const stagingUrl = assertStagingUrl(process.env.STAGING_SITE_URL ?? STAGING_URL)
const statePath = process.env.DEPLOYMENT_STATE_PATH ?? 'artifacts/staging-preview/deployment-state.json'
const timeoutMs = 15 * 60 * 1000

if (!['preflight', 'deploy', 'rollback'].includes(command)) {
    throw new Error('Usage: coolify.mjs <preflight|deploy|rollback>.')
}
if (!apiUrl || !apiToken || !applicationUuid) {
    throw new Error('Coolify control-plane URL, application UUID, and staging-scoped token are required.')
}

const parsedApiUrl = new URL(apiUrl)
if (parsedApiUrl.protocol !== 'https:' || parsedApiUrl.pathname !== '/') {
    throw new Error('COOLIFY_API_URL must be an HTTPS control-plane origin with no path.')
}

function apiPath(path) {
    return new URL(`/api/v1${path}`, parsedApiUrl).toString()
}

async function coolify(path, options = {}) {
    const response = await fetch(apiPath(path), {
        ...options,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiToken}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
        throw new Error(`Coolify API request failed (${response.status}) for ${path.split('?')[0]}.`)
    }
    return response.json()
}

function validateApplication(application) {
    const hosts = String(application.fqdn ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => new URL(value).hostname)

    if (application.uuid !== applicationUuid) {
        throw new Error('Coolify returned a different application UUID.')
    }
    if (application.name !== 'dongphugia-web-staging') {
        throw new Error('Coolify application name is not the approved staging application.')
    }
    if (hosts.length === 0 || hosts.some((host) => host !== STAGING_HOST)) {
        throw new Error('Coolify application domains are not isolated to the approved staging hostname.')
    }
    if (application.build_pack !== 'dockerimage') {
        throw new Error('Coolify staging application is not a prebuilt Docker image resource.')
    }
    if (application.is_auto_deploy_enabled === true) {
        throw new Error('Coolify staging auto-deploy must be disabled.')
    }

    let configuredDigest = null
    try {
        configuredDigest = coolifyImageDigest(
            application.docker_registry_image_name,
            application.docker_registry_image_tag,
        )
    } catch {
        // The legacy staging reference is recorded only as a fingerprint. It
        // is never accepted as a rollback target.
    }

    return {
        imageFingerprint: imageReferenceFingerprint(
            application.docker_registry_image_name,
            application.docker_registry_image_tag,
        ),
        configuredDigest,
    }
}

async function writeState(state) {
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, stableJson(state), { mode: 0o600 })
}

async function readState() {
    return JSON.parse(await readFile(statePath, 'utf8'))
}

async function queueDeployment() {
    const response = await coolify('/deploy', {
        method: 'POST',
        body: JSON.stringify({ uuid: applicationUuid, force: false }),
    })
    const deployment = response.deployments?.find((item) => item.resource_uuid === applicationUuid)
    if (!deployment?.deployment_uuid) {
        throw new Error('Coolify did not return a deployment UUID for the staging application.')
    }
    return deployment.deployment_uuid
}

async function waitForDeployment(deploymentUuid) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        const deployment = await coolify(`/deployments/${encodeURIComponent(deploymentUuid)}`)
        const status = String(deployment.status ?? '').toLowerCase()
        if (['finished', 'success', 'successful'].includes(status)) {
            return status
        }
        if (['failed', 'cancelled', 'canceled', 'error'].some((terminal) => status.includes(terminal))) {
            throw new Error(`Coolify deployment reached terminal failure status ${status}.`)
        }
        await new Promise((resolve) => setTimeout(resolve, 10_000))
    }
    throw new Error('Coolify deployment did not reach a successful terminal state before timeout.')
}

async function patchDigest(digest) {
    await coolify(`/applications/${encodeURIComponent(applicationUuid)}`, {
        method: 'PATCH',
        body: JSON.stringify({
            ...coolifyDigestPayload(digest),
        }),
    })
}

async function fetchPublicJson(path) {
    const response = await fetch(`${stagingUrl}${path}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
        throw new Error(`Staging acceptance endpoint ${path} returned ${response.status}.`)
    }
    return response.json()
}

if (command === 'preflight') {
    const target = selectRollbackTarget({ rollbackDigest, rollbackSha })
    const application = await coolify(`/applications/${encodeURIComponent(applicationUuid)}`)
    const identity = validateApplication(application)
    const previousStatus = assertRunningHealthyStatus(application.status)
    const publicHealth = await fetchPublicJson('/api/health')
    assertPublicHealth(publicHealth)
    const state = {
        schemaVersion: 1,
        applicationUuid,
        stagingUrl,
        legacyImageFingerprint: identity.imageFingerprint,
        previousDigest: identity.configuredDigest,
        rollbackDigest: target.digest,
        rollbackSha: target.sha,
        previousStatus,
        previousPublicHealth: 'ok',
        mutationStarted: false,
        rollbackAttempted: false,
    }
    await writeState(state)
    console.log('Coolify staging preflight accepted a running healthy application and public health.')
}

if (command === 'deploy') {
    const digest = assertDigest(candidateDigest, 'Candidate digest')
    const sha = assertSha(candidateSha, 'Candidate SHA')
    const state = await readState()
    const before = await coolify(`/applications/${encodeURIComponent(applicationUuid)}`)
    if (validateApplication(before).imageFingerprint !== state.legacyImageFingerprint || state.mutationStarted) {
        throw new Error('Coolify staging state drifted after preflight.')
    }
    assertRunningHealthyStatus(before.status)
    const preDeployHealth = await fetchPublicJson('/api/health')
    assertPublicHealth(preDeployHealth)

    state.mutationStarted = true
    state.candidateDigest = digest
    state.candidateSha = sha
    await writeState(state)
    await patchDigest(digest)
    const deploymentUuid = await queueDeployment()
    state.candidateDeploymentUuid = deploymentUuid
    await writeState(state)
    state.candidateDeploymentStatus = await waitForDeployment(deploymentUuid)

    const after = await coolify(`/applications/${encodeURIComponent(applicationUuid)}`)
    const configuredRunningDigest = validateApplication(after).configuredDigest
    if (configuredRunningDigest !== digest || assertRunningHealthyStatus(after.status) !== 'running:healthy') {
        throw new Error('Coolify did not report the exact candidate digest as running.')
    }

    const revision = await fetchPublicJson('/api/revision')
    if (revision.sourceRevision !== sha || revision.stagingPreview !== true) {
        throw new Error('Public runtime revision does not match the exact candidate SHA.')
    }
    const identity = await fetchPublicJson('/api/staging-identity')
    if (identity.ok !== true || identity.dataset !== 'STG-DEMO' || !/^[0-9a-f]{64}$/.test(identity.databaseFingerprintSha256 ?? '')) {
        throw new Error('Staging database isolation proof failed.')
    }

    state.runningDigest = configuredRunningDigest
    state.runtimeRevision = revision.sourceRevision
    state.databaseFingerprintSha256 = identity.databaseFingerprintSha256
    state.databaseIsolation = 'passed'
    await writeState(state)
    console.log(`Coolify deployment ${deploymentUuid} accepted exact digest ${configuredRunningDigest}.`)
    console.log(`Public runtime revision and staging database isolation proof accepted for ${sha}.`)
}

if (command === 'rollback') {
    const selection = claimRollback(await readState())
    if (!selection.required) {
        console.log('No Coolify mutation started; rollback is not required.')
        process.exit(0)
    }
    const state = selection.state
    const target = selectRollbackTarget(state)
    await writeState(state)
    await patchDigest(target.digest)
    const rollbackDeploymentUuid = await queueDeployment()
    state.rollbackDeploymentUuid = rollbackDeploymentUuid
    await writeState(state)
    state.rollbackDeploymentStatus = await waitForDeployment(rollbackDeploymentUuid)

    const application = await coolify(`/applications/${encodeURIComponent(applicationUuid)}`)
    const runningDigest = validateApplication(application).configuredDigest
    if (runningDigest !== target.digest || assertRunningHealthyStatus(application.status) !== 'running:healthy') {
        throw new Error('Rollback verification did not restore the workflow-built rollback digest.')
    }
    const health = await fetchPublicJson('/api/health')
    assertPublicHealth(health)
    const revision = await fetchPublicJson('/api/revision')
    if (revision.sourceRevision !== target.sha || revision.stagingPreview !== true) {
        throw new Error('Rollback runtime revision does not match the exact main rollback SHA.')
    }

    state.rollbackVerified = true
    state.runningDigest = target.digest
    state.rollbackRuntimeRevision = revision.sourceRevision
    await writeState(state)
    console.log(`One-time rollback ${rollbackDeploymentUuid} restored the workflow-built main image and passed health verification.`)
}
