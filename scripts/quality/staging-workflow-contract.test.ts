import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const stagingContract = readFileSync(
    resolve(process.cwd(), '.github/workflows/staging-ghcr.yml'),
    'utf8',
)
const productionCandidate = readFileSync(
    resolve(process.cwd(), '.github/workflows/production-candidate.yml'),
    'utf8',
)
const stagingRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/staging-coolify.md'),
    'utf8',
)

describe('shared Production-data staging contract', () => {
    it('does not create a staging-only image or synthetic runtime', () => {
        expect(stagingContract).toContain(
            'name: Verify staging production-candidate contract',
        )
        expect(stagingContract).not.toContain('docker/build-push-action')
        expect(stagingContract).not.toContain('docker run')
        expect(stagingContract).not.toContain('DEPLOY_TARGET=staging')
        expect(stagingContract).not.toContain('STAGING_BUNNY_CDN_HOSTNAME')
    })

    it('keeps the protected-main Production Candidate as the only staging artifact', () => {
        expect(productionCandidate).toContain(
            'test "$GITHUB_REF" = "refs/heads/main"',
        )
        expect(productionCandidate).toContain(
            'production-candidate-${{ github.sha }}',
        )
        expect(productionCandidate).toContain('DEPLOY_TARGET=production')
        expect(productionCandidate).toContain(
            'PUBLISHING_BUNNY_CDN_HOSTNAME=${{ vars.PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME }}',
        )
    })

    it('documents fail-closed staging writes and noindex behavior for the same candidate', () => {
        expect(stagingRunbook).toMatch(
            /same exact immutable Production Candidate\s+digest/,
        )
        expect(stagingRunbook).toContain('WRITE_FREEZE_MODE')
        expect(stagingRunbook).toContain('PRODUCTION_INDEXING_ENABLED')
        expect(stagingRunbook).toContain('Gate B')
        expect(stagingRunbook).toContain('Gate C')
        expect(stagingRunbook).toContain(
            'does not authorize a Production deployment',
        )
    })
})
