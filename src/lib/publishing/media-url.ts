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
export function publishingMediaUrlCandidates(value: string | null | undefined) {
    if (!value) return []
    const normalized = normalizePublishingMediaUrl(value)
    const candidates = new Set([value])
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
