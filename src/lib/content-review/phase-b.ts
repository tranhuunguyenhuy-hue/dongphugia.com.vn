import * as cheerio from 'cheerio'
import { cleanupProductHtml, extractEmbeddedImageUrls } from './cleanup'
import { classifyMediaReferences, type MediaClassification, type MediaClassificationInput, type MediaHost } from './media-classification'
import { normalizeImageUrl } from './images'
import { getEditorialQualityMetrics, type EditorialQualityMetrics } from './content-quality'
import { hashObject, sha256 } from './hash'
import type { ProductContentInput } from './types'

export const PHASE_B_SCHEMA_VERSION = 1 as const
export const PHASE_B_SOURCE = 'leo_493_phase_b_offline_v1' as const
export const PHASE_B_HOLDOUT_SIZE = 24

export type PhaseBVisibility = 'public' | 'private'

export interface PhaseBProductSnapshot {
    id: number
    sku: string
    name: string
    brand: { id: number; name: string; slug: string }
    category: { id: number; name: string; slug: string }
    updatedAt: string
    descriptionHtml: string
    media: Array<{
        kind: 'main' | 'gallery' | 'embedded'
        sourceId: string
        url: string
        fingerprint: string
        host: MediaHost
    }>
}

export interface PhaseBMediaProposal {
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    fingerprint: string
    host: MediaHost
    url?: string
    policy: string
    currentDecision: string
    classification: MediaClassification
    placement: 'AFTER_INLINE' | 'BEFORE_ONLY' | 'REMOVED_FROM_AFTER'
}

export interface PhaseBRecord {
    product: {
        id: number
        sku: string
        name: string
        brand: string
        brandSlug: string
        category: string
        categorySlug: string
        updatedAt: string
    }
    input: ProductContentInput
    generatedHtml: string
    requiredFacts: string[]
    media: PhaseBMediaProposal[]
    editorial: EditorialQualityMetrics
    narrativeFamily: string
    holdout: boolean
    blockedReasons: string[]
    provenance: {
        inputHash: string
        beforeDescriptionHash: string
        afterDescriptionHash: string
        factsHash: string
        sourceRecordHash: string
        mediaInventoryHash: string
    }
}

export interface PhaseBPackage {
    schemaVersion: typeof PHASE_B_SCHEMA_VERSION
    source: typeof PHASE_B_SOURCE
    policyHash: string
    snapshotHash: string
    sourceCommit: string
    proposalHash: string
    acceptedRegression: Array<{
        id: number
        sku: string
        afterDescriptionHash: string
        sourcePackageHash: string
        inSnapshot: boolean
    }>
    records: PhaseBRecord[]
    counts: {
        products: number
        media: number
        byBrand: Record<string, number>
        byCategory: Record<string, number>
        byRisk: Record<string, number>
        byMediaAction: Record<string, number>
        byEditorialReview: Record<string, number>
        holdout: number
        blocked: number
    }
    packageHash: string
}

export interface PhaseBDashboardMedia extends PhaseBMediaProposal {
    urlRedacted: string
}

export interface PhaseBDashboardProduct {
    id: number
    sku: string
    name: string
    brand: string
    brandSlug: string
    category: string
    categorySlug: string
    updatedAt: string
    editorialReview: 'PASS' | 'HUMAN_REVIEW'
    editorialReviewReason: string | null
    editorialQuality: EditorialQualityMetrics
    narrativeFamily: string
    holdout: boolean
    blockedReasons: string[]
    beforeHtml: string
    afterHtml: string
    previewHtml: string
    diff: {
        algorithm: 'deterministic_char_window_v1'
        changed: boolean
        addedCharacters: number
        removedCharacters: number
        commonPrefixCharacters: number
        commonSuffixCharacters: number
    }
    media: PhaseBDashboardMedia[]
}

export interface PhaseBDashboardModel {
    schemaVersion: typeof PHASE_B_SCHEMA_VERSION
    dashboard: 'leo-493-phase-b'
    packageHash: string
    proposalHash: string
    policyHash: string
    snapshotHash: string
    sourceCommit: string
    bindingStatus: 'VALID' | 'STALE'
    products: PhaseBDashboardProduct[]
    privateMedia?: boolean
}

