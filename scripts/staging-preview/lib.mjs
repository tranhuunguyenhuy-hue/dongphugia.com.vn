import { createHash } from 'node:crypto'

export const STAGING_HOST = 'dongphugia-staging.47-131-92-97.sslip.io'
export const STAGING_URL = `https://${STAGING_HOST}`
export const IMAGE_NAME = 'ghcr.io/tranhuunguyenhuy-hue/dongphugia-web'

const SHA_PATTERN = /^[0-9a-f]{40}$/
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

export function assertSha(value, label = 'commit SHA') {
    if (!SHA_PATTERN.test(value ?? '')) {
        throw new Error(`${label} must be a lowercase 40-character SHA.`)
    }
    return value
}

export function assertDigest(value, label = 'image digest') {
    if (!DIGEST_PATTERN.test(value ?? '')) {
        throw new Error(`${label} must be an immutable sha256 digest.`)
    }
    return value
}

export function assertStagingUrl(value) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== STAGING_HOST || url.pathname !== '/') {
        throw new Error(`Staging URL must be exactly ${STAGING_URL}.`)
    }
    return STAGING_URL
}

export function digestToCoolifyTag(digest) {
    return assertDigest(digest).replace(':', '-')
}

export function coolifyImageDigest(imageName, imageTag) {
    if (imageName === IMAGE_NAME && /^sha256-[0-9a-f]{64}$/.test(imageTag ?? '')) {
        return imageTag.replace('-', ':')
    }

    if (imageName === `${IMAGE_NAME}@sha256` && /^[0-9a-f]{64}$/.test(imageTag ?? '')) {
        return `sha256:${imageTag}`
    }

    throw new Error('Coolify application is not pinned to an accepted immutable image digest.')
}

export function sha256(value) {
    return createHash('sha256').update(value).digest('hex')
}

export function claimRollback(state) {
    if (!state.mutationStarted) {
        return { required: false, state }
    }
    if (state.rollbackAttempted) {
        throw new Error('Rollback was already attempted; refusing a second attempt.')
    }
    return {
        required: true,
        state: { ...state, rollbackAttempted: true },
    }
}

export function requiredCheckContexts(rules) {
    const contexts = rules
        .filter((rule) => rule.type === 'required_status_checks')
        .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
        .map((check) => ({
            context: check.context,
            integrationId: check.integration_id ?? null,
        }))

    if (contexts.length === 0) {
        throw new Error('No required status checks are configured for the target branch.')
    }

    return contexts.sort((left, right) => left.context.localeCompare(right.context))
}

export function validateCandidate({
    repository,
    prNumber,
    expectedHeadSha,
    pullRequest,
    rules,
    checkRuns,
    statuses,
}) {
    assertSha(expectedHeadSha, 'Expected PR head SHA')

    if (pullRequest.number !== prNumber || pullRequest.state !== 'open') {
        throw new Error('The requested pull request is not open.')
    }
    if (pullRequest.base?.ref !== 'main') {
        throw new Error('The requested pull request does not target main.')
    }
    if (pullRequest.head?.repo?.full_name !== repository) {
        throw new Error('Fork pull requests are not eligible for staging deployment.')
    }
    if (pullRequest.head?.sha !== expectedHeadSha) {
        throw new Error('Pull request head drift detected.')
    }

    const required = requiredCheckContexts(rules)
    const successful = []

    for (const requirement of required) {
        const runs = checkRuns
            .filter((candidate) => (
                candidate.name === requirement.context
                && candidate.head_sha === expectedHeadSha
                && (
                    requirement.integrationId === null
                    || candidate.app?.id === requirement.integrationId
                )
            ))
            .map((candidate) => ({
                accepted: candidate.status === 'completed' && candidate.conclusion === 'success',
                timestamp: Date.parse(candidate.completed_at ?? candidate.started_at ?? 0),
            }))
        const commitStatuses = statuses
            .filter((candidate) => (
                candidate.context === requirement.context
                && candidate.sha === expectedHeadSha
            ))
            .map((candidate) => ({
                accepted: candidate.state === 'success',
                timestamp: Date.parse(candidate.updated_at ?? candidate.created_at ?? 0),
            }))
        const latest = [...runs, ...commitStatuses]
            .sort((left, right) => right.timestamp - left.timestamp)[0]

        if (!latest?.accepted) {
            throw new Error(`Required check ${requirement.context} is not successful for the exact PR head.`)
        }
        successful.push(requirement.context)
    }

    return {
        schemaVersion: 1,
        repository,
        prNumber,
        headSha: expectedHeadSha,
        baseRef: 'main',
        headRef: pullRequest.head.ref,
        requiredChecks: successful,
        pullRequestUrl: pullRequest.html_url,
    }
}

export function stableJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`
}
