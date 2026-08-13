import { afterEach, describe, expect, it } from 'vitest'

import { assessScheduledPublication, runPublishingScheduler } from './scheduler'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

afterEach(() => {
    delete process.env.WRITE_FREEZE_MODE
})

describe('assessScheduledPublication', () => {
    const ready = {
        globalGateEnabled: true,
        identityActive: true,
        hasPublishCapability: true,
        scheduleVersionMatches: true,
        readinessErrors: [],
        safetyErrorCode: null,
    }

    it('permits a due Scheduled Publication only when every current guard passes', () => {
        expect(assessScheduledPublication(ready)).toEqual({ kind: 'publish' })
    })

    it('creates a durable Schedule Block when authority is revoked', () => {
        expect(
            assessScheduledPublication({
                ...ready,
                hasPublishCapability: false,
            }),
        ).toEqual({ kind: 'block', code: 'PUBLISH_CAPABILITY_REVOKED' })
    })

    it('creates a durable Schedule Block when current content is no longer safe', () => {
        expect(
            assessScheduledPublication({
                ...ready,
                safetyErrorCode: 'MEDIA_REFERENCE_INVALID',
            }),
        ).toEqual({ kind: 'block', code: 'MEDIA_REFERENCE_INVALID' })
    })

    it('creates a durable Schedule Block when readiness is no longer satisfied', () => {
        expect(
            assessScheduledPublication({
                ...ready,
                readinessErrors: [
                    { field: 'excerpt', code: 'EXCERPT_LENGTH' },
                ],
            }),
        ).toEqual({ kind: 'block', code: 'PUBLICATION_NOT_READY' })
    })

    it('does not start or mutate scheduled work while writes are frozen', async () => {
        process.env.WRITE_FREEZE_MODE = 'true'

        await expect(
            runPublishingScheduler({
                config: {
                    environment: 'staging',
                    externalLinkHostnames: new Set(),
                    internalLinkHostnames: new Set(['www.dongphugia.vn']),
                    jsonRateLimit: 60,
                    mediaRateLimit: 20,
                    rateLimitWindowSeconds: 60,
                },
            }),
        ).resolves.toMatchObject({
            result_code: 'WRITE_FREEZE_ACTIVE',
            processed_count: 0,
            published_count: 0,
            blocked_count: 0,
        })
    })

    it('uses share locks for authority reads rather than control-plane update authority', () => {
        const scheduler = readFileSync(resolve(process.cwd(), 'src/lib/publishing/scheduler.ts'), 'utf8')
        expect(scheduler).toContain('FOR SHARE')
        expect(scheduler).not.toContain('FOR KEY SHARE')
        expect(scheduler).not.toContain('FOR UPDATE')
    })
})