const FAMILY_DEFINITIONS = [
    { id: 'selection', headings: ['Chọn theo nhu cầu', 'Điểm cần đối chiếu', 'Lắp đặt và sử dụng'] },
    { id: 'installation', headings: ['Chuẩn bị lắp đặt', 'Giá trị khi sử dụng', 'Kiểm tra trước khi mua'] },
    { id: 'daily-care', headings: ['Trong sinh hoạt hằng ngày', 'Lưu ý vệ sinh và bảo quản', 'Cân nhắc trước khi chọn'] },
    { id: 'space-fit', headings: ['Phù hợp với không gian', 'Cách xem thông tin sản phẩm', 'Lắp đặt và chăm sóc'] },
    { id: 'comparison', headings: ['Thông tin giúp lựa chọn', 'Đối chiếu khi lắp đặt', 'Sau khi đưa vào sử dụng'] },
    { id: 'maintenance', headings: ['Giữ trải nghiệm ổn định', 'Lưu ý khi sử dụng', 'Đối chiếu sản phẩm chính hãng'] },
] as const

function visibleText(html: string): string {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    return $.root().text().replace(/\s+/g, ' ').trim()
}

function sourceSentences(html: string): string[] {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    const chunks = $('p, li, td, th, h1, h2, h3, h4, h5, h6').toArray()
        .map(node => $(node).text().replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    const text = (chunks.length ? chunks : [$.root().text()]).join(' ')
    return text
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?。！？])\s+/u)
        .map(sentence => sentence.trim().replace(/\b[A-ZÀ-Ỵ][^:;]{2,48}:\s*/gu, ''))
        .filter(sentence => sentence.length >= 12)
}

function categoryContext(slug: string): { space: string; action: string; care: string } {
    const value = slug.toLocaleLowerCase()
    if (value.includes('bep')) return { space: 'khu vực bếp', action: 'sơ chế và vệ sinh hằng ngày', care: 'giữ khu vực lắp đặt sạch và khô' }
    if (value.includes('gach')) return { space: 'bề mặt cần ốp lát', action: 'ốp lát và hoàn thiện không gian', care: 'vệ sinh bề mặt theo hướng dẫn phù hợp' }
    return { space: 'không gian phòng tắm', action: 'lắp đặt và sử dụng hằng ngày', care: 'vệ sinh, kiểm tra và bảo quản định kỳ' }
}

function familyFor(product: PhaseBProductSnapshot): typeof FAMILY_DEFINITIONS[number] {
    const value = sha256(`${product.id}:${product.sku}:${product.category.slug}`)
    return FAMILY_DEFINITIONS[parseInt(value.slice(0, 8), 16) % FAMILY_DEFINITIONS.length]
}

function takeWithin(text: string, max: number): string {
    if (text.length <= max) return text
    const cut = text.slice(0, max).replace(/\s+\S*$/, '').trim()
    return `${cut}.`
}

function buildNarrative(product: PhaseBProductSnapshot, keepInlineUrls: string[]): { html: string; family: string; requiredFacts: string[] } {
    const family = familyFor(product)
    const context = categoryContext(product.category.slug)
    const source = sourceSentences(product.descriptionHtml)
    const fullSource = visibleText(product.descriptionHtml)
    const first = source[0] || takeWithin(fullSource, 240) || `Mã sản phẩm ${product.sku}.`
    const second = source[1] || source[0] || `Thông tin cần được đối chiếu theo nhu cầu thực tế.`
    const third = source[2] || source[1] || `Cần kiểm tra điều kiện lắp đặt trước khi sử dụng.`
    const intro = `Với ${product.name}, người mua có thể đối chiếu mã ${product.sku} và thông tin chính hãng ${product.brand.name} trước khi chọn cho ${context.space}.`
    const beforeLength = fullSource.length
    const target = Math.max(260, Math.floor(beforeLength * 1.1))
    const paragraphBudget = Math.max(42, Math.floor((target - 72) / 3))
    const p1 = takeWithin(`${product.sku} chính hãng ${product.brand.name}. ${first}`, paragraphBudget)
    const p2 = takeWithin(`Phù hợp khi đối chiếu nhu cầu. ${second}`, paragraphBudget)
    const p3 = takeWithin(`Lắp đặt và sử dụng: ${third} ${context.care}.`, paragraphBudget)
    const html = `<h3>${family.headings[0]}</h3><p>${p1}</p><h3>${family.headings[1]}</h3><p>${p2}</p><h3>${family.headings[2]}</h3><p>${p3}</p>`
    const imageHtml = keepInlineUrls.map((url, index) => {
        const alt = `${product.name} — hình tham khảo ${index + 1}`
        return `<figure><img src="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="${alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"><figcaption>Hình tham khảo trong phần thông tin sản phẩm.</figcaption></figure>`
    }).join('')
    const requiredFacts = [product.sku, product.brand.name]
    return { html: cleanupProductHtml(html.replace('</p>', `${imageHtml}</p>`)), family: family.id, requiredFacts }
}

