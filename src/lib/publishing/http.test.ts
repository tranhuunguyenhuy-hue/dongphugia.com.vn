// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { PublishingApiError } from './errors'
import {
    parseRequiredIfMatch,
    withPublishingRoute,
} from './http'

describe('Publishing HTTP contract', () => {
    it('returns the stable bounded error envelope with a server request id', async () => {
        const response = await withPublishingRoute(
            new Request('https://www.dongphugia.vn/api/publishing/v1/posts'),
            async () => {
                throw new PublishingApiError(
                    422,
                    'PAYLOAD_INVALID',
                    'Request payload is invalid',
                    [{ field: 'title', code: 'TITLE_LENGTH' }],
                )
            },
        )

        const payload = await response.json()
        expect(response.status).toBe(422)
        expect(response.headers.get('x-request-id')).toMatch(
            /^[0-9a-f-]{36}$/,
        )
        expect(payload).toEqual({
            code: 'PAYLOAD_INVALID',
            message: 'Request payload is invalid',
            request_id: response.headers.get('x-request-id'),
            details: [{ field: 'title', code: 'TITLE_LENGTH' }],
        })
    })

    it('requires the quoted current Post Version for updates', () => {
        expect(parseRequiredIfMatch(new Headers({ 'if-match': '"v12"' }))).toBe(
            12,
        )
        expect(() => parseRequiredIfMatch(new Headers())).toThrowError(
            expect.objectContaining({ status: 428, code: 'IF_MATCH_REQUIRED' }),
        )
    })
})
