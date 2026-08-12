import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'
import {
    getWriteFreezeMessage,
    isWriteFreezeError,
} from '@/lib/write-freeze'

import { isPublishingApiError, PublishingApiError } from './errors'

const MAX_ERROR_DETAILS = 20
const MAX_JSON_REQUEST_BYTES = 1024 * 1024
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{8,200}$/

export type PublishingRouteContext = {
    requestId: string
}

function boundedDetails(error: PublishingApiError) {
    return error.details?.slice(0, MAX_ERROR_DETAILS).map((detail) => ({
        ...(detail.field ? { field: detail.field.slice(0, 100) } : {}),
        code: detail.code.slice(0, 100),
        ...(detail.message ? { message: detail.message.slice(0, 300) } : {}),
    }))
}

function errorResponse(error: PublishingApiError, requestId: string) {
    const details = boundedDetails(error)
    const response = NextResponse.json(
        {
            code: error.code,
            message: error.message,
            request_id: requestId,
            ...(details?.length ? { details } : {}),
        },
        { status: error.status },
    )
    response.headers.set('x-request-id', requestId)
    response.headers.set('cache-control', 'no-store')
    if (error.retryAfterSeconds !== undefined) {
        response.headers.set('retry-after', String(error.retryAfterSeconds))
    }
    return response
}

export async function withPublishingRoute(
    request: Request,
    handler: (context: PublishingRouteContext) => Promise<Response>,
): Promise<Response> {
    const requestId = randomUUID()
    try {
        const response = await handler({ requestId })
        response.headers.set('x-request-id', requestId)
        response.headers.set('cache-control', 'no-store')
        return response
    } catch (error) {
        if (isPublishingApiError(error)) {
            return errorResponse(error, requestId)
        }
        if (isWriteFreezeError(error)) {
            return errorResponse(
                new PublishingApiError(
                    503,
                    'WRITE_FREEZE_ACTIVE',
                    getWriteFreezeMessage(),
                    undefined,
                    60,
                ),
                requestId,
            )
        }

        console.error(
            JSON.stringify({
                event: 'publishing_api_error',
                request_id: requestId,
                route: new URL(request.url).pathname,
                code: 'INTERNAL_ERROR',
            }),
        )
        return errorResponse(
            new PublishingApiError(
                500,
                'INTERNAL_ERROR',
                'Publishing API request failed',
            ),
            requestId,
        )
    }
}

export function formatPostEtag(version: number): string {
    return `"v${version}"`
}

export function parseRequiredIfMatch(headers: Headers): number {
    const value = headers.get('if-match')
    if (!value) {
        throw new PublishingApiError(
            428,
            'IF_MATCH_REQUIRED',
            'If-Match with the current Post Version is required',
        )
    }
    const match = value.match(/^"v([1-9]\d*)"$/)
    if (!match) {
        throw new PublishingApiError(
            422,
            'IF_MATCH_INVALID',
            'If-Match must use the ETag format "v<N>"',
        )
    }
    return Number(match[1])
}

export function requireCreatePrecondition(headers: Headers): void {
    if (headers.get('if-none-match') !== '*') {
        throw new PublishingApiError(
            428,
            'IF_NONE_MATCH_REQUIRED',
            'Create requires If-None-Match: *',
        )
    }
}

export function requireIdempotencyKey(headers: Headers): string {
    const key = headers.get('idempotency-key')
    if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
        throw new PublishingApiError(
            422,
            'IDEMPOTENCY_KEY_INVALID',
            'Idempotency-Key must contain 8 to 200 visible ASCII characters',
        )
    }
    return key
}

export async function readPublishingJson(
    request: Request,
    maxBytes = MAX_JSON_REQUEST_BYTES,
): Promise<unknown> {
    const contentType = request.headers.get('content-type')?.split(';')[0].trim()
    if (contentType !== 'application/json') {
        throw new PublishingApiError(
            415,
            'CONTENT_TYPE_UNSUPPORTED',
            'Content-Type must be application/json',
        )
    }

    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new PublishingApiError(
            413,
            'REQUEST_TOO_LARGE',
            'Request body is too large',
        )
    }

    const reader = request.body?.getReader()
    if (!reader) {
        throw new PublishingApiError(
            422,
            'PAYLOAD_INVALID',
            'Request body is required',
        )
    }

    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > maxBytes) {
            await reader.cancel()
            throw new PublishingApiError(
                413,
                'REQUEST_TOO_LARGE',
                'Request body is too large',
            )
        }
        chunks.push(value)
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    try {
        return JSON.parse(buffer.toString('utf8'))
    } catch {
        throw new PublishingApiError(
            422,
            'PAYLOAD_INVALID',
            'Request body must contain valid JSON',
        )
    }
}

export function publishingJson(
    body: unknown,
    options: { status?: number; version?: number } = {},
): NextResponse {
    const response = NextResponse.json(body, { status: options.status ?? 200 })
    if (options.version !== undefined) {
        response.headers.set('etag', formatPostEtag(options.version))
    }
    return response
}
