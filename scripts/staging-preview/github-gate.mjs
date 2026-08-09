#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { assertSha, stableJson, validateCandidate } from './lib.mjs'

const repository = process.env.GITHUB_REPOSITORY
const token = process.env.GITHUB_TOKEN
const prNumber = Number.parseInt(process.env.PREVIEW_PR_NUMBER ?? '', 10)
const expectedHeadSha = assertSha(process.env.PREVIEW_HEAD_SHA, 'Preview head SHA')
const outputPath = process.env.CANDIDATE_SOURCE_PATH ?? 'artifacts/staging-preview/candidate-source.json'

if (!repository || !token || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error('Repository, GitHub token, PR number, and exact head SHA are required.')
}

async function github(path) {
    const response = await fetch(`https://api.github.com${path}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
    })
    if (!response.ok) {
        throw new Error(`GitHub candidate gate request failed (${response.status}) for ${path.split('?')[0]}.`)
    }
    return response.json()
}

const encodedRepository = repository.split('/').map(encodeURIComponent).join('/')
const encodedSha = encodeURIComponent(expectedHeadSha)
const [pullRequest, rules, checkRunResponse, statuses] = await Promise.all([
    github(`/repos/${encodedRepository}/pulls/${prNumber}`),
    github(`/repos/${encodedRepository}/rules/branches/main`),
    github(`/repos/${encodedRepository}/commits/${encodedSha}/check-runs?filter=latest&per_page=100`),
    github(`/repos/${encodedRepository}/commits/${encodedSha}/statuses?per_page=100`),
])

const candidate = validateCandidate({
    repository,
    prNumber,
    expectedHeadSha,
    pullRequest,
    rules,
    checkRuns: checkRunResponse.check_runs ?? [],
    statuses,
})

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, stableJson(candidate), { mode: 0o600 })
console.log(`Exact PR candidate accepted: PR #${candidate.prNumber} at ${candidate.headSha}.`)
console.log(`Required checks accepted: ${candidate.requiredChecks.join(', ')}.`)
