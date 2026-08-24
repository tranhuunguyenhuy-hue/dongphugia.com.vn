/**
 * Private, audited Blog editorial media importer.
 *
 * This command is intentionally opt-in and dry-run by default. It inventories
 * every Blog image reference, excludes exact Product relations, validates
 * licensed sources through the same image processor as Publishing Managed
 * Media, then (with explicit confirmation) uploads and rewrites only Blog
 * editorial references. Legacy source objects are never deleted.
 */
import { createHash, randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import https from 'node:https'

import prisma from '../../src/lib/prisma'
import { requireWritesAllowed } from '../../src/lib/write-freeze'
import { processPublishingImage } from '../../src/lib/publishing/media'
import { uploadPublishingMedia } from '../../src/lib/publishing/media-upload'
import { getPublishingRuntimeConfig } from '../../src/lib/publishing/config'
import { mutatePublishingPost } from '../../src/lib/publishing/posts'
import { writePublishingAudit } from '../../src/lib/publishing/audit'
import {
    canonicalizePublishingMediaUrl,
    getCanonicalPublishingCdnHostname,
    publishingMediaUrlCandidates,
} from '../../src/lib/publishing/media-url'
import {
    extractBlogEditorialImageReferences,
    replaceBlogEditorialMediaReferences,
    type BlogEditorialMediaInput,
} from '../../src/lib/publishing/blog-editorial-media'

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3

type Flags = Map<string, string>
type Purpose = 'thumbnail' | 'cover' | 'inline'

type InventoryRow = {
    postId: number
    role: string
    referenceHash: string
    hostname: string | null
    classification: 'product' | 'managed' | 'external' | 'invalid'
}

function parseFlags(argv: string[]): Flags {
    const flags = new Map<string, string>()
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i]
        if (!key?.startsWith('--')) throw new Error('Arguments must use --key value')
        const value = argv[i + 1]
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`)
        flags.set(key.slice(2), value)
        i += 1
    }
    return flags
}

function required(flags: Flags, name: string): string {
    const value = flags.get(name)
    if (!value) throw new Error(`--${name} is required`)
    return value
}

function bool(flags: Flags, name: string): boolean {
    return flags.get(name) === 'yes'
}

function positiveInt(flags: Flags, name: string, fallback: number): number {
    const value = flags.get(name)
    if (!value) return fallback
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`--${name} must be positive`)
    return parsed
}

function sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex')
}

function safeHostname(value: string): string | null {
    try { return new URL(value).hostname.toLowerCase() } catch { return null }
}

function privateAddress(address: string): boolean {
    if (isIP(address) === 4) {
        const octets = address.split('.').map(Number)
        return octets[0] === 0
            || octets[0] === 10
            || octets[0] === 127
            || (octets[0] === 169 && octets[1] === 254)
            || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] === 192 && octets[1] === 168)
    }
    const normalized = address.toLowerCase()
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mappedIpv4) return privateAddress(mappedIpv4[1])
    return normalized === '::1'
        || normalized.startsWith('fc')
        || normalized.startsWith('fd')
        || normalized.startsWith('fe80:')
        || normalized.startsWith('::ffff:10.')
        || normalized.startsWith('::ffff:192.168.')
}

async function resolveSafeRemote(url: URL): Promise<{ address: string; family: 4 | 6 }> {
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
        throw new Error('Only credential-free HTTPS sources on the default port are accepted')
    }
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
        throw new Error('Private hostnames are not accepted')
    }
    const addresses = isIP(url.hostname)
        ? [{ address: url.hostname, family: isIP(url.hostname) as 4 | 6 }]
        : await lookup(url.hostname, { all: true })
    const safe = addresses.find(({ address }) => !privateAddress(address))
    if (!safe || addresses.some(({ address }) => privateAddress(address))) {
        throw new Error('Source resolves to a private or loopback address')
    }
    return { address: safe.address, family: safe.family as 4 | 6 }
}

async function downloadSource(source: string): Promise<{ bytes: Buffer; mime: string; finalUrl: string }> {
    let current = new URL(source)
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        const resolved = await resolveSafeRemote(current)
        const response = await new Promise<{ status: number; headers: Headers; body: AsyncIterable<Buffer> }>((resolveResponse, reject) => {
            const request = https.request({
                hostname: resolved.address,
                servername: current.hostname,
                port: 443,
                path: `${current.pathname}${current.search}`,
                method: 'GET',
                headers: {
                    host: current.host,
                    accept: 'image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1',
                },
                lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
                rejectUnauthorized: true,
            }, (res) => {
                const headers = new Headers()
                for (const [key, value] of Object.entries(res.headers)) {
                    if (typeof value === 'string') headers.set(key, value)
                    else if (Array.isArray(value)) headers.set(key, value.join(', '))
                }
                resolveResponse({ status: res.statusCode ?? 0, headers, body: res as unknown as AsyncIterable<Buffer> })
            })
            request.on('error', reject)
            request.end()
        })
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location')
            if (!location || redirect === MAX_REDIRECTS) throw new Error('Redirect limit exceeded')
            current = new URL(location, current)
            continue
        }
        if (!response.ok || !response.body) throw new Error(`Source returned HTTP ${response.status}`)
        const mime = (response.headers.get('content-type')?.split(';')[0] ?? '').toLowerCase()
        if (!mime.startsWith('image/')) throw new Error('Source did not return an image MIME type')
        const declaredLength = Number(response.headers.get('content-length'))
        if (Number.isSafeInteger(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
            throw new Error('Source exceeds the image byte limit')
        }
        const chunks: Buffer[] = []
        let total = 0
        for await (const chunk of response.body) {
            const buffer = Buffer.from(chunk)
            total += buffer.byteLength
            if (total > MAX_SOURCE_BYTES) throw new Error('Source exceeds the image byte limit')
            chunks.push(buffer)
        }
        return { bytes: Buffer.concat(chunks), mime, finalUrl: current.toString() }
    }
    throw new Error('Source redirect validation failed')
}

function emit(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function revalidatePublicSurfaces(
    baseUrl: string,
    token: string,
    post: { categorySlug: string; postSlug: string },
): Promise<void> {
    const response = await fetch(new URL('/api/internal/blog-revalidation', baseUrl), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-publishing-scheduler-token': token,
        },
        body: JSON.stringify({ posts: [post] }),
    })
    if (!response.ok) throw new Error('Blog cache revalidation endpoint did not acknowledge the mutation')
}

async function main(): Promise<void> {
    const flags = parseFlags(process.argv.slice(2))
    const apply = bool(flags, 'apply')
    if (apply && flags.get('confirm') !== 'yes') {
        throw new Error('Applying the migration requires --confirm yes')
    }
    const manifestPath = resolve(required(flags, 'manifest-path'))
    const limit = positiveInt(flags, 'limit', 2)
    const offset = Number(flags.get('offset') ?? '0')
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('--offset must be zero or greater')

    const [posts] = await Promise.all([
        prisma.blog_posts.findMany({
            orderBy: { id: 'asc' },
            ...(apply ? { skip: offset, take: limit } : {}),
            select: {
                id: true, title: true, slug: true, content: true,
                thumbnail_url: true, cover_image_url: true,
                status: true, version: true, published_at: true,
                scheduled_for: true, scheduled_timezone: true,
                publishing_identity_id: true, external_id: true,
                author_name: true, excerpt: true, seo_title: true,
                seo_description: true, category_id: true,
                blog_categories: { select: { slug: true } },
                blog_post_tags: { include: { blog_tags: { select: { slug: true } } } },
                publishing_media: {
                    include: { media: { select: { id: true, purpose: true, primary_url: true, status: true } } },
                },
            },
        }),
    ])
    const productImages: { image_url: string }[] = []
    for (let skip = 0; ; skip += 1000) {
        const page = await prisma.product_images.findMany({ skip, take: 1000, select: { image_url: true } })
        productImages.push(...page)
        if (page.length < 1000) break
    }
    const productMainImages: { image_main_url: string | null }[] = []
    for (let skip = 0; ; skip += 1000) {
        const page = await prisma.products.findMany({ skip, take: 1000, where: { image_main_url: { not: null } }, select: { image_main_url: true } })
        productMainImages.push(...page)
        if (page.length < 1000) break
    }
    const productSet = new Set([
        ...productImages.map(({ image_url }) => image_url),
        ...productMainImages.flatMap(({ image_main_url }) => image_main_url ? [image_main_url] : []),
    ])
    const canonicalHost = getCanonicalPublishingCdnHostname()
    const managedHosts = new Set([canonicalHost, 'dpg-publishing-production.b-cdn.net', 'dpg-publishing-staging.b-cdn.net'])
    const allReferences = [...new Set(posts.flatMap((post) => extractBlogEditorialImageReferences({
        content: post.content,
        thumbnailUrl: post.thumbnail_url,
        coverImageUrl: post.cover_image_url,
    })))]
    const managedCandidates = [...new Set(allReferences.flatMap(publishingMediaUrlCandidates))]
    const readyManagedMedia = managedCandidates.length
        ? await prisma.publishing_managed_media.findMany({
            where: { status: 'ready', primary_url: { in: managedCandidates } },
            select: { id: true, purpose: true, primary_url: true },
        })
        : []
    const managedReferencePurpose = new Map<string, string>()
    for (const media of readyManagedMedia) {
        for (const candidate of publishingMediaUrlCandidates(media.primary_url)) {
            managedReferencePurpose.set(candidate, media.purpose)
        }
    }
    const rows: InventoryRow[] = []
    const sourceToPosts = new Map<string, Set<number>>()
    const sourcePurposes = new Map<string, Set<Purpose>>()
    for (const post of posts) {
        const input: BlogEditorialMediaInput = {
            content: post.content,
            thumbnailUrl: post.thumbnail_url,
            coverImageUrl: post.cover_image_url,
        }
        const refs = extractBlogEditorialImageReferences(input)
        for (const reference of refs) {
            const host = safeHostname(reference)
            const expectedPurpose = reference === post.thumbnail_url
                ? 'thumbnail'
                : reference === post.cover_image_url
                    ? 'cover'
                    : 'inline'
            const classification = productSet.has(reference)
                ? 'product'
                : host && managedHosts.has(host) && managedReferencePurpose.get(reference) === expectedPurpose
                    ? 'managed'
                    : host && managedHosts.has(host)
                        ? 'invalid'
                    : host && reference.startsWith('https://')
                        ? 'external'
                        : 'invalid'
            rows.push({ postId: post.id, role: 'editorial-image', referenceHash: sha256(reference), hostname: host, classification })
            if (classification === 'external') {
                const set = sourceToPosts.get(reference) ?? new Set<number>()
                set.add(post.id)
                sourceToPosts.set(reference, set)
                const purposes = sourcePurposes.get(reference) ?? new Set<Purpose>()
                if (reference === post.thumbnail_url) purposes.add('thumbnail')
                if (reference === post.cover_image_url) purposes.add('cover')
                if (!purposes.size) purposes.add('inline')
                sourcePurposes.set(reference, purposes)
            }
        }
    }
    if (!apply) {
        await mkdir(dirname(manifestPath), { recursive: true })
        await writeFile(manifestPath, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), { mode: 0o600 })
        await chmod(manifestPath, 0o600)
    } else {
        const planned = (await readFile(manifestPath, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as InventoryRow)
        const plannedKeys = new Set(planned.map((row) => `${row.postId}:${row.referenceHash}:${row.classification}`))
        const currentKeys = rows.map((row) => `${row.postId}:${row.referenceHash}:${row.classification}`)
        if (currentKeys.some((key) => !plannedKeys.has(key))) {
            throw new Error('The reviewed inventory manifest does not match current Blog media references')
        }
    }

    const selected = posts
    const selectedPostIds = new Set(selected.map(({ id }) => id))
    const invalidRows = rows.filter((row) => row.classification === 'invalid' && selectedPostIds.has(row.postId))
    if (apply && invalidRows.length) {
        emit({ mode: 'apply', status: 'BLOCKED', invalid_reference_count: invalidRows.length, manifest: 'private' })
        throw new Error('Blog editorial inventory contains malformed, unowned, or unsupported image references')
    }
    const productApiBlocked = selected.filter((post) => post.publishing_identity_id && extractBlogEditorialImageReferences({
        content: post.content,
        thumbnailUrl: post.thumbnail_url,
        coverImageUrl: post.cover_image_url,
    }).some((reference) => productSet.has(reference)))
    if (apply && productApiBlocked.length) {
        emit({ mode: 'apply', status: 'BLOCKED', product_api_compatibility_posts: productApiBlocked.length, manifest: 'private' })
        throw new Error('Publishing-owned Blog Post contains Product media that the Publishing API cannot represent; no mutation was applied')
    }
    const externalSources = [...sourceToPosts.entries()]
        .filter(([, postIds]) => !apply || [...postIds].some((id) => selectedPostIds.has(id)))
        .map(([source]) => source)
    const sourceResults = new Map<string, { bytes: Buffer; mime: string; finalUrl: string }>()
    const failures: { referenceHash: string; reason: string }[] = []
    for (const source of externalSources) {
        try {
            const downloaded = await downloadSource(source)
            await processPublishingImage(downloaded.bytes, downloaded.mime, 'inline')
            sourceResults.set(source, downloaded)
        } catch (error) {
            failures.push({ referenceHash: sha256(source), reason: error instanceof Error ? error.message.slice(0, 160) : 'source validation failed' })
        }
    }
    if (failures.length) {
        emit({ mode: apply ? 'apply' : 'dry-run', status: 'BLOCKED', post_count: posts.length, external_count: externalSources.length, source_failures: failures.length, manifest: 'private' })
        throw new Error('One or more Blog editorial sources failed bounded fetch/decode validation')
    }
    if (!apply) {
        emit({ mode: 'dry-run', status: 'READY_FOR_APPLY', post_count: posts.length, reference_count: rows.length, external_count: externalSources.length, product_excluded: rows.filter((row) => row.classification === 'product').length, manifest: 'private' })
        return
    }

    const environment = flags.get('environment')
    if (environment !== 'production') throw new Error('--environment production is required for apply')
    const credentialId = required(flags, 'credential-id')
    const adminActorId = Number(required(flags, 'admin-actor-id'))
    if (!Number.isSafeInteger(adminActorId) || adminActorId < 1) throw new Error('--admin-actor-id must be positive')
    requireWritesAllowed('publishing.blog_editorial_media_import')
    const admin = await prisma.admin_users.findFirst({
        where: { id: adminActorId, is_active: true, role: 'admin' },
        select: { id: true },
    })
    if (!admin) throw new Error('--admin-actor-id must identify an active admin user')
    const schedulerToken = process.env.PUBLISHING_SCHEDULER_TOKEN
    if (!schedulerToken) throw new Error('PUBLISHING_SCHEDULER_TOKEN is required for cache revalidation')
    const baseUrl = process.env.PUBLISHING_INTERNAL_BASE_URL ?? 'http://127.0.0.1:3000'
    const parsedBaseUrl = new URL(baseUrl)
    if (parsedBaseUrl.protocol !== 'https:' && !['127.0.0.1', 'localhost', '::1'].includes(parsedBaseUrl.hostname)) {
        throw new Error('PUBLISHING_INTERNAL_BASE_URL must be HTTPS or loopback')
    }
    const credential = await prisma.publishing_credentials.findUnique({
        where: { id: credentialId },
        include: { identity: { include: { capabilities: { where: { revoked_at: null }, select: { capability: true } }, ip_allowlist: { select: { ip_address: true } } } } },
    })
    if (!credential || credential.environment !== environment || credential.revoked_at || credential.expires_at <= new Date()) {
        throw new Error('The selected Publishing credential is not active for the requested environment')
    }
    const auth = {
        credentialId: credential.id,
        identity: {
            id: credential.identity.id,
            sponsorUserId: credential.identity.sponsor_user_id,
            active: credential.identity.is_active,
            capabilities: new Set(credential.identity.capabilities.map(({ capability }) => capability)),
            allowedIpAddresses: new Set(credential.identity.ip_allowlist.map(({ ip_address }) => ip_address)),
        },
        clientIp: null,
    }
    const foreignPublishingPosts = selected.filter((post) =>
        post.publishing_identity_id && post.publishing_identity_id !== auth.identity.id,
    )
    if (foreignPublishingPosts.length) {
        emit({ mode: 'apply', status: 'BLOCKED', foreign_publishing_identity_posts: foreignPublishingPosts.length, manifest: 'private' })
        throw new Error('The selected batch contains Publishing-owned Posts from another Machine Identity')
    }
    const config = getPublishingRuntimeConfig()
    const mediaBySourcePurpose = new Map<string, { id: string; url: string }>()
    const readyMedia = await prisma.publishing_managed_media.findMany({
        where: { identity_id: auth.identity.id, status: 'ready', primary_url: { in: managedCandidates } },
        select: { id: true, primary_url: true },
    })
    const readyMediaByCandidate = new Map<string, { id: string; url: string }>()
    for (const media of readyMedia) {
        const url = canonicalizePublishingMediaUrl(media.primary_url)
        if (!url) continue
        for (const candidate of publishingMediaUrlCandidates(media.primary_url)) {
            readyMediaByCandidate.set(candidate, { id: media.id, url })
        }
    }
    // Ownership is checked by URL candidates below; never attach a ready
    // record belonging to a different Publishing identity.
    const selectedManagedReferences = new Set(selected.flatMap((post) => extractBlogEditorialImageReferences({
        content: post.content,
        thumbnailUrl: post.thumbnail_url,
        coverImageUrl: post.cover_image_url,
    })))
    const unownedReferences = [...selectedManagedReferences].filter((reference) => {
        const host = safeHostname(reference)
        return host && managedHosts.has(host)
            && !productSet.has(reference)
            && managedReferencePurpose.has(reference)
            && !readyMediaByCandidate.has(reference)
    })
    if (unownedReferences.length) {
        emit({ mode: 'apply', status: 'BLOCKED', managed_media_ownership_mismatch: unownedReferences.length, manifest: 'private' })
        throw new Error('A Blog Managed Media reference is not owned by the selected Publishing identity')
    }
    for (const [source, downloaded] of sourceResults) {
        for (const purpose of sourcePurposes.get(source) ?? ['inline']) {
            const key = `${sha256(source)}:${purpose}`
            const existing = await prisma.publishing_managed_media.findFirst({
                where: { identity_id: auth.identity.id, status: 'ready', source_sha256: sha256(downloaded.bytes), purpose },
                select: { id: true, primary_url: true },
            })
            if (existing?.primary_url) {
                const url = canonicalizePublishingMediaUrl(existing.primary_url)
                if (url) mediaBySourcePurpose.set(key, { id: existing.id, url })
                continue
            }
            const uploaded = await uploadPublishingMedia({
                auth,
                environment: 'production',
                idempotencyKey: `blog-editorial-import:${key}`,
                purpose,
                declaredMime: downloaded.mime,
                source: downloaded.bytes,
                requestId: randomUUID(),
            })
            mediaBySourcePurpose.set(key, { id: uploaded.body.id, url: uploaded.body.url })
        }
    }

    for (const post of selected) {
        const input: BlogEditorialMediaInput = { content: post.content, thumbnailUrl: post.thumbnail_url, coverImageUrl: post.cover_image_url }
        const replacements = new Map<string, string>()
        const mediaIds = new Map<string, string>()
        for (const source of extractBlogEditorialImageReferences(input)) {
            const purpose: Purpose = source === post.thumbnail_url ? 'thumbnail' : source === post.cover_image_url ? 'cover' : 'inline'
            const existing = post.publishing_media.find(({ media }) =>
                media.status === 'ready' && publishingMediaUrlCandidates(media.primary_url).includes(source),
            )?.media
            if (existing?.primary_url && existing.id) {
                const canonical = canonicalizePublishingMediaUrl(existing.primary_url)
                if (canonical) { replacements.set(source, canonical); mediaIds.set(canonical, existing.id) }
                continue
            }
            const uploaded = mediaBySourcePurpose.get(`${sha256(source)}:${purpose}`)
            if (uploaded) { replacements.set(source, uploaded.url); mediaIds.set(uploaded.url, uploaded.id) }
            else if (readyMediaByCandidate.has(source)) {
                const existingReady = readyMediaByCandidate.get(source)!
                replacements.set(source, existingReady.url)
                mediaIds.set(existingReady.url, existingReady.id)
            } else if (canonicalizePublishingMediaUrl(source)) replacements.set(source, canonicalizePublishingMediaUrl(source)!)
        }
        const rewritten = replaceBlogEditorialMediaReferences(input, replacements)
        const mediaChanged = rewritten.content !== input.content
            || rewritten.thumbnailUrl !== (input.thumbnailUrl?.trim() || null)
            || rewritten.coverImageUrl !== (input.coverImageUrl?.trim() || null)
        if (!mediaChanged) continue
        if (post.publishing_identity_id && post.external_id) {
            const mediaFor = (value: string | null | undefined) => value ? mediaIds.get(value) ?? post.publishing_media.find(({ media }) => canonicalizePublishingMediaUrl(media.primary_url) === value)?.media.id ?? null : null
            const mode = post.status === 'published' ? { mode: 'publish_now' as const } : post.status === 'scheduled' && post.scheduled_for ? { mode: 'scheduled' as const, publish_at: post.scheduled_for.toISOString(), publication_timezone: post.scheduled_timezone ?? 'Asia/Ho_Chi_Minh' } : { mode: 'draft' as const }
            await mutatePublishingPost({
                auth,
                externalId: post.external_id,
                expectedVersion: post.version,
                create: false,
                idempotencyKey: `blog-editorial-post:${post.id}:${sha256(rewritten.content)}:${sha256(rewritten.thumbnailUrl ?? '')}:${sha256(rewritten.coverImageUrl ?? '')}`,
                requestId: randomUUID(),
                config,
                mutation: {
                    title: post.title,
                    slug: post.slug,
                    excerpt: post.excerpt ?? '',
                    content_html: rewritten.content,
                    category_slug: post.blog_categories.slug,
                    tag_slugs: post.blog_post_tags.map(({ blog_tags }) => blog_tags.slug),
                    thumbnail_media_id: mediaFor(rewritten.thumbnailUrl),
                    cover_media_id: mediaFor(rewritten.coverImageUrl),
                    seo_title: post.seo_title,
                    seo_description: post.seo_description,
                    publication: mode,
                },
            })
        } else {
            await prisma.$transaction(async (transaction) => {
                const write = await transaction.blog_posts.updateMany({
                    where: { id: post.id, version: post.version },
                    data: {
                        content: rewritten.content,
                        thumbnail_url: rewritten.thumbnailUrl,
                        cover_image_url: rewritten.coverImageUrl,
                        version: { increment: 1 },
                        updated_at: new Date(),
                    },
                })
                if (write.count !== 1) throw new Error('Blog Post version changed during migration')
                await transaction.publishing_blog_post_media.deleteMany({ where: { post_id: post.id } })
                const links = [...mediaIds.entries()].map(([url, mediaId]) => ({
                    post_id: post.id,
                    media_id: mediaId,
                    usage: url === rewritten.thumbnailUrl ? 'thumbnail' : url === rewritten.coverImageUrl ? 'cover' : 'inline',
                }))
                if (links.length) await transaction.publishing_blog_post_media.createMany({ data: links, skipDuplicates: true })
                await writePublishingAudit(transaction, {
                    actorKind: 'admin',
                    adminActorId,
                    action: 'post.editorial_media_migrated',
                    postId: post.id,
                    fromVersion: post.version,
                    toVersion: post.version + 1,
                    fromState: post.status,
                    toState: post.status,
                    changedFields: ['editorial_media'],
                    contentHtml: rewritten.content,
                    metadata: { source_count: replacements.size },
                })
            })
        }
        await revalidatePublicSurfaces(baseUrl, schedulerToken, {
            categorySlug: post.blog_categories.slug,
            postSlug: post.slug,
        })
    }
    emit({ mode: 'apply', status: 'APPLIED_BATCH', post_count: selected.length, offset, limit, manifest: 'private' })
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'import failed'}\n`)
    process.exitCode = 1
}).finally(async () => {
    await prisma.$disconnect()
})