function diff(before: string, after: string): PhaseBDashboardProduct['diff'] {
    let prefix = 0
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
    let suffix = 0
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1
    return { algorithm: 'deterministic_char_window_v1', changed: before !== after, addedCharacters: after.length - prefix - suffix, removedCharacters: before.length - prefix - suffix, commonPrefixCharacters: prefix, commonSuffixCharacters: suffix }
}

function hostForUrl(url: string): MediaHost {
    try {
        const hostname = new URL(url).hostname.toLocaleLowerCase()
        if (hostname === 'hita.com.vn' || hostname.endsWith('.hita.com.vn')) return 'Hita'
        if (hostname.includes('bunny') || hostname.includes('b-cdn')) return 'Bunny CDN'
    } catch { /* sanitized/offline inputs are classified as external */ }
    return 'External'
}

function mediaRisk(media: PhaseBMediaProposal[]): string {
    const hosts = new Set(media.map(item => item.host))
    if (hosts.has('Hita') && hosts.has('Bunny CDN')) return 'MIXED'
    if (hosts.has('Hita')) return 'HITA_HOSTED'
    if (hosts.has('Bunny CDN')) return 'BUNNY_ONLY'
    return 'NO_MEDIA'
}

function count(values: readonly string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] || 0) + 1; return result }, {})
}

export function buildPhaseBRecords(
    products: readonly PhaseBProductSnapshot[],
    acceptedHtmlBySku: ReadonlyMap<string, { html: string; input: ProductContentInput }>,
): PhaseBRecord[] {
    const sorted = [...products].sort((a, b) => a.id - b.id)
    const mediaInputs: MediaClassificationInput[] = []
    for (const product of sorted) for (const media of product.media) {
        mediaInputs.push({ sku: product.sku, kind: media.kind, sourceId: media.sourceId, fingerprint: media.fingerprint, host: media.host })
    }
    const classifications = classifyMediaReferences(mediaInputs)
    const classificationByKey = new Map(mediaInputs.map((input, index) => [`${input.sku}:${input.sourceId}:${input.fingerprint}`, classifications[index]]))
    const acceptedCount = sorted.filter(product => acceptedHtmlBySku.has(product.sku)).length
    const fallbackHoldoutCount = Math.max(0, PHASE_B_HOLDOUT_SIZE - acceptedCount)
    let fallbackHoldoutsSeen = 0
    return sorted.map(product => {
        const accepted = acceptedHtmlBySku.get(product.sku)
        const holdout = Boolean(accepted) || (!accepted && fallbackHoldoutsSeen++ < fallbackHoldoutCount)
        const input: ProductContentInput = accepted?.input || {
            id: product.id,
            sku: product.sku,
            name: product.name,
            sourceUrl: `aws-postgresql://products/${product.id}`,
            descriptionHtml: product.descriptionHtml,
            imageMainUrl: product.media.find(media => media.kind === 'main')?.url,
            galleryImages: product.media.filter(media => media.kind === 'gallery').map(media => ({ url: media.url, altText: product.name, id: Number(media.sourceId.replace('gallery:', '')) || undefined })),
            brand: product.brand,
            category: product.category,
        }
        const media = product.media.map(item => {
            const classification = classificationByKey.get(`${product.sku}:${item.sourceId}:${item.fingerprint}`)!
            const placement = classification.action === 'REMOVE_HITA_SHOWROOM'
                ? 'REMOVED_FROM_AFTER' as const
                : item.kind === 'embedded' && classification.action !== 'HUMAN_REVIEW'
                    ? 'AFTER_INLINE' as const
                    : 'BEFORE_ONLY' as const
            return {
                kind: item.kind,
                sourceId: item.sourceId,
                fingerprint: item.fingerprint,
                host: item.host,
                url: item.url,
                policy: item.kind === 'embedded' ? 'KEEP_EXISTING_EMBEDDED' : 'KEEP_EXISTING_REFERENCE',
                currentDecision: classification.action,
                classification,
                placement,
            }
        })
        const inlineUrls = media.filter(item => item.kind === 'embedded' && item.placement === 'AFTER_INLINE').map(item => item.url)
        const narrative = accepted
            ? { html: cleanupProductHtml(accepted.html), family: 'accepted-regression', requiredFacts: [product.sku, product.brand.name] }
            : buildNarrative(product, inlineUrls)
        const editorial = getEditorialQualityMetrics(input.descriptionHtml, narrative.html)
        const blockedReasons: string[] = []
        if (!visibleText(input.descriptionHtml)) blockedReasons.push('MISSING_DESCRIPTION')
        if (editorial.shortSourceException) blockedReasons.push('SPARSE_SOURCE_REQUIRES_HUMAN_REVIEW')
        if (media.some(item => item.kind === 'embedded' && item.placement === 'BEFORE_ONLY')) blockedReasons.push('EMBEDDED_MEDIA_NOT_SAFE_FOR_INLINE_PLACEMENT')
        if (media.some(item => item.currentDecision === 'HUMAN_REVIEW')) blockedReasons.push('MEDIA_VISUAL_ROLE_UNCLEAR')
        const sourceRecordHash = hashObject({ id: product.id, sku: product.sku, updatedAt: product.updatedAt, descriptionHash: sha256(product.descriptionHtml), media: product.media.map(item => ({ kind: item.kind, sourceId: item.sourceId, fingerprint: item.fingerprint })) })
        const provenance = {
            inputHash: hashObject(input),
            beforeDescriptionHash: hashObject(input.descriptionHtml),
            afterDescriptionHash: hashObject(narrative.html),
            factsHash: hashObject(narrative.requiredFacts),
            sourceRecordHash,
            mediaInventoryHash: hashObject(media.map(item => ({ kind: item.kind, sourceId: item.sourceId, fingerprint: item.fingerprint, action: item.currentDecision }))),
        }
        return {
            product: { id: product.id, sku: product.sku, name: product.name, brand: product.brand.name, brandSlug: product.brand.slug, category: product.category.name, categorySlug: product.category.slug, updatedAt: product.updatedAt },
            input,
            generatedHtml: narrative.html,
            requiredFacts: narrative.requiredFacts,
            media,
            editorial,
            narrativeFamily: narrative.family,
            holdout,
            blockedReasons,
            provenance,
        }
    })
}

