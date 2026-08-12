import { timingSafeEqual } from 'node:crypto'

import { PublishingApiError } from './errors'
import type { PublishingEnvironment } from './auth'

export type PublishingRuntimeConfig = {
    environment: PublishingEnvironment
    externalLinkHostnames: ReadonlySet<string>
    internalLinkHostnames: ReadonlySet<string>
    trustedClientIpHeader?: string
    trustedProtoHeader?: string
    jsonRateLimit: number
    mediaRateLimit: number
    rateLimitWindowSeconds: number
}

function configurationError(name: string): never {
    throw new PublishingApiError(
        503,
        'PUBLISHING_CONFIGURATION_INVALID',
        'Publishing API runtime configuration is unavailable',
        [{ field: name, code: 'CONFIG_INVALID' }],
        60,
    )
}

function positiveInteger(name: string): number {
    const value = Number(process.env[name])
    if (!Number.isSafeInteger(value) || value < 1) {
        return configurationError(name)
    }
    return value
}

function parseExactHostnames(name: string): ReadonlySet<string> {
    const value = process.env[name]?.trim()
    if (!value) return new Set()

    const hostnames = value.split(',').map((hostname) => hostname.trim().toLowerCase())
    if (
        hostnames.some(
            (hostname) =>
                !hostname
                || hostname.includes('*')
                || hostname.includes('/')
                || hostname.includes(':')
                || !/^[a-z0-9.-]+$/.test(hostname),
        )
    ) {
        return configurationError(name)
    }
    return new Set(hostnames)
}

function optionalHeaderName(name: string): string | undefined {
    const value = process.env[name]?.trim().toLowerCase()
    if (!value) return undefined
    if (!/^[a-z0-9-]+$/.test(value)) return configurationError(name)
    return value
}

export function getPublishingRuntimeConfig(): PublishingRuntimeConfig {
    const environment = process.env.PUBLISHING_ENVIRONMENT
    if (environment !== 'staging' && environment !== 'production') {
        return configurationError('PUBLISHING_ENVIRONMENT')
    }

    const internalLinkHostnames = new Set([
        'dongphugia.vn',
        'www.dongphugia.vn',
    ])
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) {
        try {
            internalLinkHostnames.add(new URL(siteUrl).hostname.toLowerCase())
        } catch {
            return configurationError('NEXT_PUBLIC_SITE_URL')
        }
    }

    return {
        environment,
        externalLinkHostnames: parseExactHostnames(
            'PUBLISHING_EXTERNAL_LINK_HOSTNAMES',
        ),
        internalLinkHostnames,
        trustedClientIpHeader: optionalHeaderName(
            'PUBLISHING_TRUSTED_CLIENT_IP_HEADER',
        ),
        trustedProtoHeader: optionalHeaderName(
            'PUBLISHING_TRUSTED_PROTO_HEADER',
        ),
        jsonRateLimit: positiveInteger('PUBLISHING_JSON_RATE_LIMIT_MAX'),
        mediaRateLimit: positiveInteger('PUBLISHING_MEDIA_RATE_LIMIT_MAX'),
        rateLimitWindowSeconds: positiveInteger(
            'PUBLISHING_RATE_LIMIT_WINDOW_SECONDS',
        ),
    }
}

export function requirePublishingHttps(
    request: Request,
    config: PublishingRuntimeConfig,
): void {
    const urlSecure = new URL(request.url).protocol === 'https:'
    const forwardedSecure = config.trustedProtoHeader
        ? request.headers.get(config.trustedProtoHeader) === 'https'
        : false
    if (!urlSecure && !forwardedSecure) {
        throw new PublishingApiError(
            403,
            'HTTPS_REQUIRED',
            'Publishing API requires HTTPS server-to-server access',
        )
    }
}

export function requirePublishingSchedulerToken(request: Request): void {
    const expected = process.env.PUBLISHING_SCHEDULER_TOKEN
    if (!expected || expected.length < 32 || expected.length > 256) {
        return configurationError('PUBLISHING_SCHEDULER_TOKEN')
    }
    const supplied = request.headers.get('x-publishing-scheduler-token')
    if (!supplied) {
        throw new PublishingApiError(
            401,
            'SCHEDULER_AUTH_REQUIRED',
            'Scheduler invocation is not authenticated',
        )
    }
    const expectedBytes = Buffer.from(expected)
    const suppliedBytes = Buffer.from(supplied)
    if (
        expectedBytes.length !== suppliedBytes.length
        || !timingSafeEqual(expectedBytes, suppliedBytes)
    ) {
        throw new PublishingApiError(
            401,
            'SCHEDULER_AUTH_INVALID',
            'Scheduler invocation is not authenticated',
        )
    }
}
