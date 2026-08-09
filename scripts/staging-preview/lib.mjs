import { createHash } from 'node:crypto'

export const STAGING_HOST = 'dongphugia-staging.47-131-92-97.sslip.io'
export const STAGING_URL = `https://${STAGING_HOST}`
export const IMAGE_NAME = 'ghcr.io/tranhuunguyenhuy-hue/dongphugia-web'

const SHA_PATTERN = /^[0-9a-f]{40}$/
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const TRIVY_SAFE_VALUE_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:+/~<>*,-]{0,255}$/

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

export function coolifyImageDigest(imageName, imageTag) {
    if (imageName === `${IMAGE_NAME}@sha256` && /^[0-9a-f]{64}$/.test(imageTag ?? '')) {
        return `sha256:${imageTag}`
    }

    throw new Error('Coolify application is not pinned to an accepted immutable image digest.')
}

/**
 * Coolify stores a digest image as two fields: the image name ends with the
 * `@sha256` marker and the tag field contains the raw 64-character digest.
 * This is the representation produced by Coolify when it parses an
 * `image@sha256:<digest>` reference. It is not a registry tag and must never
 * be replaced with a mutable tag or an invented `sha256-...` tag.
 */
export function coolifyDigestPayload(digest) {
    const normalizedDigest = assertDigest(digest)
    return {
        docker_registry_image_name: `${IMAGE_NAME}@sha256`,
        docker_registry_image_tag: normalizedDigest.slice('sha256:'.length),
        is_auto_deploy_enabled: false,
    }
}

export function assertRunningHealthyStatus(status) {
    if (String(status ?? '').toLowerCase() !== 'running:healthy') {
        throw new Error('Coolify staging application must be running and healthy before deployment.')
    }
    return 'running:healthy'
}

export function assertPublicHealth(health) {
    if (health?.ok !== true) {
        throw new Error('Public staging health endpoint did not report success before deployment.')
    }
    return true
}

export function sha256(value) {
    return createHash('sha256').update(value).digest('hex')
}

function trivySummaryBase(candidateSha, candidateDigest) {
    return {
        schemaVersion: 1,
        candidateSha: SHA_PATTERN.test(candidateSha ?? '') ? candidateSha : null,
        candidateDigest: DIGEST_PATTERN.test(candidateDigest ?? '') ? candidateDigest : null,
    }
}

function safeTrivyValue(value) {
    return typeof value === 'string'
        && !value.includes('://')
        && !/(?:DATABASE_URL|DIRECT_URL|COOLIFY_|GITHUB_TOKEN|API_TOKEN|SECRET|PASSWORD)/i.test(value)
        && TRIVY_SAFE_VALUE_PATTERN.test(value)
        ? value
        : null
}

function invalidTrivySummary(base, errorCode) {
    return {
        ...base,
        scanStatus: 'invalid',
        errorCode,
        counts: { high: null, critical: null },
        findings: [],
    }
}

/**
 * Reduce Trivy's raw JSON to deterministic, non-sensitive evidence. Never
 * copy artifact names, URLs, titles, metadata, logs, or arbitrary fields.
 */
export function sanitizeTrivyReport(report, { candidateSha, candidateDigest } = {}) {
    const base = trivySummaryBase(candidateSha, candidateDigest)
    if (!base.candidateSha || !base.candidateDigest) {
        return invalidTrivySummary(base, 'invalid-candidate-identity')
    }
    if (!report || !Array.isArray(report.Results)) {
        return {
            ...base,
            scanStatus: 'unavailable',
            errorCode: 'trivy-report-unavailable',
            counts: { high: null, critical: null },
            findings: [],
        }
    }

    const findings = []
    for (const result of report.Results) {
        if (!result || typeof result !== 'object') {
            return invalidTrivySummary(base, 'unsafe-finding-shape')
        }
        const vulnerabilities = result.Vulnerabilities ?? []
        if (!Array.isArray(vulnerabilities)) {
            return invalidTrivySummary(base, 'unsafe-finding-shape')
        }
        const component = result.Class === 'os-pkgs'
            ? 'os'
            : result.Class === 'lang-pkgs'
                ? 'app'
                : 'other'

        for (const vulnerability of vulnerabilities) {
            if (!vulnerability || typeof vulnerability !== 'object') {
                return invalidTrivySummary(base, 'unsafe-finding-shape')
            }
            const severity = vulnerability.Severity
            if (severity !== 'HIGH' && severity !== 'CRITICAL') continue

            const advisory = safeTrivyValue(vulnerability.VulnerabilityID)
            const packageName = safeTrivyValue(vulnerability.PkgName)
            const installedVersion = safeTrivyValue(vulnerability.InstalledVersion)
            const fixedVersion = vulnerability.FixedVersion == null || vulnerability.FixedVersion === ''
                ? null
                : safeTrivyValue(vulnerability.FixedVersion)
            if (!advisory || !packageName || !installedVersion || (vulnerability.FixedVersion && !fixedVersion)) {
                return invalidTrivySummary(base, 'unsafe-finding-field')
            }
            findings.push({
                severity,
                component,
                advisory,
                package: packageName,
                installedVersion,
                fixedVersion,
            })
        }
    }

    findings.sort((left, right) => {
        const leftKey = `${left.severity}|${left.component}|${left.advisory}|${left.package}|${left.installedVersion}|${left.fixedVersion ?? ''}`
        const rightKey = `${right.severity}|${right.component}|${right.advisory}|${right.package}|${right.installedVersion}|${right.fixedVersion ?? ''}`
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
    })

    return {
        ...base,
        scanStatus: 'complete',
        errorCode: null,
        counts: {
            high: findings.filter((finding) => finding.severity === 'HIGH').length,
            critical: findings.filter((finding) => finding.severity === 'CRITICAL').length,
        },
        findings,
    }
}

export function assertTrivyZero(summary) {
    if (
        summary?.scanStatus !== 'complete'
        || !Number.isInteger(summary.counts?.high)
        || !Number.isInteger(summary.counts?.critical)
    ) {
        throw new Error('Sanitized Trivy evidence is unavailable or invalid.')
    }
    if (summary.counts.high !== 0 || summary.counts.critical !== 0) {
        throw new Error('Sanitized Trivy HIGH/CRITICAL gate failed.')
    }
    return true
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
