import { z } from 'zod'

import { slugify } from '@/lib/utils'

import { PublishingApiError } from './errors'

const taxonomySlug = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const mediaId = z.string().uuid()

const publication = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('draft') }).strict(),
    z.object({ mode: z.literal('publish_now') }).strict(),
    z
        .object({
            mode: z.literal('scheduled'),
            publish_at: z.string().min(1).max(100),
            publication_timezone: z.string().min(1).max(100),
        })
        .strict(),
])

const postMutationSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        slug: z.string().max(300).optional(),
        excerpt: z.string().trim().max(300).optional().default(''),
        content_html: z.string().optional().default(''),
        category_slug: taxonomySlug,
        tag_slugs: z.array(taxonomySlug).optional().default([]),
        thumbnail_media_id: mediaId.nullable().optional(),
        cover_media_id: mediaId.nullable().optional(),
        seo_title: z.string().trim().max(200).nullable().optional(),
        seo_description: z.string().trim().max(500).nullable().optional(),
        publication,
    })
    .strict()

export type PostMutationInput = z.infer<typeof postMutationSchema>
export type PublicationMode = PostMutationInput['publication']['mode']

function validationDetails(error: z.ZodError) {
    return error.issues.slice(0, 20).map((issue) => ({
        field: issue.path.join('.').slice(0, 100),
        code: issue.code.toUpperCase(),
        message: issue.message.slice(0, 300),
    }))
}

export function parsePostMutation(value: unknown): PostMutationInput {
    const parsed = postMutationSchema.safeParse(value)
    if (!parsed.success) {
        throw new PublishingApiError(
            422,
            'PAYLOAD_INVALID',
            'Request payload is invalid',
            validationDetails(parsed.error),
        )
    }

    return {
        ...parsed.data,
        tag_slugs: [...new Set(parsed.data.tag_slugs)],
    }
}

export function normalizePostSlug(value: string): string {
    const normalized = slugify(value).slice(0, 300).replace(/-+$/g, '')
    if (!normalized) {
        throw new PublishingApiError(
            422,
            'SLUG_INVALID',
            'Slug must contain letters or numbers after normalization',
            [{ field: 'slug', code: 'SLUG_INVALID' }],
        )
    }
    return normalized
}

export function parseExternalPostId(value: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._~-]{0,199}$/.test(value)) {
        throw new PublishingApiError(
            422,
            'EXTERNAL_ID_INVALID',
            'External Post ID must be URL-safe and at most 200 characters',
            [{ field: 'external_id', code: 'EXTERNAL_ID_INVALID' }],
        )
    }
    return value
}

const LIST_STATUSES = [
    'draft',
    'scheduled',
    'published',
    'schedule_blocked',
] as const

export type PublishingPostStatus = (typeof LIST_STATUSES)[number]

export type PostListCursor = { updatedAt: Date; id: number }

export function encodePostListCursor(cursor: PostListCursor): string {
    return Buffer.from(
        JSON.stringify([cursor.updatedAt.toISOString(), cursor.id]),
    ).toString('base64url')
}

export function decodePostListCursor(value: string): PostListCursor {
    try {
        const decoded: unknown = JSON.parse(
            Buffer.from(value, 'base64url').toString('utf8'),
        )
        if (
            !Array.isArray(decoded)
            || decoded.length !== 2
            || typeof decoded[0] !== 'string'
            || !Number.isInteger(decoded[1])
        ) {
            throw new Error('invalid')
        }
        const updatedAt = new Date(decoded[0])
        if (!Number.isFinite(updatedAt.getTime()) || decoded[1] < 1) {
            throw new Error('invalid')
        }
        return { updatedAt, id: decoded[1] }
    } catch {
        throw new PublishingApiError(
            422,
            'CURSOR_INVALID',
            'Pagination cursor is invalid',
            [{ field: 'cursor', code: 'CURSOR_INVALID' }],
        )
    }
}

export function parsePostListQuery(url: URL): {
    limit: number
    cursor?: PostListCursor
    status?: PublishingPostStatus
    updatedAfter?: Date
    updatedBefore?: Date
} {
    const limitValue = url.searchParams.get('limit') ?? '20'
    const limit = Number(limitValue)
    const status = url.searchParams.get('status') ?? undefined

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new PublishingApiError(
            422,
            'LIST_FILTER_INVALID',
            'List limit must be an integer from 1 to 100',
            [{ field: 'limit', code: 'LIMIT_INVALID' }],
        )
    }
    if (status && !LIST_STATUSES.includes(status as PublishingPostStatus)) {
        throw new PublishingApiError(
            422,
            'LIST_FILTER_INVALID',
            'Lifecycle status filter is invalid',
            [{ field: 'status', code: 'STATUS_INVALID' }],
        )
    }

    const parseDateFilter = (name: string) => {
        const raw = url.searchParams.get(name)
        if (!raw) return undefined
        const date = new Date(raw)
        if (!Number.isFinite(date.getTime())) {
            throw new PublishingApiError(
                422,
                'LIST_FILTER_INVALID',
                'Updated-time filter is invalid',
                [{ field: name, code: 'TIME_INVALID' }],
            )
        }
        return date
    }

    const cursor = url.searchParams.get('cursor')
    return {
        limit,
        ...(cursor ? { cursor: decodePostListCursor(cursor) } : {}),
        ...(status ? { status: status as PublishingPostStatus } : {}),
        ...(parseDateFilter('updated_after')
            ? { updatedAfter: parseDateFilter('updated_after') }
            : {}),
        ...(parseDateFilter('updated_before')
            ? { updatedBefore: parseDateFilter('updated_before') }
            : {}),
    }
}
