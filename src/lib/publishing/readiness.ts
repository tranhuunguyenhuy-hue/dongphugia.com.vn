import sanitizeHtml from 'sanitize-html'

export type PublicationReadinessInput = {
    title: string
    excerpt: string
    contentHtml: string
    categoryActive: boolean
    tagsActive: boolean
    thumbnailReady: boolean
    coverReady: boolean
    mediaReferencesValid: boolean
}

export type PublicationReadinessError = {
    field: string
    code: string
}

function visibleTextLength(html: string): number {
    return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, ' ')
        .trim().length
}

export function validatePublicationReadiness(
    input: PublicationReadinessInput,
): PublicationReadinessError[] {
    const errors: PublicationReadinessError[] = []

    if (input.title.length < 10 || input.title.length > 120) {
        errors.push({ field: 'title', code: 'TITLE_LENGTH' })
    }
    if (input.excerpt.length < 50 || input.excerpt.length > 300) {
        errors.push({ field: 'excerpt', code: 'EXCERPT_LENGTH' })
    }
    if (visibleTextLength(input.contentHtml) < 300) {
        errors.push({ field: 'content_html', code: 'VISIBLE_CONTENT_LENGTH' })
    }
    if (!input.categoryActive) {
        errors.push({ field: 'category_slug', code: 'CATEGORY_INACTIVE' })
    }
    if (!input.tagsActive) {
        errors.push({ field: 'tag_slugs', code: 'TAG_INACTIVE' })
    }
    if (!input.thumbnailReady) {
        errors.push({ field: 'thumbnail_media_id', code: 'THUMBNAIL_REQUIRED' })
    }
    if (!input.coverReady) {
        errors.push({ field: 'cover_media_id', code: 'COVER_REQUIRED' })
    }
    if (!input.mediaReferencesValid) {
        errors.push({ field: 'media_ids', code: 'MEDIA_REFERENCE_INVALID' })
    }

    return errors
}
