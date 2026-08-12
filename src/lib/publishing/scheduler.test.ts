import { describe, expect, it } from 'vitest'

import { assessScheduledPublication } from './scheduler'

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
})
