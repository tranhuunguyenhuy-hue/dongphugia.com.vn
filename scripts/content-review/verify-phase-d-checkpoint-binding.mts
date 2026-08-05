import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const phaseD = require('../../src/lib/content-review/phase-d-checkpoint.ts') as typeof import('../../src/lib/content-review/phase-d-checkpoint')
const { POLICY_HASH } = require('../../src/lib/content-review/policy-contract.ts') as typeof import('../../src/lib/content-review/policy-contract')

const root = process.cwd()
const packagePath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-checkpoint-package.json')
const manifestPath = path.join(root, 'docs/review-bundles/leo-493-phase-d-checkpoint-manifest.json')
const allowedArtifactPaths = new Set([
    'docs/review-bundles/leo-493-phase-d-checkpoint-dashboard.html',
    'docs/review-bundles/leo-493-phase-d-checkpoint-manifest.json',
    'docs/review-bundles/leo-493-phase-d-checkpoint-report.md',
])

type Manifest = {
    policyHash: string
    snapshotHash: string
    cohortHash: string
    checkpointHash: string
    sourceHash: string
    proposalHash: string
    packageHash: string
    sourceCommit: string
    sourceCommitRole: string
    bindingStatus: string
}

function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

async function main() {
    const packageValue = JSON.parse(await fs.readFile(packagePath, 'utf8')) as phaseD.PhaseDCheckpointPackage
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Manifest
    const currentHead = git('rev-parse', 'HEAD')
    const expectedHead = process.argv.find(argument => argument.startsWith('--expected-head='))?.slice('--expected-head='.length)
    if (expectedHead && expectedHead !== currentHead) throw new Error(`Phase D exact-head mismatch: expected ${expectedHead}; current ${currentHead}`)

    phaseD.assertPhaseDCheckpointBinding(packageValue, POLICY_HASH, packageValue.snapshotHash, packageValue.sourceCommit)
    const fields: Array<keyof Manifest> = ['policyHash', 'snapshotHash', 'cohortHash', 'checkpointHash', 'sourceHash', 'proposalHash', 'packageHash', 'sourceCommit', 'sourceCommitRole']
    for (const field of fields) {
        if (manifest[field] !== packageValue[field]) throw new Error(`Phase D manifest/package mismatch at ${field}`)
    }
    if (manifest.bindingStatus !== 'VALID') throw new Error('Phase D manifest binding is not VALID')
    if (packageValue.sourceCommitRole !== 'GENERATOR_INPUT_HEAD') throw new Error('Phase D sourceCommit role is missing or ambiguous')
    if (git('merge-base', '--is-ancestor', packageValue.sourceCommit, currentHead) !== '') throw new Error('Phase D generator input head is not an ancestor of current exact head')

    const changedAfterGeneration = packageValue.sourceCommit === currentHead ? [] : git('diff', '--name-only', `${packageValue.sourceCommit}..${currentHead}`).split('\n').filter(Boolean)
    const unexpected = changedAfterGeneration.filter(file => !allowedArtifactPaths.has(file))
    if (unexpected.length) throw new Error(`Phase D artifact follow-up changed non-artifact files: ${unexpected.join(', ')}`)
    console.log(`PHASE_D_BINDING_PASS sourceCommit=${packageValue.sourceCommit} sourceCommitRole=${packageValue.sourceCommitRole} exactHead=${currentHead} artifactDiff=${changedAfterGeneration.length}`)
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Phase D binding verification failed')
    process.exitCode = 1
})
