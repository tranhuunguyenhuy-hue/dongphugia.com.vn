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
        expect(workflow).toContain('Record rollback Trivy baseline risk')
        expect(workflow).toContain('Enforce candidate Trivy HIGH and CRITICAL zero')
        expect(workflow).toMatch(/Record rollback Trivy baseline risk[\s\S]*?if: always\(\)/)
        expect(workflow).toMatch(/Enforce candidate Trivy HIGH and CRITICAL zero[\s\S]*?if: always\(\)/)
    })

    it('records rollback baseline risk without applying the candidate zero gate', () => {
        const start = workflow.indexOf('      - name: Record rollback Trivy baseline risk')
        const end = workflow.indexOf('      - name: Remove staged Trivy summary helper', start)
        expect(start).toBeGreaterThanOrEqual(0)
        expect(end).toBeGreaterThan(start)

        const baselineStep = workflow.slice(start, end)
        expect(baselineStep).toContain(".counts.high // empty")
        expect(baselineStep).toContain(".counts.critical // empty")
        expect(baselineStep).toContain('Baseline HIGH findings: $high')
        expect(baselineStep).toContain('Baseline CRITICAL findings: $critical')
        expect(baselineStep).not.toContain('= "0"')

        const candidateStart = workflow.indexOf('      - name: Enforce candidate Trivy HIGH and CRITICAL zero')
        const candidateEnd = workflow.indexOf('      - name: Smoke exact pushed digest', candidateStart)
        expect(candidateStart).toBeGreaterThan(end)
        expect(candidateEnd).toBeGreaterThan(candidateStart)
        const candidateGate = workflow.slice(candidateStart, candidateEnd)
        expect(candidateGate).toContain('.counts.high // -1')
        expect(candidateGate).toContain('.counts.critical // -1')
        expect(candidateGate).toContain('= "0"')
    })

    it('passes the exact-main digest as the workflow rollback artifact and keeps evidence bound', () => {
        expect(workflow).toContain('rollback_digest: ${{ steps.rollback_build.outputs.digest }}')
        expect(workflow).toContain('rollback-trivy-summary.json')
        expect(workflow).toContain('Write deterministic candidate manifest')
        expect(workflow).toContain('Write private manual Coolify operator handoff')
        expect(workflow).toContain('operator-handoff.md')
    })

    it('runs rollback summary generation from verified candidate helpers, not origin/main', () => {
        const helperStart = workflow.indexOf('      - name: Stage verified Trivy summary helper from accepted head')
        const mainCheckoutStart = workflow.indexOf('      - name: Checkout exact origin main rollback source')
        const rollbackSummaryStart = workflow.indexOf('      - name: Write sanitized rollback Trivy summary')
        const helperCleanupStart = workflow.indexOf('      - name: Remove staged Trivy summary helper')
        expect(helperStart).toBeGreaterThanOrEqual(0)
        expect(mainCheckoutStart).toBeGreaterThan(helperStart)
        expect(rollbackSummaryStart).toBeGreaterThan(mainCheckoutStart)
        expect(helperCleanupStart).toBeGreaterThan(rollbackSummaryStart)

        const helperStage = workflow.slice(helperStart, mainCheckoutStart)
        expect(helperStage).toContain('git rev-parse "$EXPECTED_SHA:$writer_path"')
        expect(helperStage).toContain('git rev-parse "$EXPECTED_SHA:$library_path"')
        expect(helperStage).toContain('git hash-object "$writer_path"')
        expect(helperStage).toContain('TRIVY_HELPER_DIR=$helper_dir')

        const rollbackSummary = workflow.slice(rollbackSummaryStart, helperCleanupStart)
        expect(rollbackSummary).toContain('node "$TRIVY_HELPER_DIR/write-trivy-summary.mjs"')
        expect(rollbackSummary).not.toContain('node scripts/staging-preview/write-trivy-summary.mjs')
    })

    it('proves recovery tags are missing with the GitHub Packages API and fails closed', () => {
        const start = workflow.indexOf('      - name: Verify recovery tags are absent')
        const end = workflow.indexOf('      - name: Checkout exact origin main rollback source', start)
        expect(start).toBeGreaterThanOrEqual(0)
        expect(end).toBeGreaterThan(start)
        const guard = workflow.slice(start, end)

        expect(guard).toContain('GITHUB_TOKEN: ${{ github.token }}')
        expect(guard).toContain('https://api.github.com/repos/')
        expect(guard).toContain('/packages/container/')
        expect(guard).toContain("--write-out '%{http_code}'")
        expect(guard).toContain('404)')
        expect(guard).toContain('200)')
        expect(guard).toContain('401|403|429)')
        expect(guard).toContain('rel="next"')
        expect(guard).toContain('*) return 1')
        expect(guard).not.toContain('https://ghcr.io/v2/')
        expect(guard).not.toContain('application/vnd.docker')
        expect(guard).not.toContain('--request HEAD')
        expect(guard).not.toContain('docker buildx imagetools inspect')
        expect(guard).not.toContain('no such manifest')
        expect(guard).not.toContain('MANIFEST_UNKNOWN')
        expect(guard).not.toContain('manifest unknown')
        expect(workflow).not.toContain('https://ghcr.io/v2/')
    })

    it('stops before private Coolify UI work and never runs deployment acceptance on the runner', () => {
        expect(workflow).toContain('stop before private Coolify deployment')
        expect(workflow).not.toContain('Protected staging deploy and acceptance')
        expect(workflow).not.toContain('actions/upload-artifact@v4\n        with:\n          name: staging-acceptance')
        expect(workflow).not.toContain('COOLIFY')
    })
})
