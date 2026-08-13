import sanitizeHtml from 'sanitize-html'

import { PublishingApiError } from './errors'

const ALLOWED_TAGS = new Set([
    'a',
    'blockquote',
    'br',
    'code',
    'em',
    'figcaption',
    'figure',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
])
const ALLOWED_ATTRIBUTES: Record<string, ReadonlySet<string>> = {
    a: new Set(['href', 'title']),
    img: new Set(['src', 'alt', 'title', 'width', 'height']),
    td: new Set(['colspan', 'rowspan']),
    th: new Set(['colspan', 'rowspan']),
}
const SANITIZED_ATTRIBUTES: Record<string, string[]> = {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
}

export type PublishingHtmlPolicy = {
    externalLinkHostnames: ReadonlySet<string>
    internalLinkHostnames: ReadonlySet<string>
    managedImageUrls: ReadonlySet<string>
}

export class PublishingHtmlValidationError extends PublishingApiError {
    constructor(
        code: string,
        message: string,
    ) {
        super(422, code, message, [{ field: 'content_html', code }])
        this.name = 'PublishingHtmlValidationError'
    }
}

function normalizeLink(href: string, policy: PublishingHtmlPolicy) {
    if (href.startsWith('#') && href.length > 1) {
        return { href, external: false }
    }
    if (href.startsWith('/')) {
        const baseHostname = [...policy.internalLinkHostnames][0]
        if (!baseHostname || href.startsWith('//') || href.includes('\\')) {
            throw new PublishingHtmlValidationError(
                'LINK_URL_INVALID',
                'Internal link URL is invalid',
            )
        }
        let internalUrl: URL
        try {
            internalUrl = new URL(href, `https://${baseHostname}`)
        } catch {
            throw new PublishingHtmlValidationError(
                'LINK_URL_INVALID',
                'Internal link URL is invalid',
            )
        }
        if (!policy.internalLinkHostnames.has(internalUrl.hostname.toLowerCase())) {
            throw new PublishingHtmlValidationError(
                'LINK_URL_INVALID',
                'Internal link URL is invalid',
            )
        }
        return {
            href: `${internalUrl.pathname}${internalUrl.search}${internalUrl.hash}`,
            external: false,
        }
    }

    let url: URL
    try {
        url = new URL(href)
    } catch {
        throw new PublishingHtmlValidationError(
            'LINK_URL_INVALID',
            'Link URL is invalid',
        )
    }
    if (url.protocol !== 'https:') {
        throw new PublishingHtmlValidationError(
            'EXTERNAL_LINK_HTTPS_REQUIRED',
            'External links must use HTTPS',
        )
    }
    if (url.username || url.password) {
        throw new PublishingHtmlValidationError(
            'LINK_CREDENTIALS_NOT_ALLOWED',
            'Link URL credentials are not allowed',
        )
    }

    const hostname = url.hostname.toLowerCase()
    if (policy.internalLinkHostnames.has(hostname)) {
        return { href: url.toString(), external: false }
    }
    if (!policy.externalLinkHostnames.has(hostname)) {
        throw new PublishingHtmlValidationError(
            'EXTERNAL_LINK_HOST_NOT_ALLOWED',
            'External link hostname is not allowed',
        )
    }

    return { href: url.toString(), external: true }
}

function normalizeImage(src: string, policy: PublishingHtmlPolicy): string {
    let url: URL
    try {
        url = new URL(src)
    } catch {
        throw new PublishingHtmlValidationError(
            'MEDIA_REFERENCE_INVALID',
            'Image URL is invalid',
        )
    }

    const normalized = url.toString()
    if (
        url.protocol !== 'https:'
        || url.username
        || url.password
        || !policy.managedImageUrls.has(normalized)
    ) {
        throw new PublishingHtmlValidationError(
            'MEDIA_REFERENCE_NOT_MANAGED',
            'Image must reference integration-owned Managed Media',
        )
    }

    return normalized
}

export function sanitizePublishingHtml(
    html: string,
    policy: PublishingHtmlPolicy,
): string {
    return sanitizeHtml(html, {
        allowedTags: [...ALLOWED_TAGS],
        allowedAttributes: SANITIZED_ATTRIBUTES,
        transformTags: {
            a: (_tagName, attributes) => {
                const link = normalizeLink(attributes.href ?? '', policy)
                return {
                    tagName: 'a',
                    attribs: {
                        href: link.href,
                        ...(attributes.title ? { title: attributes.title } : {}),
                        ...(link.external
                            ? {
                                target: '_blank',
                                rel: 'noopener noreferrer nofollow',
                            }
                            : {}),
                    },
                }
            },
            img: (_tagName, attributes) => ({
                tagName: 'img',
                attribs: {
                    src: normalizeImage(attributes.src ?? '', policy),
                    ...(attributes.alt ? { alt: attributes.alt } : {}),
                    ...(attributes.title ? { title: attributes.title } : {}),
                    ...(attributes.width ? { width: attributes.width } : {}),
                    ...(attributes.height ? { height: attributes.height } : {}),
                    loading: 'lazy',
                    decoding: 'async',
                },
            }),
        },
        onOpenTag: (tagName, attributes) => {
            if (!ALLOWED_TAGS.has(tagName)) {
                throw new PublishingHtmlValidationError(
                    'HTML_TAG_NOT_ALLOWED',
                    `HTML tag is not allowed: ${tagName}`,
                )
            }
            for (const attributeName of Object.keys(attributes)) {
                if (!ALLOWED_ATTRIBUTES[tagName]?.has(attributeName)) {
                    throw new PublishingHtmlValidationError(
                        'HTML_ATTRIBUTE_NOT_ALLOWED',
                        `HTML attribute is not allowed: ${tagName}.${attributeName}`,
                    )
                }
            }
        },
    })
}
