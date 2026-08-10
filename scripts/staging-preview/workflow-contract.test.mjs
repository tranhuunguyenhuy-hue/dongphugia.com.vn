import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = await readFile(join(process.cwd(), '.github/workflows/staging-ghcr.yml'), 'utf8')

describe('staging workflow source contract', () => {
    it('is manual-only and scopes package write to the build job', () => {
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow.split('\n').some((line) => /^(push|pull_request):$/.test(line))).toBe(false)
        expect(workflow).toMatch(/build:[\s\S]*?permissions:[\s\S]*?contents: read[\s\S]*?packages: write/)
        expect(workflow).toMatch(/candidate:[\s\S]*?pull-requests: read/)
        expect(workflow).not.toMatch(/\bPAT\b/)
        expect(workflow).not.toContain('staging-recovery')
    })

    it('builds exact-main rollback and exact-head candidate images with immutable gates', () => {
        expect(workflow).toContain('Resolve exact origin main rollback source')
        expect(workflow).toContain('Build and push exact main rollback image')
        expect(workflow).toContain('Checkout exact accepted candidate head for candidate image')
        expect(workflow).toContain('io.dongphugia.recovery.provenance=canonical-source-baseline')
        expect(workflow).toContain('io.dongphugia.recovery.provenance=exact-pr-head')
        expect(workflow).toContain('docker pull "$IMAGE_REF"')
        expect(workflow).toContain('linux/arm64')
        expect(workflow).toContain('provenance: true')
        expect(workflow).toContain('sbom: true')
        expect(workflow).toContain('Enforce rollback Trivy HIGH and CRITICAL zero')
        expect(workflow).toContain('Enforce Trivy HIGH and CRITICAL zero')
    })

    it('passes the main digest as the only rollback target and keeps evidence bound', () => {
        expect(workflow).toContain('rollback_digest: ${{ steps.rollback_build.outputs.digest }}')
        expect(workflow).toContain('ROLLBACK_DIGEST: ${{ needs.build.outputs.rollback_digest }}')
        expect(workflow).toContain('ROLLBACK_SHA: ${{ needs.build.outputs.rollback_sha }}')
        expect(workflow).toContain('rollback-trivy-summary.json')
        expect(workflow).toContain('Write pre-deploy candidate manifest')
    })
})
