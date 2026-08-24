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
const stagingCandidate = readFileSync(
    resolve(process.cwd(), '.github/workflows/staging-candidate.yml'),
    'utf8',
)
const stagingRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/staging-coolify.md'),
    'utf8',
)
const docsIndex = readFileSync(resolve(process.cwd(), 'docs/README.md'), 'utf8')
const disposableBootstrapRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/staging-db-bootstrap/RUNBOOK.md'),
    'utf8',
)
const publishingRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/publishing-api-v1-runbook.md'),
    'utf8',
)

describe('dedicated Staging candidate contract', () => {
    it('does not create a staging-only image or synthetic runtime', () => {
        expect(stagingContract).toContain(
            'name: Verify staging production-candidate contract',
        )
        expect(stagingContract).not.toContain('docker/build-push-action')
        expect(stagingContract).not.toContain('docker run')
        expect(stagingContract).not.toContain('DEPLOY_TARGET=staging')
        expect(stagingContract).not.toContain('STAGING_BUNNY_CDN_HOSTNAME')
    })

    it('keeps the protected-main Production Candidate workflow production-targeted', () => {
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

    it('builds a separate Staging target from an explicit source revision', () => {
        expect(stagingCandidate).toContain('name: Build Staging-safe candidate')
        expect(stagingCandidate).toContain('source_ref:')
        expect(stagingCandidate).toContain('ref: ${{ inputs.source_ref }}')
        expect(stagingCandidate).toContain('DEPLOY_TARGET=staging')
        expect(stagingCandidate).toContain(
            'NEXT_PUBLIC_SITE_URL=${{ inputs.staging_site_url }}',
        )
        expect(stagingCandidate).toContain('platforms: linux/arm64')
        expect(stagingCandidate).toContain('packages: write')
        expect(stagingCandidate).toContain('STAGING_PUBLISHING_BUNNY_CDN_HOSTNAME')
    })

    it('documents fail-closed staging writes and noindex behavior for the same candidate', () => {
        expect(stagingRunbook).toContain('Staging-safe build')
    expect(stagingRunbook).toContain('dedicated Coolify PostgreSQL')
    expect(stagingRunbook).toContain('dpg-staging-postgres')
    expect(stagingRunbook).toContain('The Staging digest is never')
        expect(stagingRunbook).toContain('WRITE_FREEZE_MODE')
        expect(stagingRunbook).toContain('PRODUCTION_INDEXING_ENABLED')
        expect(stagingRunbook).toContain('Gate B')
        expect(stagingRunbook).toContain('Gate C')
        expect(stagingRunbook).toContain(
            'does not authorize a Production deployment',
        )
    })

    it('defers only write-frozen checks that become immediate Production acceptance', () => {
        expect(stagingRunbook).toContain(
            'NOT_APPLICABLE_ON_WRITE_FROZEN_STAGING',
        )
        expect(stagingRunbook).toContain(
            'Related non-destructive evidence has passed on the same immutable digest',
        )
        expect(stagingRunbook).toContain(
            'immediate mandatory Production post-deploy acceptance',
        )
        expect(stagingRunbook).toContain('This is not a skip')
        expect(stagingRunbook).toContain('CSP-only Managed Media application')
        expect(stagingRunbook).toContain('non-zero `naturalWidth`')
    })

    it('fences legacy synthetic staging material as CI-only and superseded', () => {
        expect(docsIndex).toContain('CI-only disposable database fixtures')
        expect(docsIndex).toContain('FAST_PATH/STANDARD/HIGH_RISK')
        expect(disposableBootstrapRunbook).toContain('not a Staging runtime runbook')
        expect(disposableBootstrapRunbook).toMatch(
            /must not be executed against Staging or\s+Production/,
        )
        expect(publishingRunbook).toContain('Dedicated-data Staging supersedes the legacy synthetic topology')
        expect(publishingRunbook).toContain('must remain write-frozen')
        expect(publishingRunbook).not.toContain('either artifact on Dedicated-data Staging unless')
    })
})
