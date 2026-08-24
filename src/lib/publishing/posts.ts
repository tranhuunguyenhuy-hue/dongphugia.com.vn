import { Prisma } from '@prisma/client'

import prisma from './database'
import { requireWritesAllowed } from '@/lib/write-freeze'

import {
    lockPublishingMutationAuthorization,
    type PublishingAuthContext,
    type PublishingCapability,
} from './auth'
import type { PublishingRuntimeConfig } from './config'
import {
    normalizePostSlug,
    type PostMutationInput,
    type PublishingPostStatus,
} from './contracts'
import { PublishingApiError } from './errors'
import { sanitizePublishingHtml } from './html'
import {
    canonicalizePublishingMediaHtml,
    canonicalizePublishingMediaUrl,
    isPublishingMediaUrlAllowed,
    normalizePublishingMediaHtml,
    publishingMediaUrlCandidates,
} from './media-url'
import {
    hashCanonicalJson,
    runIdempotentJsonMutation,
    type PublishingTransaction,
} from './idempotency'
import {
    validatePublicationReadiness,
    type PublicationReadinessError,
} from './readiness'
import { validateScheduledPublication } from './time'
import { writePublishingAudit } from './audit'
import { lockGlobalPublishingGate } from './authority'

const MAX_SANITIZED_HTML_BYTES = 512 * 1024
const EDITORIAL_BYLINE = 'Ban Biên Tập Đông Phú Gia'

const PUBLISHING_POST_INCLUDE = Prisma.validator<Prisma.blog_postsInclude>()({
    blog_categories: {
        select: { name: true, slug: true, description: true, is_active: true },
    },
    blog_post_tags: {
        include: {
            blog_tags: {
                select: { name: true, slug: true, description: true, is_active: true },
            },
        },
    },
    publishing_media: {
        include: {
            media: {
                select: { id: true, purpose: true, primary_url: true, status: true },
            },
        },
    },
})

type StoredPost = Prisma.blog_postsGetPayload<{
    include: typeof PUBLISHING_POST_INCLUDE
}>

type ReadyMedia = {
    id: string
    purpose: string
    primary_url: string | null
    status: string
}

export type PublishingPostSummary = {
    external_id: string
    status: string
    version: number
    updated_at: string
    published_at: string | null
    scheduled_for: string | null
    scheduled_timezone: string | null
    schedule_blocked_code: string | null
}

async function lockPublicationAuthority(
    transaction: PublishingTransaction,
): Promise<boolean> {
    return lockGlobalPublishingGate(transaction)
}

function extractImageSourceCandidates(html: string): string[] {
    const sources = new Set<string>()
    const imagePattern = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
    for (const match of html.matchAll(imagePattern)) {
        const source = match[1] ?? match[2] ?? match[3]
        if (source) sources.add(source)
    }
    return [...sources]
}

function calculateReadingTime(contentHtml: string): number {
    const text = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text) return 1
    return Math.max(1, Math.ceil(text.split(' ').length / 220))
}

function mapPostSummary(post: {
    external_id: string | null
    status: string
    version: number
    updated_at: Date
    published_at: Date | null
    scheduled_for: Date | null
    scheduled_timezone: string | null
    schedule_blocked_code: string | null
}): PublishingPostSummary {
    if (!post.external_id) {
        throw new Error('Publishing post is missing External Post ID')
    }
    return {
        external_id: post.external_id,
        status: post.status,
        version: post.version,
        updated_at: post.updated_at.toISOString(),
        published_at: post.published_at?.toISOString() ?? null,
        scheduled_for: post.scheduled_for?.toISOString() ?? null,
        scheduled_timezone: post.scheduled_timezone,
        schedule_blocked_code: post.schedule_blocked_code,
    }
}

function publishingUniqueConflictTarget(error: unknown): string[] | null {
    if (
        !error
        || typeof error !== 'object'
        || !('code' in error)
        || error.code !== 'P2002'
        || !('meta' in error)
        || !error.meta
        || typeof error.meta !== 'object'
        || !('target' in error.meta)
    ) return null
    return Array.isArray(error.meta.target) ? error.meta.target : null
}

function readinessError(error: PublicationReadinessError): {
    field: string
    code: string
} {
    return error
}

