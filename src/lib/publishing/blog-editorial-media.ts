import type { Prisma } from '@prisma/client'

import {
    canonicalizePublishingMediaUrl,
    normalizePublishingMediaHtml,
    publishingMediaUrlCandidates,
} from './media-url'

const IMAGE_SOURCE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
const IMAGE_SRCSET_PATTERN = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi

export type BlogEditorialMediaInput = {
    content: string
    thumbnailUrl: string | null | undefined
    coverImageUrl: string | null | undefined
}

export type BlogEditorialMediaNormalization = {
    content: string
    thumbnailUrl: string | null
    coverImageUrl: string | null
    references: string[]
    productReferences: string[]
}

export function extractBlogEditorialImageReferences(input: BlogEditorialMediaInput): string[] {
    const references = new Set<string>()
    for (const value of [input.thumbnailUrl, input.coverImageUrl]) {
        if (value?.trim()) references.add(value.trim())
    }
    for (const match of input.content.matchAll(IMAGE_SOURCE_PATTERN)) {
        const source = match[1] ?? match[2] ?? match[3]
        if (source?.trim()) references.add(source.trim())
    }
    for (const match of input.content.matchAll(IMAGE_SRCSET_PATTERN)) {
        const value = match[1] ?? match[2] ?? ''
        for (const candidate of value.split(',')) {
            const source = candidate.trim().split(/\s+/)[0]
            if (source) references.add(source)
        }
    }
    return [...references]
}

export function replaceBlogEditorialMediaReferences(
    input: BlogEditorialMediaInput,
    replacements: ReadonlyMap<string, string>,
): BlogEditorialMediaInput {
    const replace = (value: string | null | undefined) => {
        if (!value) return value ?? null
        return replacements.get(value) ?? replacements.get(value.trim()) ?? value
    }

    const content = input.content
        .replace(IMAGE_SOURCE_PATTERN, (match, first, second, third) => {
            const source = first ?? second ?? third
            const replacement = replacements.get(source) ?? replacements.get(source?.trim())
            if (!replacement) return match
            return match.replace(source, replacement)
        })
        .replace(IMAGE_SRCSET_PATTERN, (match, first, second) => {
            const value = first ?? second ?? ''
            const rewritten = value.split(',').map((candidate: string) => {
                const parts = candidate.trim().split(/\s+/)
                const replacement = replacements.get(parts[0]) ?? replacements.get(parts[0]?.trim())
                if (!replacement) return candidate
                parts[0] = replacement
                return parts.join(' ')
            }).join(', ')
            return match.replace(value, rewritten)
        })

    return {
        content,
        thumbnailUrl: replace(input.thumbnailUrl),
        coverImageUrl: replace(input.coverImageUrl),
    }
}

type MediaRecord = { id: string; purpose: string; primary_url: string | null; status: string }

export async function normalizeHumanBlogEditorialMedia(
    transaction: Prisma.TransactionClient,
    input: BlogEditorialMediaInput,
): Promise<BlogEditorialMediaNormalization> {
    const references = extractBlogEditorialImageReferences(input)
    if (!references.length) {
        return {
            content: input.content,
            thumbnailUrl: input.thumbnailUrl?.trim() || null,
            coverImageUrl: input.coverImageUrl?.trim() || null,
            references,
            productReferences: [],
        }
    }

    const productRows = await transaction.product_images.findMany({
        where: { image_url: { in: references } },
        select: { image_url: true },
    })
    const productMainRows = await transaction.products.findMany({
        where: { image_main_url: { in: references } },
        select: { image_main_url: true },
    })
    const productReferences = new Set([
        ...productRows.map(({ image_url }) => image_url),
        ...productMainRows.flatMap(({ image_main_url }) => image_main_url ? [image_main_url] : []),
    ])

    const managedCandidates = [...new Set(
        references.flatMap((reference) => publishingMediaUrlCandidates(reference)),
    )]
    const managed = managedCandidates.length
        ? await transaction.publishing_managed_media.findMany({
            where: {
                status: 'ready',
                identity: { is_active: true },
                primary_url: { in: managedCandidates },
            },
            select: { id: true, purpose: true, primary_url: true, status: true },
        })
        : []
    const managedByCandidate = new Map<string, MediaRecord>()
    for (const record of managed) {
        for (const candidate of publishingMediaUrlCandidates(record.primary_url)) {
            managedByCandidate.set(candidate, record)
        }
    }

    const replacements = new Map<string, string>()
    const unknown: string[] = []
    const mediaIds = new Set<string>()
    for (const reference of references) {
        if (productReferences.has(reference)) continue
        const record = managedByCandidate.get(reference)
        const canonical = canonicalizePublishingMediaUrl(record?.primary_url ?? reference)
        const expectedPurpose = reference === input.thumbnailUrl
            ? 'thumbnail'
            : reference === input.coverImageUrl
                ? 'cover'
                : 'inline'
        if (!record || record.purpose !== expectedPurpose || !canonical) {
            unknown.push(reference)
            continue
        }
        replacements.set(reference, canonical)
        mediaIds.add(record.id)
    }
    if (mediaIds.size > 20) {
        unknown.push('asset-limit-exceeded')
    }
    if (unknown.length) {
        throw new Error('Blog editorial image writes require ready Managed Media or an exact Product media relation')
    }

    const normalized = replaceBlogEditorialMediaReferences(input, replacements)
    return {
        content: normalizePublishingMediaHtml(normalized.content),
        thumbnailUrl: normalized.thumbnailUrl ? normalizePublishingMediaHtml(normalized.thumbnailUrl) : null,
        coverImageUrl: normalized.coverImageUrl ? normalizePublishingMediaHtml(normalized.coverImageUrl) : null,
        references,
        productReferences: [...productReferences],
    }
}
