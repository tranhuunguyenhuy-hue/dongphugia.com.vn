import { randomUUID } from 'node:crypto'

import prisma from './database'
import { isWriteFreezeEnabled, requireWritesAllowed } from '@/lib/write-freeze'

import type { PublishingRuntimeConfig } from './config'
import { isPublishingApiError } from './errors'
import { sanitizePublishingHtml } from './html'
import { validatePublicationReadiness } from './readiness'
import { revalidatePublishingPublicSurfaces } from './revalidation'
import { writePublishingAudit } from './audit'
import { lockGlobalPublishingGate } from './authority'
import { lockPublishingIdentityAuthority } from './auth'

export type ScheduledPublicationAssessment = {
    globalGateEnabled: boolean
    identityActive: boolean
    hasPublishCapability: boolean
    scheduleVersionMatches: boolean
    readinessErrors: readonly { field: string; code: string }[]
    safetyErrorCode: string | null
}

export type ScheduledPublicationDecision =
    | { kind: 'publish' }
    | { kind: 'block'; code: string }

export function assessScheduledPublication(
    assessment: ScheduledPublicationAssessment,
): ScheduledPublicationDecision {
    if (!assessment.globalGateEnabled) {
        return { kind: 'block', code: 'PUBLISHING_GATE_CLOSED' }
    }
    if (!assessment.identityActive) {
        return { kind: 'block', code: 'IDENTITY_DISABLED' }
    }
    if (!assessment.hasPublishCapability) {
        return { kind: 'block', code: 'PUBLISH_CAPABILITY_REVOKED' }
    }
    if (!assessment.scheduleVersionMatches) {
        return { kind: 'block', code: 'SCHEDULE_VERSION_STALE' }
    }
    if (assessment.safetyErrorCode) {
        return { kind: 'block', code: assessment.safetyErrorCode }
    }
    if (assessment.readinessErrors.length) {
        return { kind: 'block', code: 'PUBLICATION_NOT_READY' }
    }
    return { kind: 'publish' }
}

function imageSources(html: string): string[] {
    const sources = new Set<string>()
    const pattern = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
    for (const match of html.matchAll(pattern)) {
        const source = match[1] ?? match[2] ?? match[3]
        if (source) sources.add(source)
    }
    return [...sources]
}

function verifyStoredSafety(
    post: {
        content: string
        thumbnail_url: string | null
        cover_image_url: string | null
        publishing_identity_id: string | null
        publishing_media: Array<{
            usage: string
            media: {
                id: string
                identity_id: string
                purpose: string
                status: string
                primary_url: string | null
            }
        }>
    },
    config: PublishingRuntimeConfig,
): {
    code: string | null
    thumbnailReady: boolean
    coverReady: boolean
    mediaReferencesValid: boolean
} {
    const linked = post.publishing_media.filter(
        ({ media }) =>
            media.identity_id === post.publishing_identity_id
            && media.status === 'ready'
            && Boolean(media.primary_url),
    )
    if (new Set(linked.map(({ media }) => media.id)).size > 20) {
        return {
            code: 'MEDIA_ASSET_LIMIT_EXCEEDED',
            thumbnailReady: false,
            coverReady: false,
            mediaReferencesValid: false,
        }
    }
    const thumbnail = linked.find(
        ({ usage, media }) =>
            usage === 'thumbnail'
            && media.purpose === 'thumbnail'
            && media.primary_url === post.thumbnail_url,
    )
    const cover = linked.find(
        ({ usage, media }) =>
            usage === 'cover'
            && media.purpose === 'cover'
            && media.primary_url === post.cover_image_url,
    )
    const inline = linked.filter(
        ({ usage, media }) => usage === 'inline' && media.purpose === 'inline',
    )
    const inlineUrls = new Set(
        inline
            .map(({ media }) => media.primary_url)
            .filter((url): url is string => Boolean(url)),
    )
    const referencesValid = imageSources(post.content).every((source) =>
        inlineUrls.has(source),
    )
    if (!referencesValid) {
        return {
            code: 'MEDIA_REFERENCE_INVALID',
            thumbnailReady: Boolean(thumbnail),
            coverReady: Boolean(cover),
            mediaReferencesValid: false,
        }
    }

    try {
        const sanitized = sanitizePublishingHtml(post.content, {
            externalLinkHostnames: config.externalLinkHostnames,
            internalLinkHostnames: config.internalLinkHostnames,
            managedImageUrls: inlineUrls,
        })
        if (sanitized !== post.content) {
            return {
                code: 'CONTENT_HTML_NOT_CANONICAL',
                thumbnailReady: Boolean(thumbnail),
                coverReady: Boolean(cover),
                mediaReferencesValid: false,
            }
        }
    } catch (error) {
        return {
            code: isPublishingApiError(error)
                ? error.code
                : 'CONTENT_HTML_UNSAFE',
            thumbnailReady: Boolean(thumbnail),
            coverReady: Boolean(cover),
            mediaReferencesValid: false,
        }
    }

    return {
        code: null,
        thumbnailReady: Boolean(thumbnail),
        coverReady: Boolean(cover),
        mediaReferencesValid: true,
    }
}