async function resolveActiveTaxonomy(
    transaction: PublishingTransaction,
    input: PostMutationInput,
) {
    const [category, tags] = await Promise.all([
        transaction.blog_categories.findUnique({
            where: { slug: input.category_slug },
            select: { id: true, slug: true, is_active: true },
        }),
        input.tag_slugs.length
            ? transaction.blog_tags.findMany({
                where: { slug: { in: input.tag_slugs } },
                select: { id: true, slug: true, is_active: true },
            })
            : Promise.resolve([]),
    ])

    const errors: { field: string; code: string }[] = []
    if (!category) errors.push({ field: 'category_slug', code: 'CATEGORY_NOT_FOUND' })
    else if (!category.is_active) {
        errors.push({ field: 'category_slug', code: 'CATEGORY_INACTIVE' })
    }

    const tagsBySlug = new Map(tags.map((tag) => [tag.slug, tag]))
    for (const slug of input.tag_slugs) {
        const tag = tagsBySlug.get(slug)
        if (!tag) errors.push({ field: 'tag_slugs', code: 'TAG_NOT_FOUND' })
        else if (!tag.is_active) {
            errors.push({ field: 'tag_slugs', code: 'TAG_INACTIVE' })
        }
    }
    if (errors.length) {
        throw new PublishingApiError(
            422,
            'TAXONOMY_INVALID',
            'Category or Blog Tag is not active',
            errors,
        )
    }
    return { category: category!, tags }
}

async function resolveManagedMedia(
    transaction: PublishingTransaction,
    identityId: string,
    input: PostMutationInput,
): Promise<{
    thumbnail: ReadyMedia | null
    cover: ReadyMedia | null
    inline: ReadyMedia[]
}> {
    const imageSources = extractImageSourceCandidates(input.content_html)
    const imageSourceCandidates = [
        ...new Set(imageSources.flatMap(publishingMediaUrlCandidates)),
    ]
    const ids = [input.thumbnail_media_id, input.cover_media_id].filter(
        (value): value is string => Boolean(value),
    )
    const media = await transaction.publishing_managed_media.findMany({
        where: {
            identity_id: identityId,
            status: 'ready',
            OR: [
                ...(ids.length ? [{ id: { in: ids } }] : []),
                ...(imageSourceCandidates.length
                    ? [{ primary_url: { in: imageSourceCandidates } }]
                    : []),
            ],
        },
        select: {
            id: true,
            purpose: true,
            primary_url: true,
            status: true,
        },
    })
    const readyMedia = media as ReadyMedia[]
    const byId = new Map(readyMedia.map((item) => [item.id, item]))
    const byUrl = new Map(
        readyMedia
            .flatMap((item) =>
                publishingMediaUrlCandidates(item.primary_url)
                    .map((url) => [url, item] as const),
            ),
    )
    const thumbnail = input.thumbnail_media_id
        ? byId.get(input.thumbnail_media_id) ?? null
        : null
    const cover = input.cover_media_id
        ? byId.get(input.cover_media_id) ?? null
        : null
    const inline = imageSources
        .map((source) => byUrl.get(source))
        .filter(
            (item): item is ReadyMedia & { primary_url: string } =>
                Boolean(item),
        )

    const errors: { field: string; code: string }[] = []
    if (
        input.thumbnail_media_id
        && (
            !thumbnail
            || thumbnail.purpose !== 'thumbnail'
            || !isPublishingMediaUrlAllowed(thumbnail.primary_url)
        )
    ) {
        errors.push({ field: 'thumbnail_media_id', code: 'THUMBNAIL_MEDIA_INVALID' })
    }
    if (
        input.cover_media_id
        && (
            !cover
            || cover.purpose !== 'cover'
            || !isPublishingMediaUrlAllowed(cover.primary_url)
        )
    ) {
        errors.push({ field: 'cover_media_id', code: 'COVER_MEDIA_INVALID' })
    }
    if (inline.length !== imageSources.length || inline.some((item) => item.purpose !== 'inline')) {
        errors.push({ field: 'content_html', code: 'MEDIA_REFERENCE_INVALID' })
    }
    const distinctAssetIds = new Set(
        [thumbnail, cover, ...inline].filter(
            (item): item is ReadyMedia => Boolean(item),
        ).map(({ id }) => id),
    )
    if (distinctAssetIds.size > 20) {
        errors.push({ field: 'media_ids', code: 'MEDIA_ASSET_LIMIT_EXCEEDED' })
    }
    if (errors.length) {
        throw new PublishingApiError(
            422,
            'MEDIA_REFERENCE_INVALID',
            'Managed Media references are invalid',
            errors,
        )
    }
    return { thumbnail, cover, inline }
}

