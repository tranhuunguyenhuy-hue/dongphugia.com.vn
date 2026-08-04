import * as cheerio from 'cheerio'
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
    'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
    'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
    'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]

function isHitaUrl(value: string): boolean {
    try {
        const hostname = new URL(value).hostname.toLowerCase()
        return hostname === 'hita.com.vn' || hostname.endsWith('.hita.com.vn')
    } catch {
        return false
    }
}

export function extractEmbeddedImageUrls(html: string): string[] {
    const $ = cheerio.load(html || '', {}, false)
    const urls: string[] = []
    $('img[src]').each((_, element) => {
        const source = $(element).attr('src')?.trim()
        if (source) urls.push(source)
    })
    return [...new Set(urls)]
}

export function cleanupProductHtml(html: string): string {
    const safe = sanitizeHtml(html || '', {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            a: ['href', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            td: ['colspan', 'rowspan'],
            th: ['colspan', 'rowspan'],
        },
        allowedSchemes: ['http', 'https'],
        allowedSchemesByTag: { img: ['http', 'https'] },
        disallowedTagsMode: 'discard',
        enforceHtmlBoundary: true,
    })

    const $ = cheerio.load(safe, {}, false)
    $('a[href]').each((_, element) => {
        const anchor = $(element)
        if (isHitaUrl(anchor.attr('href') || '')) anchor.replaceWith(anchor.contents())
    })
    $('*').each((_, element) => {
        const node = $(element)
        const attributes = 'attribs' in element ? element.attribs : {}
        for (const attribute of Object.keys(attributes || {})) {
            if (attribute.startsWith('data-') || attribute === 'id' || attribute === 'style' || attribute === 'class') {
                node.removeAttr(attribute)
            }
        }
    })

    return $.html()
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

export function maskRemoteImagesForPreview(html: string): string {
    const safe = cleanupProductHtml(html)
    const $ = cheerio.load(safe, {}, false)
    $('img').each((_, element) => {
        const source = $(element).attr('src') || ''
        const label = source ? `Ảnh chờ duyệt: ${source}` : 'Ảnh chờ duyệt'
        $(element).replaceWith(`<p><strong>${label.replace(/[<>&]/g, '')}</strong></p>`)
    })
    return $.html()
}