export function calculatePhaseBProposalHash(value: Pick<PhaseBPackage, 'schemaVersion' | 'source' | 'policyHash' | 'snapshotHash' | 'sourceCommit' | 'records'> & Partial<Pick<PhaseBPackage, 'acceptedRegression'>>): string {
    return hashObject({ schemaVersion: value.schemaVersion, source: value.source, policyHash: value.policyHash, snapshotHash: value.snapshotHash, sourceCommit: value.sourceCommit, acceptedRegression: value.acceptedRegression || [], records: value.records })
}

export function calculatePhaseBPackageHash(value: Omit<PhaseBPackage, 'packageHash'>): string {
    return hashObject(value)
}

export function buildPhaseBPackage(records: PhaseBRecord[], policyHash: string, snapshotHash: string, sourceCommit: string, acceptedRegression: PhaseBPackage['acceptedRegression'] = []): PhaseBPackage {
    const media = records.flatMap(record => record.media)
    const proposalHash = calculatePhaseBProposalHash({ schemaVersion: PHASE_B_SCHEMA_VERSION, source: PHASE_B_SOURCE, policyHash, snapshotHash, sourceCommit, acceptedRegression, records })
    const withoutPackageHash = {
        schemaVersion: PHASE_B_SCHEMA_VERSION,
        source: PHASE_B_SOURCE,
        policyHash,
        snapshotHash,
        sourceCommit,
        proposalHash,
        acceptedRegression,
        records,
        counts: {
            products: records.length,
            media: media.length,
            byBrand: count(records.map(record => record.product.brandSlug)),
            byCategory: count(records.map(record => record.product.categorySlug)),
            byRisk: count(records.map(record => mediaRisk(record.media))),
            byMediaAction: count(media.map(item => item.classification.action)),
            byEditorialReview: count(records.map(record => record.editorial.editorialReview)),
            holdout: records.filter(record => record.holdout).length,
            blocked: records.filter(record => record.blockedReasons.length > 0).length,
        },
    } satisfies Omit<PhaseBPackage, 'packageHash'>
    return { ...withoutPackageHash, packageHash: calculatePhaseBPackageHash(withoutPackageHash) }
}

export function assertPhaseBPackageBinding(value: PhaseBPackage, policyHash: string, snapshotHash: string): void {
    if (value.policyHash !== policyHash || value.snapshotHash !== snapshotHash || value.proposalHash !== calculatePhaseBProposalHash(value)) throw new Error('Phase-B policy/snapshot/proposal binding is stale')
    const { packageHash, ...withoutPackageHash } = value
    if (packageHash !== calculatePhaseBPackageHash(withoutPackageHash)) throw new Error('Phase-B package hash is stale')
    if (value.records.length !== 240 || value.counts.products !== 240) throw new Error('Phase-B package must contain exactly 240 products')
}