function validateDraftHtml(
    input: PostMutationInput,
    config: PublishingRuntimeConfig,
    media: { inline: ReadyMedia[] },
): string {
    const sanitized = sanitizePublishingHtml(
        normalizePublishingMediaHtml(input.content_html),
        {
            externalLinkHostnames: config.externalLinkHostnames,
            internalLinkHostnames: config.internalLinkHostnames,
            managedImageUrls: new Set(
                media.inline.flatMap(({ primary_url }) =>
                    publishingMediaUrlCandidates(primary_url),
                ),
            ),
        },
    )
    if (Buffer.byteLength(sanitized, 'utf8') > MAX_SANITIZED_HTML_BYTES) {
        throw new PublishingApiError(
            422,
            'HTML_TOO_LARGE',
            'Sanitized HTML exceeds the 512 KiB limit',
            [{ field: 'content_html', code: 'HTML_TOO_LARGE' }],
        )
    }
    return sanitized
}

function requirePublicationAuthority(
    publishingEnabled: boolean,
) {
    if (!publishingEnabled) {
        throw new PublishingApiError(
            503,
            'PUBLISHING_GATE_CLOSED',
            'Global Publishing Gate is closed',
            undefined,
            60,
        )
    }
}

async function replacePostMedia(
    transaction: PublishingTransaction,
    postId: number,
    media: { thumbnail: ReadyMedia | null; cover: ReadyMedia | null; inline: ReadyMedia[] },
) {
    const records = [
        ...(media.thumbnail ? [{ media_id: media.thumbnail.id, usage: 'thumbnail' }] : []),
        ...(media.cover ? [{ media_id: media.cover.id, usage: 'cover' }] : []),
        ...[...new Map(media.inline.map((item) => [item.id, item])).values()].map(
            (item) => ({ media_id: item.id, usage: 'inline' }),
        ),
    ]
    await transaction.publishing_blog_post_media.deleteMany({ where: { post_id: postId } })
    if (records.length) {
        await transaction.publishing_blog_post_media.createMany({
            data: records.map((record) => ({ post_id: postId, ...record })),
        })
    }
}

async function replacePostTags(
    transaction: PublishingTransaction,
    postId: number,
    tagIds: number[],
) {
    const oldTags = await transaction.blog_post_tags.findMany({
        where: { post_id: postId },
        select: { tag_id: true },
    })
    await transaction.blog_post_tags.deleteMany({ where: { post_id: postId } })
    if (tagIds.length) {
        await transaction.blog_post_tags.createMany({
            data: tagIds.map((tag_id) => ({ post_id: postId, tag_id })),
        })
    }
    const affectedTagIds = [...new Set([...oldTags.map(({ tag_id }) => tag_id), ...tagIds])]
    if (affectedTagIds.length) {
        await transaction.$executeRaw(
            Prisma.sql`
                UPDATE blog_tags
                SET post_count = (
                    SELECT COUNT(*)
                    FROM blog_post_tags
                    WHERE blog_post_tags.tag_id = blog_tags.id
                )
                WHERE id IN (${Prisma.join(affectedTagIds)})
            `,
        )
    }
}

function readinessOrThrow(
    input: PostMutationInput,
    sanitizedHtml: string,
    taxonomy: { category: { is_active: boolean }; tags: { is_active: boolean }[] },
    media: { thumbnail: ReadyMedia | null; cover: ReadyMedia | null },
) {
    const errors = validatePublicationReadiness({
        title: input.title,
        excerpt: input.excerpt,
        contentHtml: sanitizedHtml,
        categoryActive: taxonomy.category.is_active,
        tagsActive: taxonomy.tags.every(({ is_active }) => is_active),
        thumbnailReady: Boolean(media.thumbnail),
        coverReady: Boolean(media.cover),
        mediaReferencesValid: true,
    })
    if (errors.length) {
        throw new PublishingApiError(
            422,
            'PUBLICATION_NOT_READY',
            'Blog Post does not satisfy the Publication Readiness Gate',
            errors.map(readinessError),
        )
    }
}

