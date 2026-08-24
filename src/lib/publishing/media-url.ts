import { PublishingApiError } from './errors'

const LEGACY_PUBLISHING_CDN_HOSTNAMES = new Set([
    'dpg-publishing-production.b-cdn.net',
    'dpg-publishing-staging.b-cdn.net',
])
// Dedicated Bunny custom hostname for Publishing Managed Media. Keeping this
// separate from the product CDN prevents a valid Publishing object path from
// being routed to the wrong storage zone when the runtime variable is absent.
const DEFAULT_PUBLISHING_CDN_HOSTNAME = 'media.dongphugia.vn'

export function getCanonicalPublishingCdnHostname(value = process.env.PUBLISHING_BUNNY_CDN_HOSTNAME) {
    const configured = value?.trim().toLowerCase()
    if (
        configured
        && /^[a-z0-9.-]+$/.test(configured)
        && !LEGACY_PUBLISHING_CDN_HOSTNAMES.has(configured)
    ) {
        return configured
    }
    return DEFAULT_PUBLISHING_CDN_HOSTNAME
}

function currentPublishingCdnHostname() {
    return getCanonicalPublishingCdnHostname()
}

export function isPublishingMediaUrlAllowed(value: string | null | undefined) {
    if (!value) return false

    try {
        const url = new URL(value)
        return url.protocol === 'https:' && new Set([
            currentPublishingCdnHostname(),
            ...LEGACY_PUBLISHING_CDN_HOSTNAMES,
        ]).has(url.hostname.toLowerCase())
    } catch {
        return false
    }
}

/**
 * Return a canonical URL only for an allowlisted Managed Media host.
 * Unknown or malformed values must not cross a Publishing API boundary.
 */
export function canonicalizePublishingMediaUrl(value: string | null | undefined) {
    if (!isPublishingMediaUrlAllowed(value)) return null
    return normalizePublishingMediaUrl(value) ?? null
}

/**
 * Keep legacy Managed Media records renderable without mutating persisted data.
 * New media URLs continue to come from the configured Publishing CDN.
 */
export function normalizePublishingMediaUrl(value: string | null | undefined) {
    if (!value) return value

    let url: URL
    try {
        url = new URL(value)
    } catch {
        return value
    }

    if (
        url.protocol !== 'https:'
        || !LEGACY_PUBLISHING_CDN_HOSTNAMES.has(url.hostname.toLowerCase())
    ) {
        return value
    }

    url.hostname = currentPublishingCdnHostname()
    return url.toString()
}

/**
 * Return equivalent forms so canonical requests can resolve legacy persisted
 * media without requiring a database migration.
 */
export function publishingMediaUrlCandidates(
    value: string | null | undefined,
): string[] {
    if (!value || !isPublishingMediaUrlAllowed(value)) return []
    const normalized = normalizePublishingMediaUrl(value)
    const candidates = new Set<string>([value])
    if (normalized) candidates.add(normalized)

    if (normalized) {
        const canonical = new URL(normalized)
        if (canonical.hostname === currentPublishingCdnHostname()) {
            for (const hostname of LEGACY_PUBLISHING_CDN_HOSTNAMES) {
                canonical.hostname = hostname
                candidates.add(canonical.toString())
            }
        }
    }

    return [...candidates]
}

export function publishingMediaUrlsMatch(
    left: string | null | undefined,
    right: string | null | undefined,
) {
    if (!left || !right) return left === right
    if (!isPublishingMediaUrlAllowed(left) || !isPublishingMediaUrlAllowed(right)) {
        return false
    }
    return normalizePublishingMediaUrl(left) === normalizePublishingMediaUrl(right)
}

export function normalizePublishingMediaHtml(html: string) {
    return html.replace(
        /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
        (_match, prefix: string, quote: string, source: string) => {
            const normalized = normalizePublishingMediaUrl(source)
            return `${prefix}${quote}${normalized ?? source}${quote}`
        },
    )
}

/**
 * Produce safe API response HTML by canonicalizing allowed Managed Media.
 * Persisted unsupported image markup fails closed instead of disappearing.
 */
export function canonicalizePublishingMediaHtml(html: string) {
    return html.replace(/<img\b[^>]*>/gi, (tag) => {
        const match = tag.match(
            /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
        )
        if (!match) return tag

        const source = match[1] ?? match[2] ?? match[3]
        const canonical = canonicalizePublishingMediaUrl(source)
        if (!canonical) {
            throw new PublishingApiError(
                500,
                'MEDIA_REFERENCE_INVALID',
                'Stored Blog Post contains an unallowlisted image URL',
            )
        }

        const sourceOffset = match[0].lastIndexOf(source)
        const sourceStart = (match.index ?? 0) + sourceOffset
        return `${tag.slice(0, sourceStart)}${canonical}${tag.slice(sourceStart + source.length)}`
    })
}

/**
 * Keep Managed Media variant responses canonical even when an older record or
 * storage adapter still contains a legacy Bunny hostname.
 */
export function normalizePublishingMediaVariants(variants: unknown) {
    if (!Array.isArray(variants)) return variants

    return variants.map((variant) => {
        if (
            !variant
            || typeof variant !== 'object'
            || !('url' in variant)
            || typeof variant.url !== 'string'
        ) {
            return variant
        }

        return {
            ...variant,
            url: normalizePublishingMediaUrl(variant.url),
        }
    })
}

/**
 * Strictly validate a persisted variant array before returning it from the
 * Publishing API. Invalid or unallowlisted variant URLs fail closed.
 */
export function canonicalizePublishingMediaVariants(variants: unknown) {
    if (!Array.isArray(variants)) return null

    const normalized = normalizePublishingMediaVariants(variants)
    if (!Array.isArray(normalized)) return null
    for (const variant of normalized) {
        if (
            !variant
            || typeof variant !== 'object'
            || !('url' in variant)
            || typeof variant.url !== 'string'
            || !canonicalizePublishingMediaUrl(variant.url)
        ) {
            return null
        }
    }
    return normalized
}