function mediaForDashboard(media: PhaseBMediaProposal, visibility: PhaseBVisibility): PhaseBDashboardMedia {
    return { ...media, ...(visibility === 'private' ? { url: media.url } : { url: undefined }), urlRedacted: `[redacted URL sha256=${sha256(normalizeImageUrl(media.url || ''))}]` }
}

function redactDashboardHtml(html: string): string {
    return cleanupProductHtml(html)
        .replace(/https?:\/\/[^\s"'<>]+/gi, '[media URL redacted]')
        .replace(/\b(?:[a-z0-9-]+\.)*hita\.com\.vn\b/gi, '[host redacted]')
}

function annotatePlacements(html: string, media: readonly PhaseBMediaProposal[]): string {
    const $ = cheerio.load(cleanupProductHtml(html), {}, false)
    const byUrl = new Map(media.filter(item => item.placement === 'AFTER_INLINE' && item.url).map(item => [normalizeImageUrl(item.url!), item]))
    $('img[src]').each((_, element) => {
        const item = byUrl.get(normalizeImageUrl($(element).attr('src') || ''))
        if (item) $(element).attr('data-media-source-id', item.sourceId)
    })
    return $.html()
}

function dashboardDiff(before: string, after: string): PhaseBDashboardProduct['diff'] {
    let prefix = 0
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
    let suffix = 0
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1
    return { algorithm: 'deterministic_char_window_v1', changed: before !== after, addedCharacters: after.length - prefix - suffix, removedCharacters: before.length - prefix - suffix, commonPrefixCharacters: prefix, commonSuffixCharacters: suffix }
}

export function createPhaseBDashboardModel(packageValue: PhaseBPackage, visibility: PhaseBVisibility): PhaseBDashboardModel {
    const products = packageValue.records.map(record => ({
        ...record.product,
        editorialReview: record.editorial.editorialReview,
        editorialReviewReason: record.editorial.editorialReviewReason,
        editorialQuality: record.editorial,
        narrativeFamily: record.narrativeFamily,
        holdout: record.holdout,
        blockedReasons: record.blockedReasons,
        beforeHtml: visibility === 'private' ? cleanupProductHtml(record.input.descriptionHtml) : redactDashboardHtml(record.input.descriptionHtml),
        afterHtml: visibility === 'private' ? annotatePlacements(record.generatedHtml, record.media) : redactDashboardHtml(annotatePlacements(record.generatedHtml, record.media)),
        previewHtml: visibility === 'private' ? annotatePlacements(record.generatedHtml, record.media) : redactDashboardHtml(annotatePlacements(record.generatedHtml, record.media)),
        diff: dashboardDiff(record.input.descriptionHtml, record.generatedHtml),
        media: record.media.map(item => mediaForDashboard(item, visibility)),
    })).sort((a, b) => a.id - b.id)
    return {
        schemaVersion: PHASE_B_SCHEMA_VERSION,
        dashboard: 'leo-493-phase-b',
        packageHash: packageValue.packageHash,
        proposalHash: packageValue.proposalHash,
        policyHash: packageValue.policyHash,
        snapshotHash: packageValue.snapshotHash,
        sourceCommit: packageValue.sourceCommit,
        bindingStatus: 'VALID',
        products,
        ...(visibility === 'private' ? { privateMedia: true } : {}),
    }
}

export function buildPhaseBDeterministicExport(model: PhaseBDashboardModel, state: { products?: Record<string, string>; images?: Record<string, string> } = {}): string {
    if (model.bindingStatus !== 'VALID' || !model.proposalHash || !model.policyHash || !model.snapshotHash || !model.sourceCommit) throw new Error('Cannot export stale Phase-B binding')
    const payload = {
        schemaVersion: PHASE_B_SCHEMA_VERSION,
        dashboard: model.dashboard,
        packageHash: model.packageHash,
        proposalHash: model.proposalHash,
        policyHash: model.policyHash,
        snapshotHash: model.snapshotHash,
        sourceCommit: model.sourceCommit,
        products: model.products.map(product => ({
            productId: product.id,
            sku: product.sku,
            decision: state.products?.[String(product.id)] || 'PENDING',
            images: product.media.map(media => ({ kind: media.kind, sourceId: media.sourceId, fingerprint: media.fingerprint, decision: state.images?.[`${product.id}:${media.sourceId}`] || media.currentDecision, classification: media.classification })),
        })).sort((a, b) => a.productId - b.productId),
    }
    const stable = (value: unknown): unknown => Array.isArray(value)
        ? value.map(stable)
        : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stable(nested)]))
            : value
    return `${JSON.stringify(stable(payload), null, 2)}\n`
}