function changedFields(input: PostMutationInput): string[] {
    return [
        'title',
        'slug',
        'excerpt',
        'content_html',
        'category_slug',
        'tag_slugs',
        'thumbnail_media_id',
        'cover_media_id',
        'seo_title',
        'seo_description',
        `publication.${input.publication.mode}`,
    ]
}

async function loadOwnedPost(
    transaction: PublishingTransaction,
    identityId: string,
    externalId: string,
): Promise<StoredPost | null> {
    return transaction.blog_posts.findUnique({
        where: {
            publishing_identity_id_external_id: {
                publishing_identity_id: identityId,
                external_id: externalId,
            },
        },
        include: PUBLISHING_POST_INCLUDE,
    })
}

export async function mutatePublishingPost(input: {
    auth: PublishingAuthContext
    externalId: string
    mutation: PostMutationInput
    idempotencyKey: string
    requestId: string
    create: boolean
    expectedVersion?: number
    config: PublishingRuntimeConfig
    now?: Date
}): Promise<{ status: number; body: PublishingPostSummary; replayed: boolean }> {
    requireWritesAllowed('publishing.posts.mutate')
    const now = input.now ?? new Date()
    const request = {
        external_id: input.externalId,
        mutation: input.mutation,
        ...(input.create ? { create: true } : { expected_version: input.expectedVersion }),
    }

    try {
        return await runIdempotentJsonMutation(
            {
                identityId: input.auth.identity.id,
                key: input.idempotencyKey,
                operation: 'posts.put',
                request,
                now,
            },
            async (transaction, idempotency) => {
                const current = await loadOwnedPost(
                    transaction,
                    input.auth.identity.id,
                    input.externalId,
                )
                if (input.create && current) {
                    throw new PublishingApiError(
                        412,
                        'POST_ALREADY_EXISTS',
                        'External Post ID already exists for this Machine Identity',
                    )
                }
                if (!input.create && !current) {
                    throw new PublishingApiError(
                        404,
                        'POST_NOT_FOUND',
                        'External Post ID was not found for this Machine Identity',
                    )
                }
                if (!input.create && input.expectedVersion !== current!.version) {
                    throw new PublishingApiError(
                        412,
                        'POST_VERSION_STALE',
                        'If-Match does not match the current Post Version',
                    )
                }

                const taxonomy = await resolveActiveTaxonomy(transaction, input.mutation)
                const media = await resolveManagedMedia(
                    transaction,
                    input.auth.identity.id,
                    input.mutation,
                )
                const sanitizedHtml = validateDraftHtml(
                    input.mutation,
                    input.config,
                    media,
                )
                const slug = normalizePostSlug(
                    input.mutation.slug ?? input.mutation.title,
                )
                const currentIsLive = current?.status === 'published'
                const currentIsScheduled = current?.status === 'scheduled'
                const requiresPublication =
                    input.mutation.publication.mode !== 'draft'
                    || currentIsLive
                    || currentIsScheduled
                const requiredCapabilities: PublishingCapability[] = ['posts:write']
                let publishingEnabled = false
                if (requiresPublication) {
                    publishingEnabled = await lockPublicationAuthority(transaction)
                    requiredCapabilities.push('posts:publish')
                }
                await lockPublishingMutationAuthorization(transaction, {
                    credentialId: input.auth.credentialId,
                    identityId: input.auth.identity.id,
                    environment: input.config.environment,
                    requiredCapabilities,
                    clientIp: input.auth.clientIp,
                })
                requireWritesAllowed('publishing.posts.commit')

                if (current?.first_published_at) {
                    if (slug !== current.slug) {
                        throw new PublishingApiError(
                            422,
                            'SLUG_IMMUTABLE',
                            'Slug cannot change after first publication',
                        )
                    }
                    if (taxonomy.category.id !== current.category_id) {
                        throw new PublishingApiError(
                            422,
                            'CATEGORY_IMMUTABLE',
                            'Blog Category cannot change after first publication',
                        )
                    }
                }

                if (currentIsLive) {
                    if (input.mutation.publication.mode !== 'publish_now') {
                        throw new PublishingApiError(
                            422,
                            'LIVE_POST_REPLACEMENT_UNSUPPORTED',
                            'A live Blog Post can only be atomically replaced with publish_now',
                        )
                    }
                    requirePublicationAuthority(publishingEnabled)
                }

                let status: PublishingPostStatus = 'draft'
                let scheduledFor: Date | null = null
                let scheduledTimezone: string | null = null
                let publishedAt: Date | null = current?.published_at ?? null
                let firstPublishedAt: Date | null = current?.first_published_at ?? null
                if (input.mutation.publication.mode === 'publish_now') {
                    requirePublicationAuthority(publishingEnabled)
                    readinessOrThrow(input.mutation, sanitizedHtml, taxonomy, media)
                    status = 'published'
                    publishedAt ??= now
                    firstPublishedAt ??= now
                } else if (input.mutation.publication.mode === 'scheduled') {
                    requirePublicationAuthority(publishingEnabled)
                    readinessOrThrow(input.mutation, sanitizedHtml, taxonomy, media)
                    const schedule = validateScheduledPublication(
                        {
                            publishAt: input.mutation.publication.publish_at,
                            publicationTimezone:
                                input.mutation.publication.publication_timezone,
                        },
                        now,
                    )
                    status = 'scheduled'
                    scheduledFor = schedule.scheduledFor
                    scheduledTimezone = schedule.scheduledTimezone
                    publishedAt = null
                }

                const postData = {
                    title: input.mutation.title,
                    slug,
                    excerpt: input.mutation.excerpt || null,
                    content: sanitizedHtml,
                    category_id: taxonomy.category.id,
                    thumbnail_url: canonicalizePublishingMediaUrl(
                        media.thumbnail?.primary_url,
                    ),
                    cover_image_url: canonicalizePublishingMediaUrl(
                        media.cover?.primary_url,
                    ),
                    seo_title: input.mutation.seo_title || null,
                    seo_description: input.mutation.seo_description || null,
                    reading_time: calculateReadingTime(sanitizedHtml),
                    status,
                    published_at: publishedAt,
                    first_published_at: firstPublishedAt,
                    scheduled_for: scheduledFor,
                    scheduled_timezone: scheduledTimezone,
                    schedule_blocked_code: null,
                    schedule_blocked_at: null,
                    schedule_last_attempt_at: null,
                    author_name: EDITORIAL_BYLINE,
                    updated_at: now,
                }

                let post: {
                    id: number
                    external_id: string | null
                    status: string
                    version: number
                    updated_at: Date
                    published_at: Date | null
                    scheduled_for: Date | null
                    scheduled_timezone: string | null
                    schedule_blocked_code: string | null
                }
                if (!current) {
                    post = await transaction.blog_posts.create({
                        data: {
                            ...postData,
                            publishing_identity_id: input.auth.identity.id,
                            external_id: input.externalId,
                            version: 1,
                            scheduled_version: status === 'scheduled' ? 1 : null,
                        },
                    })
                } else {
                    const nextVersion = current.version + 1
                    const updated = await transaction.blog_posts.updateMany({
                        where: { id: current.id, version: current.version },
                        data: {
                            ...postData,
                            version: nextVersion,
                            scheduled_version:
                                status === 'scheduled' ? nextVersion : null,
                        },
                    })
                    if (updated.count !== 1) {
                        throw new PublishingApiError(
                            412,
                            'POST_VERSION_STALE',
                            'Blog Post changed while this mutation was processed',
                        )
                    }
                    post = {
                        id: current.id,
                        external_id: current.external_id,
                        status,
                        version: nextVersion,
                        updated_at: now,
                        published_at: publishedAt,
                        scheduled_for: scheduledFor,
                        scheduled_timezone: scheduledTimezone,
                        schedule_blocked_code: null,
                    }
                }

                await replacePostTags(
                    transaction,
                    post.id,
                    taxonomy.tags.map(({ id }) => id),
                )
                await replacePostMedia(transaction, post.id, media)
                await writePublishingAudit(transaction, {
                    actorKind: 'machine',
                    identityId: input.auth.identity.id,
                    sponsorUserId: input.auth.identity.sponsorUserId,
                    action: current ? 'post.updated' : 'post.created',
                    postId: post.id,
                    externalId: input.externalId,
                    requestId: input.requestId,
                    idempotencyKeyHash: idempotency.keyHash,
                    fromVersion: current?.version,
                    toVersion: post.version,
                    fromState: current?.status,
                    toState: post.status,
                    changedFields: changedFields(input.mutation),
                    contentHtml: sanitizedHtml,
                    metadata: {
                        request_hash: hashCanonicalJson(request),
                        publication_mode: input.mutation.publication.mode,
                    },
                    now,
                })

                return {
                    status: current ? 200 : 201,
                    body: mapPostSummary(post),
                    resourceType: 'blog_post',
                    resourceId: String(post.id),
                }
            },
        )
    } catch (error) {
        const target = publishingUniqueConflictTarget(error)
        if (target?.includes('slug')) {
            throw new PublishingApiError(
                409,
                'SLUG_CONFLICT',
                'Proposed slug is already in use',
                [{ field: 'slug', code: 'SLUG_CONFLICT' }],
            )
        }
        if (
            target?.includes('publishing_identity_id')
            && target.includes('external_id')
        ) {
            throw new PublishingApiError(
                412,
                'POST_ALREADY_EXISTS',
                'External Post ID already exists for this Machine Identity',
            )
        }
        throw error
    }
}