export type PublishingSchedulerResult = {
    run_id: string
    result_code: 'SUCCESS' | 'WRITE_FREEZE_ACTIVE'
    processed_count: number
    published_count: number
    blocked_count: number
}

export async function runPublishingScheduler(input: {
    config: PublishingRuntimeConfig
    now?: Date
    maxPosts?: number
}): Promise<PublishingSchedulerResult> {
    const now = input.now ?? new Date()
    const runId = randomUUID()
    if (isWriteFreezeEnabled()) {
        return {
            run_id: runId,
            result_code: 'WRITE_FREEZE_ACTIVE',
            processed_count: 0,
            published_count: 0,
            blocked_count: 0,
        }
    }

    requireWritesAllowed('publishing.scheduler.start')
    await prisma.publishing_scheduler_state.upsert({
        where: { id: 1 },
        create: {
            id: 1,
            last_started_at: now,
            last_run_id: runId,
            last_result_code: 'RUNNING',
        },
        update: {
            last_started_at: now,
            last_run_id: runId,
            last_result_code: 'RUNNING',
            updated_at: now,
        },
    })

    const due = await prisma.blog_posts.findMany({
        where: {
            status: 'scheduled',
            publishing_identity_id: { not: null },
            scheduled_for: { lte: now },
        },
        select: { id: true },
        orderBy: [{ scheduled_for: 'asc' }, { id: 'asc' }],
        take: Math.min(Math.max(input.maxPosts ?? 100, 1), 500),
    })

    let publishedCount = 0
    let blockedCount = 0
    const publishedPaths: Array<{ categorySlug: string; postSlug: string }> = []

    for (const duePost of due) {
        const outcome = await prisma.$transaction(async (transaction) => {
            const candidate = await transaction.blog_posts.findUnique({
                where: { id: duePost.id },
                select: { publishing_identity_id: true },
            })
            if (!candidate?.publishing_identity_id) {
                return { kind: 'skipped' as const }
            }
            // Use the same lock order as Publishing mutation/control actions.
            // This makes a close/revoke/disable and a scheduler transition
            // mutually exclusive at the authority decision point.
            const globalGateEnabled = await lockGlobalPublishingGate(transaction)
            await lockPublishingIdentityAuthority(
                transaction,
                candidate.publishing_identity_id,
            )
            const post = await transaction.blog_posts.findUnique({
                where: { id: duePost.id },
                include: {
                    blog_categories: { select: { is_active: true, slug: true } },
                    blog_post_tags: {
                        include: {
                            blog_tags: { select: { is_active: true } },
                        },
                    },
                    publishing_media: {
                        include: {
                            media: {
                                select: {
                                    id: true,
                                    identity_id: true,
                                    purpose: true,
                                    status: true,
                                    primary_url: true,
                                },
                            },
                        },
                    },
                    publishing_identity: {
                        include: {
                            capabilities: {
                                where: { revoked_at: null },
                                select: { capability: true },
                            },
                        },
                    },
                },
            })
            if (
                !post
                || post.status !== 'scheduled'
                || !post.scheduled_for
                || post.scheduled_for > now
                || !post.publishing_identity
            ) {
                return { kind: 'skipped' as const }
            }

            const safety = verifyStoredSafety(post, input.config)
            const readinessErrors = validatePublicationReadiness({
                title: post.title,
                excerpt: post.excerpt ?? '',
                contentHtml: post.content,
                categoryActive: post.blog_categories.is_active,
                tagsActive: post.blog_post_tags.every(
                    ({ blog_tags }) => blog_tags.is_active,
                ),
                thumbnailReady: safety.thumbnailReady,
                coverReady: safety.coverReady,
                mediaReferencesValid: safety.mediaReferencesValid,
            })
            const decision = assessScheduledPublication({
                globalGateEnabled,
                identityActive: post.publishing_identity.is_active,
                hasPublishCapability: post.publishing_identity.capabilities.some(
                    ({ capability }) => capability === 'posts:publish',
                ),
                scheduleVersionMatches: post.scheduled_version === post.version,
                readinessErrors,
                safetyErrorCode: safety.code,
            })

            const where = {
                id: post.id,
                status: 'scheduled',
                version: post.version,
                scheduled_version: post.version,
            }
            if (isWriteFreezeEnabled()) {
                return { kind: 'frozen' as const }
            }
            requireWritesAllowed('publishing.scheduler.transition')
            if (decision.kind === 'publish') {
                const updated = await transaction.blog_posts.updateMany({
                    where,
                    data: {
                        status: 'published',
                        published_at: now,
                        first_published_at: post.first_published_at ?? now,
                        scheduled_for: null,
                        scheduled_timezone: null,
                        scheduled_version: null,
                        schedule_blocked_code: null,
                        schedule_blocked_at: null,
                        schedule_last_attempt_at: now,
                        version: { increment: 1 },
                        updated_at: now,
                    },
                })
                if (updated.count !== 1) return { kind: 'skipped' as const }
                await writePublishingAudit(transaction, {
                    actorKind: 'scheduler',
                    identityId: post.publishing_identity.id,
                    sponsorUserId: post.publishing_identity.sponsor_user_id,
                    action: 'post.scheduled_published',
                    postId: post.id,
                    externalId: post.external_id ?? undefined,
                    requestId: runId,
                    fromVersion: post.version,
                    toVersion: post.version + 1,
                    fromState: 'scheduled',
                    toState: 'published',
                    changedFields: ['status', 'published_at'],
                    contentHtml: post.content,
                    metadata: { schedule_run_id: runId },
                    now,
                })
                return {
                    kind: 'published' as const,
                    categorySlug: post.blog_categories.slug,
                    postSlug: post.slug,
                }
            }

            const updated = await transaction.blog_posts.updateMany({
                where,
                data: {
                    status: 'schedule_blocked',
                    scheduled_version: null,
                    schedule_blocked_code: decision.code,
                    schedule_blocked_at: now,
                    schedule_last_attempt_at: now,
                    version: { increment: 1 },
                    updated_at: now,
                },
            })
            if (updated.count !== 1) return { kind: 'skipped' as const }
            await writePublishingAudit(transaction, {
                actorKind: 'scheduler',
                identityId: post.publishing_identity.id,
                sponsorUserId: post.publishing_identity.sponsor_user_id,
                action: 'post.schedule_blocked',
                postId: post.id,
                externalId: post.external_id ?? undefined,
                requestId: runId,
                fromVersion: post.version,
                toVersion: post.version + 1,
                fromState: 'scheduled',
                toState: 'schedule_blocked',
                changedFields: ['status', 'schedule_blocked_code'],
                contentHtml: post.content,
                metadata: { schedule_run_id: runId, block_code: decision.code },
                now,
            })
            return { kind: 'blocked' as const }
        })

        if (outcome.kind === 'published') {
            publishedCount += 1
            publishedPaths.push({
                categorySlug: outcome.categorySlug,
                postSlug: outcome.postSlug,
            })
        } else if (outcome.kind === 'blocked') {
            blockedCount += 1
        } else if (outcome.kind === 'frozen') {
            for (const path of publishedPaths) {
                revalidatePublishingPublicSurfaces(path)
            }
            return {
                run_id: runId,
                result_code: 'WRITE_FREEZE_ACTIVE',
                processed_count: 0,
                published_count: publishedCount,
                blocked_count: blockedCount,
            }
        }
    }

    for (const path of publishedPaths) {
        revalidatePublishingPublicSurfaces(path)
    }

    requireWritesAllowed('publishing.scheduler.complete')
    await prisma.publishing_scheduler_state.update({
        where: { id: 1 },
        data: {
            last_completed_at: now,
            last_success_at: now,
            last_result_code: 'SUCCESS',
            last_processed_count: due.length,
            last_published_count: publishedCount,
            last_blocked_count: blockedCount,
            updated_at: now,
        },
    })

    return {
        run_id: runId,
        result_code: 'SUCCESS',
        processed_count: due.length,
        published_count: publishedCount,
        blocked_count: blockedCount,
    }
}
