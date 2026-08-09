import { describe, expect, it } from 'vitest'
import {
    IMAGE_NAME,
    STAGING_URL,
    assertStagingUrl,
    claimRollback,
    coolifyImageDigest,
    digestToCoolifyTag,
    requiredCheckContexts,
    validateCandidate,
} from './lib.mjs'

const sha = 'a'.repeat(40)
const digest = `sha256:${'b'.repeat(64)}`
const repository = 'tranhuunguyenhuy-hue/dongphugia.com.vn'

function fixture() {
    return {
        repository,
        prNumber: 495,
        expectedHeadSha: sha,
        pullRequest: {
            number: 495,
            state: 'open',
            html_url: 'https://github.example/pull/495',
            base: { ref: 'main' },
            head: { sha, ref: 'codex/leo-495', repo: { full_name: repository } },
        },
        rules: [{
            type: 'required_status_checks',
            parameters: { required_status_checks: [{ context: 'quality' }] },
        }],
        checkRuns: [{
            name: 'quality',
            head_sha: sha,
            status: 'completed',
            conclusion: 'success',
            completed_at: '2026-08-09T00:00:00Z',
            app: { id: 1 },
        }],
        statuses: [],
    }
}

describe('staging preview candidate gates', () => {
    it('accepts an exact open PR head with every required check successful', () => {
        expect(validateCandidate(fixture())).toMatchObject({
            prNumber: 495,
            headSha: sha,
            requiredChecks: ['quality'],
        })
    })

    it('fails closed when the PR head drifts', () => {
        const input = fixture()
        input.pullRequest.head.sha = 'c'.repeat(40)
        expect(() => validateCandidate(input)).toThrow('head drift')
    })

    it('fails closed when a required check is not successful', () => {
        const input = fixture()
        input.checkRuns[0].conclusion = 'failure'
        expect(() => validateCandidate(input)).toThrow('not successful')
    })

    it('fails closed when a newer run failed even if an older run passed', () => {
        const input = fixture()
        input.checkRuns.push({
            ...input.checkRuns[0],
            conclusion: 'failure',
            completed_at: '2026-08-09T00:01:00Z',
        })
        expect(() => validateCandidate(input)).toThrow('not successful')
    })

    it('requires at least one protected-branch status check', () => {
        expect(() => requiredCheckContexts([])).toThrow('No required status checks')
    })

    it('normalizes only immutable Coolify digest forms', () => {
        expect(digestToCoolifyTag(digest)).toBe(`sha256-${'b'.repeat(64)}`)
        expect(coolifyImageDigest(IMAGE_NAME, `sha256-${'b'.repeat(64)}`)).toBe(digest)
        expect(coolifyImageDigest(`${IMAGE_NAME}@sha256`, 'b'.repeat(64))).toBe(digest)
        expect(() => coolifyImageDigest(IMAGE_NAME, 'latest')).toThrow('not pinned')
    })

    it('rejects every production, Vercel, and lookalike staging target', () => {
        expect(assertStagingUrl(STAGING_URL)).toBe(STAGING_URL)
        expect(() => assertStagingUrl('https://www.dongphugia.vn')).toThrow('exactly')
        expect(() => assertStagingUrl('https://preview.vercel.app')).toThrow('exactly')
        expect(() => assertStagingUrl(`${STAGING_URL}.evil.example`)).toThrow('exactly')
    })

    it('selects rollback once only after mutation begins', () => {
        expect(claimRollback({ mutationStarted: false, rollbackAttempted: false }).required).toBe(false)
        expect(claimRollback({ mutationStarted: true, rollbackAttempted: false })).toEqual({
            required: true,
            state: { mutationStarted: true, rollbackAttempted: true },
        })
        expect(() => claimRollback({ mutationStarted: true, rollbackAttempted: true })).toThrow('second attempt')
    })
})