export function mapPublishingPost(post: StoredPost) {
    const summary = mapPostSummary(post)
    return {
        ...summary,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? '',
        content_html: canonicalizePublishingMediaHtml(post.content),
        category: {
            name: post.blog_categories.name,
            slug: post.blog_categories.slug,
            description: post.blog_categories.description,
        },
        tags: post.blog_post_tags.map(({ blog_tags }) => ({
            name: blog_tags.name,
            slug: blog_tags.slug,
            description: blog_tags.description,
        })),
        thumbnail_url: canonicalizePublishingMediaUrl(post.thumbnail_url),
        cover_image_url: canonicalizePublishingMediaUrl(post.cover_image_url),
        seo_title: post.seo_title,
        seo_description: post.seo_description,
        reading_time: post.reading_time,
        byline: EDITORIAL_BYLINE,
    }
}

export async function getPublishingPost(
    identityId: string,
    externalId: string,
) {
    const post = await prisma.blog_posts.findUnique({
        where: {
            publishing_identity_id_external_id: {
                publishing_identity_id: identityId,
                external_id: externalId,
            },
        },
        include: PUBLISHING_POST_INCLUDE,
    })
    if (!post) {
        throw new PublishingApiError(
            404,
            'POST_NOT_FOUND',
            'External Post ID was not found for this Machine Identity',
        )
    }
    return mapPublishingPost(post)
}

