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
        expect(workflow).not.toMatch(/COOLIFY_API|COOLIFY_STAGING|COOLIFY_API_TOKEN/)
        expect(workflow).not.toContain('environment:')
        expect(workflow).not.toContain('coolify.mjs')
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
        expect(workflow).toContain('Enforce candidate Trivy HIGH and CRITICAL zero')
        expect(workflow).toMatch(/Enforce rollback Trivy HIGH and CRITICAL zero[\s\S]*?if: always\(\)/)
        expect(workflow).toMatch(/Enforce candidate Trivy HIGH and CRITICAL zero[\s\S]*?if: always\(\)/)
    })

    it('passes the exact-main digest as the workflow rollback artifact and keeps evidence bound', () => {
        expect(workflow).toContain('rollback_digest: ${{ steps.rollback_build.outputs.digest }}')
        expect(workflow).toContain('rollback-trivy-summary.json')
        expect(workflow).toContain('Write deterministic candidate manifest')
        expect(workflow).toContain('Write private manual Coolify operator handoff')
        expect(workflow).toContain('operator-handoff.md')
    })

    it('stops before private Coolify UI work and never runs deployment acceptance on the runner', () => {
        expect(workflow).toContain('stop before private Coolify deployment')
        expect(workflow).not.toContain('Protected staging deploy and acceptance')
        expect(workflow).not.toContain('actions/upload-artifact@v4\n        with:\n          name: staging-acceptance')
        expect(workflow).not.toContain('COOLIFY')
    })
})
