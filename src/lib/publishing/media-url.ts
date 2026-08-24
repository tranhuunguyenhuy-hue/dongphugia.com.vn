const LEGACY_PUBLISHING_CDN_HOSTNAME = 'dpg-publishing-production.b-cdn.net'
const DEFAULT_PUBLISHING_CDN_HOSTNAME = 'cdn.dongphugia.com.vn'

function currentPublishingCdnHostname() {
    const configured = process.env.PUBLISHING_BUNNY_CDN_HOSTNAME?.trim().toLowerCase()
    if (configured && /^[a-z0-9.-]+$/.test(configured) && configured !== LEGACY_PUBLISHING_CDN_HOSTNAME) {
        return configured
    }
    return DEFAULT_PUBLISHING_CDN_HOSTNAME
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

    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== LEGACY_PUBLISHING_CDN_HOSTNAME) {
        return value
    }

    url.hostname = currentPublishingCdnHostname()
    return url.toString()
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