export async function listPublishingPosts(input: {
    identityId: string
    limit: number
    cursor?: { updatedAt: Date; id: number }
    status?: PublishingPostStatus
    updatedAfter?: Date
    updatedBefore?: Date
}) {
    const where: Prisma.blog_postsWhereInput = {
        publishing_identity_id: input.identityId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.updatedAfter || input.updatedBefore
            ? {
                updated_at: {
                    ...(input.updatedAfter ? { gt: input.updatedAfter } : {}),
                    ...(input.updatedBefore ? { lte: input.updatedBefore } : {}),
                },
            }
            : {}),
        ...(input.cursor
            ? {
                OR: [
                    { updated_at: { lt: input.cursor.updatedAt } },
                    {
                        updated_at: input.cursor.updatedAt,
                        id: { lt: input.cursor.id },
                    },
                ],
            }
            : {}),
    }
    const posts = await prisma.blog_posts.findMany({
        where,
        orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        select: {
            id: true,
            external_id: true,
            status: true,
            version: true,
            updated_at: true,
            published_at: true,
            scheduled_for: true,
            scheduled_timezone: true,
            schedule_blocked_code: true,
        },
    })
    const hasNextPage = posts.length > input.limit
    const page = hasNextPage ? posts.slice(0, input.limit) : posts
    const next = hasNextPage ? page[page.length - 1] : undefined
    return {
        items: page.map(mapPostSummary),
        next_cursor: next
            ? Buffer.from(
                JSON.stringify([next.updated_at.toISOString(), next.id]),
            ).toString('base64url')
            : null,
    }
}
