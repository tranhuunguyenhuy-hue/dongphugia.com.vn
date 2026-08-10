import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const candidateSha = 'a'.repeat(40)
const rollbackSha = 'c'.repeat(40)
const candidateDigest = `sha256:${'b'.repeat(64)}`
const rollbackDigest = `sha256:${'d'.repeat(64)}`

describe('private staging handoff artifacts', () => {
    it('emits deterministic manual-gate evidence without control-plane credentials', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'dpg-staging-handoff-'))
        try {
            const manifestPath = join(directory, 'candidate-manifest.json')
            const handoffPath = join(directory, 'operator-handoff.md')
            const environment = {
                ...process.env,
                GITHUB_REPOSITORY: 'tranhuunguyenhuy-hue/dongphugia.com.vn',
                PREVIEW_PR_NUMBER: '37',
                CANDIDATE_SHA: candidateSha,
                CANDIDATE_DIGEST: candidateDigest,
                ROLLBACK_SHA: rollbackSha,
                ROLLBACK_DIGEST: rollbackDigest,
                IMAGE_NAME: 'ghcr.io/tranhuunguyenhuy-hue/dongphugia-web',
                CANDIDATE_MANIFEST_PATH: manifestPath,
                OPERATOR_HANDOFF_PATH: handoffPath,
                STAGING_SITE_URL: 'https://dongphugia-staging.47-131-92-97.sslip.io',
                GITHUB_SERVER_URL: 'https://github.com',
                GITHUB_RUN_ID: '12345',
            }

            execFileSync(process.execPath, ['scripts/staging-preview/write-manifest.mjs'], {
                cwd: root,
                env: environment,
                stdio: 'pipe',
            })
            execFileSync(process.execPath, ['scripts/staging-preview/write-operator-handoff.mjs'], {
                cwd: root,
                env: environment,
                stdio: 'pipe',
            })

            const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
            const handoff = await readFile(handoffPath, 'utf8')
            expect(manifest.staging).toMatchObject({
                mode: 'private-manual-gated',
                workflowMutation: 'stopped-before-coolify',
                manualRollback: 'one-time-to-operator-recorded-current-digest',
            })
            expect(manifest.image).toBe(`ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@${candidateDigest}`)
            expect(manifest.rollback.image).toBe(`ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@${rollbackDigest}`)
            expect(handoff).toContain(candidateDigest)
            expect(handoff).toContain(rollbackDigest)
            expect(handoff).toContain('do not run a synthetic localhost preview')
            expect(handoff).not.toMatch(/COOLIFY_API|COOLIFY_STAGING|API_TOKEN|DATABASE_URL|DIRECT_URL/)
            expect(handoff).not.toContain('postgresql://')
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    })
})
