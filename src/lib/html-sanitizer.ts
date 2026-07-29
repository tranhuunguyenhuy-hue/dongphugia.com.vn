import sanitizeHtml from 'sanitize-html'

const allowedRichHtmlTags = [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'figcaption',
    'figure',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    'span',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
]

export function sanitizeRichHtml(html: string | null | undefined): string {
    if (!html) return ''

    return sanitizeHtml(html, {
        allowedTags: allowedRichHtmlTags,
        allowedAttributes: {
            a: ['href', 'name', 'target', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
            table: ['class'],
            thead: ['class'],
            tbody: ['class'],
            tr: ['class'],
            th: ['class', 'colspan', 'rowspan'],
            td: ['class', 'colspan', 'rowspan'],
            p: ['class'],
            div: ['class'],
            span: ['class'],
            figure: ['class'],
            figcaption: ['class'],
            code: ['class'],
            pre: ['class'],
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowedSchemesByTag: {
            img: ['http', 'https'],
        },
        transformTags: {
            a: sanitizeHtml.simpleTransform('a', {
                rel: 'noopener noreferrer nofollow',
                target: '_blank',
            }),
            img: sanitizeHtml.simpleTransform('img', {
                loading: 'lazy',
            }),
        },
        disallowedTagsMode: 'discard',
        enforceHtmlBoundary: true,
    })
}
