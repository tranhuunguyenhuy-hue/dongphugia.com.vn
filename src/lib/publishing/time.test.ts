import { describe, expect, it } from 'vitest'

import { validateScheduledPublication } from './time'

describe('validateScheduledPublication', () => {
    it('stores the UTC instant while preserving the IANA timezone', () => {
        expect(
            validateScheduledPublication(
                {
                    publishAt: '2026-08-20T08:00:00+07:00',
                    publicationTimezone: 'Asia/Ho_Chi_Minh',
                },
                new Date('2026-08-12T00:00:00.000Z'),
            ),
        ).toEqual({
            scheduledFor: new Date('2026-08-20T01:00:00.000Z'),
            scheduledTimezone: 'Asia/Ho_Chi_Minh',
        })
    })

    it('rejects an offset that disagrees with the IANA timezone', () => {
        expect(() =>
            validateScheduledPublication(
                {
                    publishAt: '2026-08-20T08:00:00+08:00',
                    publicationTimezone: 'Asia/Ho_Chi_Minh',
                },
                new Date('2026-08-12T00:00:00.000Z'),
            ),
        ).toThrowError(
            expect.objectContaining({
                code: 'SCHEDULE_TIMEZONE_OFFSET_MISMATCH',
            }),
        )
    })

    it('enforces the five-minute to 365-day scheduling window', () => {
        const now = new Date('2026-08-12T00:00:00.000Z')
        expect(() =>
            validateScheduledPublication(
                {
                    publishAt: '2026-08-12T07:04:59+07:00',
                    publicationTimezone: 'Asia/Ho_Chi_Minh',
                },
                now,
            ),
        ).toThrowError(expect.objectContaining({ code: 'SCHEDULE_TOO_SOON' }))

        expect(() =>
            validateScheduledPublication(
                {
                    publishAt: '2027-08-13T07:00:00+07:00',
                    publicationTimezone: 'Asia/Ho_Chi_Minh',
                },
                now,
            ),
        ).toThrowError(expect.objectContaining({ code: 'SCHEDULE_TOO_FAR' }))
    })
})
