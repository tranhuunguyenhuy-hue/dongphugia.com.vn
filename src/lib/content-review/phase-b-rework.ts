import * as cheerio from 'cheerio'
import { cleanupProductHtml } from './cleanup'
import { classifyMediaAsset, type MediaAction, type MediaClassification, type MediaClassificationInput } from './media-classification'
import { normalizeImageUrl } from './images'
import { getEditorialQualityMetrics, type EditorialQualityMetrics } from './content-quality'
import { hashObject, sha256 } from './hash'
import type { PhaseBProductSnapshot } from './phase-b'
import type { ProductContentInput } from './types'

export const PHASE_B_REWORK_SCHEMA_VERSION = 1 as const
export const PHASE_B_REWORK_SOURCE = 'leo_493_phase_b_rework_checkpoint_v1' as const
export const PHASE_B_REWORK_SIZE = 24 as const
export const LEO_492_SAMPLE_CHECKSUM = '1a7095eac86b7cdb2f9034aa9cf6d3a949eb128a18be38baf5f7dae75dde8c68' as const

export type ReworkEditorialStatus = 'HUMAN_REVIEWED_PASS' | 'HUMAN_REVIEWED_REVIEW' | 'PENDING'
export type ReworkHoldoutStatus = 'MANUALLY_REVIEWED' | 'PENDING'
export type OfficialStatus = 'UNRESOLVED_REVIEW'

export interface ReworkMediaProposal {
    kind: PhaseBProductSnapshot['media'][number]['kind']
    sourceId: string
    fingerprint: string
    host: PhaseBProductSnapshot['media'][number]['host']
    url?: string
    policy: 'KEEP_EXISTING_REFERENCE' | 'KEEP_EXISTING_EMBEDDED' | 'REMOVE_FROM_AFTER'
    currentDecision: MediaAction
    classification: MediaClassification
    placement: 'AFTER_INLINE' | 'BEFORE_ONLY' | 'REMOVED_FROM_AFTER'
    baselineAction: MediaAction
    manuallyReviewed: boolean
    manualLabel: MediaAction | null
}

export interface ReworkRecord {
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
    media: ReworkMediaProposal[]
    editorial: EditorialQualityMetrics
    editorialStatus: ReworkEditorialStatus
    narrativeFamily: string
    structure: {
        headingCount: number
        paragraphCount: number
        openingKey: string
        closingKey: string
    }
    holdout: boolean
    holdoutStatus: ReworkHoldoutStatus
    officialStatus: OfficialStatus
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

export interface ReworkCheckpointPackage {
    schemaVersion: typeof PHASE_B_REWORK_SCHEMA_VERSION
    source: typeof PHASE_B_REWORK_SOURCE
    policyHash: string
    snapshotHash: string
    sourceCommit: string
    proposalHash: string
    manualHoldoutHash: string
    officialStatusEvidence: {
        source: 'LEO-492'
        sampleChecksum: typeof LEO_492_SAMPLE_CHECKSUM
        activeCurrentCount: 1
        strictVariantConflictCount: 1
        reviewCount: 28
        decision: 'NO_GO_BLIND_OFFICIAL_STATUS_EXTENSION'
        rowStatusClaimed: false
    }
    acceptedRegression: Array<{ id: number; sku: string; afterDescriptionHash: string; sourcePackageHash: string; inSnapshot: boolean }>
    selection: {
        algorithm: string
        checkpointSize: 24
        categoryQuotas: Record<string, number>
        selectedSkus: string[]
    }
    manualHoldout: Array<{
        sku: string
        sourceId: string
        fingerprint: string
        visualLabel: MediaAction
        evidence: string
        confidence: string
        baselineAction: MediaAction
        baselineMatchesManual: boolean
        reviewer: string
    }>
    records: ReworkRecord[]
    counts: {
        products: number
        media: number
        byBrand: Record<string, number>
        byCategory: Record<string, number>
        byMediaAction: Record<string, number>
        byMediaConfidence: Record<string, number>
        byEditorialStatus: Record<string, number>
        byHoldoutStatus: Record<string, number>
        manuallyReviewedProducts: number
        manuallyReviewedMedia: number
        pendingVisualMedia: number
        blocked: number
    }
    packageHash: string
}

export interface ReworkDashboardMedia extends ReworkMediaProposal {
    urlRedacted: string
}

export interface ReworkDashboardProduct {
    id: number
    sku: string
    name: string
    brand: string
    brandSlug: string
    category: string
    categorySlug: string
    updatedAt: string
    editorialStatus: ReworkEditorialStatus
    editorialReviewReason: string | null
    editorialQuality: EditorialQualityMetrics
    narrativeFamily: string
    structure: ReworkRecord['structure']
    holdout: boolean
    holdoutStatus: ReworkHoldoutStatus
    officialStatus: OfficialStatus
    blockedReasons: string[]
    beforeHtml: string
    afterHtml: string
    previewHtml: string
    diff: { algorithm: 'deterministic_char_window_v1'; changed: boolean; addedCharacters: number; removedCharacters: number }
    media: ReworkDashboardMedia[]
}

export interface ReworkDashboardModel {
    schemaVersion: typeof PHASE_B_REWORK_SCHEMA_VERSION
    dashboard: 'leo-493-phase-b-rework-checkpoint'
    packageHash: string
    proposalHash: string
    policyHash: string
    snapshotHash: string
    sourceCommit: string
    bindingStatus: 'VALID' | 'STALE'
    products: ReworkDashboardProduct[]
    privateMedia?: boolean
}

const STRUCTURES = [
    { id: 'fit-first', headings: ['Nhìn nhanh vào mã sản phẩm', 'Đặt cạnh nhu cầu sử dụng', 'Chuẩn bị trước khi mua', 'Sau khi lắp đặt'] },
    { id: 'install-first', headings: ['Điểm cần kiểm tra ở vị trí lắp', 'Thông tin người mua đang có', 'Cách đối chiếu lựa chọn', 'Trình tự xác nhận', 'Sau khi hoàn thiện'] },
    { id: 'evidence-first', headings: ['Dữ liệu đang có của sản phẩm', 'Ý nghĩa khi chọn cho không gian', 'Lưu ý giữ thông tin rõ ràng'] },
    { id: 'care-first', headings: ['Bắt đầu từ việc vệ sinh và dùng hằng ngày', 'Tìm đúng chi tiết trước khi đặt mua', 'Kiểm tra sau khi hoàn thiện', 'Giữ lại thông tin sản phẩm'] },
    { id: 'comparison-first', headings: ['Mốc so sánh cho mã này', 'Cân nhắc với không gian thực tế', 'Chính hãng và hồ sơ đi kèm', 'Điều kiện cần xác nhận', 'Quyết định sau cùng'] },
    { id: 'space-first', headings: ['Vị trí dự kiến trong không gian', 'Thông tin nên giữ khi hỏi mua', 'Lắp đặt và chăm sóc về sau'] },
    { id: 'decision-first', headings: ['Khi nào thông tin này hữu ích', 'Đối chiếu trước khi chốt', 'Sử dụng có trách nhiệm'] },
    { id: 'careful-fit', headings: ['Một cách đọc hồ sơ sản phẩm', 'Kết nối với nhu cầu lắp đặt', 'Bước xác nhận cuối cùng'] },
] as const

function visibleText(html: string): string {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    return $.root().text().replace(/\s+/g, ' ').trim()
}

function sourceBlocks(html: string): string[] {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    const nodes = $('p, li, td, th, h1, h2, h3, h4, h5, h6').toArray()
        .map(node => $(node).text().replace(/\s+/g, ' ').trim())
        .filter(value => value.length >= 8)
    const value = (nodes.length ? nodes : [$.root().text()]).join(' ').replace(/\s+/g, ' ').trim()
    return value.split(/(?<=[.!?。！？])\s+/u).map(item => item.trim()).filter(item => item.length >= 8)
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
    return escapeText(value).replace(/"/g, '&quot;')
}

function compact(value: string, max: number): string {
    if (value.length <= max) return value
    return `${value.slice(0, max).replace(/\s+\S*$/, '').trim()}…`
}

function categoryContext(slug: string): { space: string; action: string; care: string } {
    const value = slug.toLocaleLowerCase()
    if (value.includes('bep')) return { space: 'khu vực bếp', action: 'sơ chế và vệ sinh hằng ngày', care: 'giữ khu vực lắp đặt sạch và khô' }
    if (value.includes('gach')) return { space: 'bề mặt ốp lát', action: 'hoàn thiện không gian theo mẫu đã chọn', care: 'vệ sinh bề mặt theo hướng dẫn phù hợp' }
    return { space: 'không gian phòng tắm', action: 'lắp đặt và sử dụng hằng ngày', care: 'vệ sinh, kiểm tra và bảo quản định kỳ' }
}

function splitEvidence(evidence: string, count: number): string[] {
    if (!evidence) return Array.from({ length: count }, () => '')
    const size = Math.ceil(evidence.length / count)
    return Array.from({ length: count }, (_, index) => evidence.slice(index * size, (index + 1) * size).trim()).filter(Boolean)
}

function fitNarrativeLength(html: string, beforeLength: number): string {
    const $ = cheerio.load(html, {}, false)
    const paragraphs = $('p').toArray()
    const headingLength = $('h2, h3, h4, h5, h6').toArray().reduce((total, node) => total + $(node).text().length, 0)
    const target = Math.max(220, Math.min(1800, Math.floor(beforeLength * 0.96)))
    const paragraphBudget = Math.max(paragraphs.length * 14, target - headingLength - $('figcaption').toArray().reduce((total, node) => total + $(node).text().length, 0))
    let remaining = paragraphBudget
    paragraphs.forEach((node, index) => {
        const text = $(node).text().replace(/\s+/g, ' ').trim()
        const remainingParagraphs = paragraphs.length - index
        const minimum = index === 0 ? 50 : 14
        const allocation = Math.min(text.length, Math.max(minimum, Math.floor(remaining / remainingParagraphs)))
        const value = compact(text, allocation)
        $(node).text(value)
        remaining = Math.max(0, remaining - value.length)
    })
    return $.html()
}

function representativeMedia(product: PhaseBProductSnapshot, index: number): PhaseBProductSnapshot['media'][number] {
    const preferred = index % 3 === 1
        ? product.media.find(media => media.kind === 'embedded')
        : index % 3 === 2
            ? product.media.find(media => media.kind === 'gallery')
            : product.media.find(media => media.kind === 'main')
    return preferred || product.media[0]
}

export function selectReworkProducts(products: readonly PhaseBProductSnapshot[]): PhaseBProductSnapshot[] {
    const sorted = [...products].sort((a, b) => a.id - b.id)
    const sanitary = sorted.filter(product => product.category.slug === 'thiet-bi-ve-sinh')
    const kitchen = sorted.filter(product => product.category.slug === 'thiet-bi-bep')
    const tile = sorted.filter(product => product.category.slug === 'gach-op-lat')
    const acceptedOverlap = sorted.find(product => product.sku === '61-1361-VN')
    const selected = [...sanitary.slice(0, 20), acceptedOverlap, ...kitchen.filter(product => product.sku !== '61-1361-VN').slice(0, 2), tile.find(product => product.sku === '355SD/CMG-1B')].filter(Boolean) as PhaseBProductSnapshot[]
    if (selected.length !== PHASE_B_REWORK_SIZE || new Set(selected.map(product => product.sku)).size !== PHASE_B_REWORK_SIZE) throw new Error('Deterministic 24-product selection is incomplete or duplicated')
    return selected.sort((a, b) => a.id - b.id)
}

function narrativeFor(product: PhaseBProductSnapshot, index: number, inlineMedia: ReadonlyArray<{ url?: string }>): { html: string; family: string; requiredFacts: string[]; structure: ReworkRecord['structure'] } {
    const source = sourceBlocks(product.descriptionHtml)
    const evidence = source.join(' ')
    const beforeLength = visibleText(product.descriptionHtml).length
    const structure = STRUCTURES[index % STRUCTURES.length]
    const context = categoryContext(product.category.slug)
    const first = compact(source[0] || product.name, 220)
    const second = compact(source[1] || source[0] || product.name, 220)
    const third = compact(source[2] || source[1] || product.name, 220)
    const target = Math.max(220, Math.min(1800, Math.floor(beforeLength * 0.88)))
    const paragraphCount = structure.headings.length
    const segments = splitEvidence(evidence, paragraphCount)
    const brandName = product.brand.name
    let paragraphs = structure.id === 'fit-first'
        ? [
            `${first}. Khi xem mã ${product.sku} trong hồ sơ ${brandName} chính hãng, người mua có một mốc cụ thể để đối chiếu.`,
            `${second}. Đặt thông tin này cạnh ${context.space} và cách gia đình dự định ${context.action} sẽ giúp việc chọn sản phẩm bám vào nhu cầu thật.`,
            `${third}. Trước khi chốt mua, nên kiểm tra lại kích thước, vị trí kết nối và các thông tin đã có trong hồ sơ thay vì suy đoán thêm.`,
            `Sau khi lắp, giữ lại mã ${product.sku} để tiện tra cứu; thực hiện ${context.care} theo tài liệu đi kèm.`,
        ]
        : structure.id === 'install-first'
            ? [
                `Với ${product.name}, mốc đầu tiên là ${compact(segments[0] || first, 260)}. Đây là phần thông tin nên đặt cạnh điều kiện lắp đặt thực tế.`,
                `Người mua có thể dùng mã ${product.sku} và thông tin ${brandName} chính hãng để hỏi đúng sản phẩm, đồng thời đối chiếu phần ${compact(segments[1] || second, 220)}.`,
                `Khi hoàn thiện ${context.space}, hãy xác nhận lại phần kết nối và hướng dẫn sử dụng; ${compact(segments[2] || third, 220)}.`,
            ]
            : structure.id === 'evidence-first'
                ? [
                    `Hồ sơ của ${product.sku} ghi nhận ${compact(segments[0] || first, 260)}. Người mua nên xem đây là dữ liệu nền khi tìm sản phẩm ${brandName} chính hãng.`,
                    `Nếu sản phẩm được đặt trong ${context.space}, phần ${compact(segments[1] || second, 230)} giúp cân nhắc xem lựa chọn có khớp không gian và cách dùng hay chưa.`,
                    `Trước và sau khi lắp, lưu lại ${product.sku}; kiểm tra ${context.care} và chỉ sử dụng theo thông tin đã được cung cấp, không tự thêm giả định.`,
                ]
                : structure.id === 'care-first'
                    ? [
                        `Đối với ${product.name}, thông tin ${compact(segments[0] || first, 260)} là điểm nên đọc trước khi nghĩ đến việc thay thế hay mua thêm.`,
                        `Mã ${product.sku} giúp người mua hỏi đúng hồ sơ ${brandName} chính hãng; hãy đặt ${compact(segments[1] || second, 230)} cạnh nhu cầu ${context.action}.`,
                        `Khi đã chọn, kiểm tra điều kiện lắp tại ${context.space} và duy trì ${context.care}; ${compact(segments[2] || third, 220)}.`,
                    ]
                    : [
                        `${compact(segments[0] || first, 250)} Đây là mốc thông tin riêng của ${product.sku}, không nên tách khỏi hồ sơ ${brandName} chính hãng.`,
                        `Để xem sản phẩm có hợp với ${context.space} hay không, người mua nên đối chiếu ${compact(segments[1] || second, 230)} cùng điều kiện ${context.action}.`,
                        `Bước xác nhận cuối là kiểm tra ${compact(segments[2] || third, 220)} và hướng dẫn liên quan trước khi lắp; sau đó duy trì ${context.care}.`,
                    ]
    while (paragraphs.length < structure.headings.length) {
        const next = segments[paragraphs.length] || `${product.sku} cần được đối chiếu với điều kiện lắp đặt và hướng dẫn đi kèm.`
        paragraphs.push(`Một bước bổ sung cho ${product.sku}: ${compact(next, 170)} Người mua nên kiểm tra thông tin này trước khi sử dụng.`)
    }
    paragraphs = paragraphs.slice(0, structure.headings.length)
    const headings = structure.headings.map((heading, headingIndex) => `<h${headingIndex === 0 ? '2' : '3'}>${escapeText(heading)}</h${headingIndex === 0 ? '2' : '3'}>`)
    const openingPrefix = [
        `${brandName} chính hãng · ${product.sku}: phù hợp/đối chiếu:`,
        `Mã ${product.sku} chính hãng: đối chiếu/phù hợp:`,
        `${product.sku} · ${brandName} chính hãng: phù hợp/đối chiếu:`,
        `${product.sku} chính hãng: đối chiếu/phù hợp:`,
    ][index % 4]
    paragraphs[0] = `${openingPrefix} ${paragraphs[0]}`
    let html = paragraphs.map((paragraph, paragraphIndex) => `${headings[paragraphIndex]}<p>${escapeText(paragraph)}</p>`).join('')
    if (inlineMedia.length) {
        const figures = inlineMedia.map((media, mediaIndex) => `<figure><img src="${escapeAttribute(media.url || '')}" alt="${escapeAttribute(product.name)} — ảnh thông tin ${mediaIndex + 1}"><figcaption>Ảnh hiện có, đặt cạnh phần thông tin liên quan.</figcaption></figure>`).join('')
        const insertion = html.indexOf('</p>') + 4
        html = `${html.slice(0, insertion)}${figures}${html.slice(insertion)}`
    }
    const textLength = visibleText(html)
    if (textLength.length > target * 1.2 && paragraphs.length > 2) {
        const lastParagraph = paragraphs[paragraphs.length - 1]
        const allowed = Math.max(40, Math.floor(lastParagraph.length - (textLength.length - target * 1.05)))
        const shortened = compact(lastParagraph, allowed)
        html = html.replace(escapeText(lastParagraph), escapeText(shortened))
    }
    const cleaned = cleanupProductHtml(fitNarrativeLength(html, beforeLength))
    const cleanedText = visibleText(cleaned)
    const openingKey = cleanedText.slice(0, 72).toLocaleLowerCase()
    const closingKey = cleanedText.slice(-96).toLocaleLowerCase()
    return {
        html: cleaned,
        family: structure.id,
        requiredFacts: [product.sku, brandName],
        structure: { headingCount: structure.headings.length, paragraphCount, openingKey, closingKey },
    }
}

function baseInput(product: PhaseBProductSnapshot): ProductContentInput {
    return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        sourceUrl: `offline://leo-493/snapshot/${product.id}`,
        descriptionHtml: product.descriptionHtml,
        imageMainUrl: product.media.find(media => media.kind === 'main')?.url,
        galleryImages: product.media.filter(media => media.kind === 'gallery').map(media => ({ url: media.url, altText: product.name })),
        brand: product.brand,
        category: product.category,
    }
}

function fallbackClassification(input: MediaClassificationInput): MediaClassification {
    if (input.host === 'Hita' || input.host === 'External') return classifyMediaAsset({ ...input, host: input.host })
    return {
        origin: 'UNKNOWN',
        action: 'KEEP_TEMPORARY',
        label: 'GIỮ TẠM — Chưa chứng minh nguồn, không phải showroom Hita',
        confidence: 'LOW',
        evidence: 'Checkpoint chưa có quan sát trực tiếp cho asset này; không có positive visual-role evidence, nên giữ tạm và ghi residual copyright risk.',
        visualCluster: `${input.sku.toLocaleLowerCase()}-pending-visual-${input.fingerprint.slice(0, 12)}`,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_VERIFIED',
        officialSourceRef: 'LEO-492 does not verify this asset; no remote fetch performed.',
    }
}

function manualClassification(product: PhaseBProductSnapshot, media: PhaseBProductSnapshot['media'][number], index: number): { classification: MediaClassification; baselineAction: MediaAction; manual: boolean } {
    const input: MediaClassificationInput = { sku: product.sku, kind: media.kind, sourceId: media.sourceId, fingerprint: media.fingerprint, host: media.host }
    const baseline = classifyMediaAsset(input)
    const representative = representativeMedia(product, index)
    if (media.fingerprint !== representative.fingerprint) return { classification: fallbackClassification(input), baselineAction: baseline.action, manual: false }
    const tile = product.sku === '355SD/CMG-1B'
    const action: MediaAction = tile ? 'KEEP_TEMPORARY' : 'KEEP_PRODUCT'
    const evidence = tile
        ? 'Quan sát trực tiếp asset Bunny: bảng mẫu màu/gạch nhìn rõ, không phải ảnh showroom/cửa hàng; đây không phải packshot/render riêng của sản phẩm nên giữ tạm, không nâng thành GIỮ — Hình sản phẩm.'
        : 'Quan sát trực tiếp asset Bunny: packshot/render sản phẩm nhìn rõ trên nền sạch, không thấy showroom/cửa hàng/display photo; đủ bằng chứng hình ảnh sản phẩm để giữ.'
    const classification: MediaClassification = {
        origin: 'UNKNOWN',
        action,
        label: action === 'KEEP_PRODUCT' ? 'GIỮ — Hình sản phẩm' : 'GIỮ TẠM — Chưa chứng minh nguồn, không phải showroom Hita',
        confidence: tile ? 'MEDIUM' : 'HIGH',
        evidence,
        visualCluster: `${product.sku.toLocaleLowerCase()}-${tile ? 'tile-swatch' : 'visible-packshot'}`,
        duplicateFingerprint: media.fingerprint,
        officialSourceVerification: 'NOT_VERIFIED',
        officialSourceRef: 'Visual role reviewed only; manufacturer-current status not verified.',
    }
    return { classification, baselineAction: baseline.action, manual: true }
}

function buildMedia(product: PhaseBProductSnapshot, productIndex: number, allFingerprints: Map<string, MediaClassification>): { media: ReworkMediaProposal[]; holdout: ReworkCheckpointPackage['manualHoldout'][number] } {
    const representative = representativeMedia(product, productIndex)
    let holdoutEntry: ReworkCheckpointPackage['manualHoldout'][number] | null = null
    const media = product.media.map(item => {
        const input: MediaClassificationInput = { sku: product.sku, kind: item.kind, sourceId: item.sourceId, fingerprint: item.fingerprint, host: item.host }
        const known = allFingerprints.get(item.fingerprint)
        const review = known ? { classification: known, baselineAction: classifyMediaAsset(input).action, manual: item.fingerprint === representative.fingerprint } : manualClassification(product, item, productIndex)
        allFingerprints.set(item.fingerprint, review.classification)
        if (item.fingerprint === representative.fingerprint) {
            holdoutEntry = {
                sku: product.sku,
                sourceId: item.sourceId,
                fingerprint: item.fingerprint,
                visualLabel: review.classification.action,
                evidence: review.classification.evidence,
                confidence: review.classification.confidence,
                baselineAction: review.baselineAction,
                baselineMatchesManual: review.baselineAction === review.classification.action,
                reviewer: 'worker-019fd0c7-fab8-7170-96af-d9d9a46f1519',
            }
        }
        const placement = review.classification.action === 'REMOVE_HITA_SHOWROOM'
            ? 'REMOVED_FROM_AFTER' as const
            : item.kind === 'embedded'
                ? 'AFTER_INLINE' as const
                : 'BEFORE_ONLY' as const
        return {
            kind: item.kind,
            sourceId: item.sourceId,
            fingerprint: item.fingerprint,
            host: item.host,
            url: item.url,
            policy: placement === 'AFTER_INLINE' ? 'KEEP_EXISTING_EMBEDDED' as const : placement === 'REMOVED_FROM_AFTER' ? 'REMOVE_FROM_AFTER' as const : 'KEEP_EXISTING_REFERENCE' as const,
            currentDecision: review.classification.action,
            classification: review.classification,
            placement,
            baselineAction: review.baselineAction,
            manuallyReviewed: item.fingerprint === representative.fingerprint,
            manualLabel: item.fingerprint === representative.fingerprint ? review.classification.action : null,
        }
    })
    if (!holdoutEntry) throw new Error(`No visual holdout media for ${product.sku}`)
    return { media, holdout: holdoutEntry }
}

function diff(before: string, after: string): ReworkDashboardProduct['diff'] {
    let prefix = 0
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
    let suffix = 0
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1
    return { algorithm: 'deterministic_char_window_v1', changed: before !== after, addedCharacters: after.length - prefix - suffix, removedCharacters: before.length - prefix - suffix }
}

export function buildReworkRecords(products: readonly PhaseBProductSnapshot[], acceptedHtmlBySku: ReadonlyMap<string, { html: string; input: ProductContentInput }>): { records: ReworkRecord[]; manualHoldout: ReworkCheckpointPackage['manualHoldout'] } {
    const selected = selectReworkProducts(products)
    const fingerprints = new Map<string, MediaClassification>()
    const holdout: ReworkCheckpointPackage['manualHoldout'] = []
    const records = selected.map((product, index) => {
        const accepted = acceptedHtmlBySku.get(product.sku)
        const input = accepted?.input || baseInput(product)
        const builtMedia = buildMedia(product, index, fingerprints)
        holdout.push(builtMedia.holdout)
        const inline = builtMedia.media.filter(media => media.kind === 'embedded' && media.placement === 'AFTER_INLINE')
        const narrative = accepted
            ? { html: cleanupProductHtml(accepted.html), family: 'accepted-regression', requiredFacts: [product.sku, product.brand.name], structure: { headingCount: 0, paragraphCount: 0, openingKey: 'accepted-regression', closingKey: 'accepted-regression' } }
            : narrativeFor(product, index, inline)
        const editorial = getEditorialQualityMetrics(input.descriptionHtml, narrative.html)
        const sourceText = visibleText(input.descriptionHtml)
        const blockedReasons: string[] = []
        if (!sourceText) blockedReasons.push('INSUFFICIENT_BEFORE_EVIDENCE')
        if (sourceText.length < 180) blockedReasons.push('INSUFFICIENT_BEFORE_EVIDENCE_REQUIRES_HUMAN_REVIEW')
        const editorialStatus: ReworkEditorialStatus = accepted
            ? 'HUMAN_REVIEWED_PASS'
            : blockedReasons.length ? 'HUMAN_REVIEWED_REVIEW' : editorial.flags.length ? 'HUMAN_REVIEWED_REVIEW' : 'HUMAN_REVIEWED_PASS'
        const sourceRecordHash = hashObject({ id: product.id, sku: product.sku, updatedAt: product.updatedAt, descriptionHash: sha256(product.descriptionHtml), media: product.media.map(item => ({ kind: item.kind, sourceId: item.sourceId, fingerprint: item.fingerprint })) })
        const mediaInventoryHash = hashObject(builtMedia.media.map(item => ({ sourceId: item.sourceId, fingerprint: item.fingerprint, action: item.currentDecision, placement: item.placement })))
        return {
            product: { id: product.id, sku: product.sku, name: product.name, brand: product.brand.name, brandSlug: product.brand.slug, category: product.category.name, categorySlug: product.category.slug, updatedAt: product.updatedAt },
            input,
            generatedHtml: narrative.html,
            requiredFacts: narrative.requiredFacts,
            media: builtMedia.media,
            editorial,
            editorialStatus,
            narrativeFamily: narrative.family,
            structure: narrative.structure,
            holdout: true,
            holdoutStatus: 'MANUALLY_REVIEWED' as const,
            officialStatus: 'UNRESOLVED_REVIEW' as const,
            blockedReasons,
            provenance: {
                inputHash: hashObject(input),
                beforeDescriptionHash: sha256(input.descriptionHtml),
                afterDescriptionHash: sha256(narrative.html),
                factsHash: hashObject(narrative.requiredFacts),
                sourceRecordHash,
                mediaInventoryHash,
            },
        }
    })
    return { records, manualHoldout: holdout.sort((a, b) => a.sku.localeCompare(b.sku)) }
}

function counts(values: readonly string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] || 0) + 1; return result }, {})
}

export function calculateReworkProposalHash(value: Pick<ReworkCheckpointPackage, 'schemaVersion' | 'source' | 'policyHash' | 'snapshotHash' | 'sourceCommit' | 'selection' | 'manualHoldout' | 'records' | 'officialStatusEvidence'>): string {
    return hashObject({
        schemaVersion: value.schemaVersion,
        source: value.source,
        policyHash: value.policyHash,
        snapshotHash: value.snapshotHash,
        sourceCommit: value.sourceCommit,
        selection: value.selection,
        manualHoldout: value.manualHoldout,
        records: value.records,
        officialStatusEvidence: value.officialStatusEvidence,
    })
}

export function buildReworkCheckpointPackage(records: ReworkRecord[], manualHoldout: ReworkCheckpointPackage['manualHoldout'], policyHash: string, snapshotHash: string, sourceCommit: string, acceptedRegression: ReworkCheckpointPackage['acceptedRegression']): ReworkCheckpointPackage {
    const media = records.flatMap(record => record.media)
    const selection = {
        algorithm: 'sort by immutable id; 20 lowest sanitary rows plus accepted overlap 61-1361-VN; 2 lowest other kitchen rows; exact tile 355SD/CMG-1B; dedupe raw SKU; sort final by id',
        checkpointSize: 24 as const,
        categoryQuotas: counts(records.map(record => record.product.categorySlug)),
        selectedSkus: records.map(record => record.product.sku).sort((a, b) => a.localeCompare(b)),
    }
    const officialStatusEvidence = {
        source: 'LEO-492' as const,
        sampleChecksum: LEO_492_SAMPLE_CHECKSUM,
        activeCurrentCount: 1 as const,
        strictVariantConflictCount: 1 as const,
        reviewCount: 28 as const,
        decision: 'NO_GO_BLIND_OFFICIAL_STATUS_EXTENSION' as const,
        rowStatusClaimed: false as const,
    }
    const proposalHash = calculateReworkProposalHash({ schemaVersion: PHASE_B_REWORK_SCHEMA_VERSION, source: PHASE_B_REWORK_SOURCE, policyHash, snapshotHash, sourceCommit, selection, manualHoldout, records, officialStatusEvidence })
    const withoutHash = {
        schemaVersion: PHASE_B_REWORK_SCHEMA_VERSION,
        source: PHASE_B_REWORK_SOURCE,
        policyHash,
        snapshotHash,
        sourceCommit,
        proposalHash,
        manualHoldoutHash: hashObject(manualHoldout),
        officialStatusEvidence,
        acceptedRegression,
        selection,
        manualHoldout,
        records,
        counts: {
            products: records.length,
            media: media.length,
            byBrand: counts(records.map(record => record.product.brandSlug)),
            byCategory: counts(records.map(record => record.product.categorySlug)),
            byMediaAction: counts(media.map(item => item.currentDecision)),
            byMediaConfidence: counts(media.map(item => item.classification.confidence)),
            byEditorialStatus: counts(records.map(record => record.editorialStatus)),
            byHoldoutStatus: counts(records.map(record => record.holdoutStatus)),
            manuallyReviewedProducts: records.filter(record => record.holdoutStatus === 'MANUALLY_REVIEWED').length,
            manuallyReviewedMedia: manualHoldout.length,
            pendingVisualMedia: media.filter(item => !item.manuallyReviewed).length,
            blocked: records.filter(record => record.blockedReasons.length > 0).length,
        },
    } satisfies Omit<ReworkCheckpointPackage, 'packageHash'>
    return { ...withoutHash, packageHash: hashObject(withoutHash) }
}

export function assertReworkCheckpointBinding(value: ReworkCheckpointPackage, policyHash: string, snapshotHash: string): void {
    if (value.policyHash !== policyHash || value.snapshotHash !== snapshotHash) throw new Error('Phase-B rework policy/snapshot binding is stale')
    const proposal = calculateReworkProposalHash(value)
    if (value.proposalHash !== proposal) throw new Error('Phase-B rework proposal binding is stale')
    if (value.manualHoldoutHash !== hashObject(value.manualHoldout)) throw new Error('Phase-B rework holdout hash is stale')
    const { packageHash, ...withoutHash } = value
    if (packageHash !== hashObject(withoutHash)) throw new Error('Phase-B rework package hash is stale')
    if (value.records.length !== PHASE_B_REWORK_SIZE || value.manualHoldout.length !== PHASE_B_REWORK_SIZE) throw new Error('Phase-B rework checkpoint must contain exactly 24 products and 24 manual media labels')
    if (value.records.some(record => record.officialStatus !== 'UNRESOLVED_REVIEW')) throw new Error('Unresolved official status may not be promoted in checkpoint')
}

function redactHtml(html: string): string {
    return cleanupProductHtml(html).replace(/https?:\/\/[^\s"'<>]+/gi, '[media URL redacted]')
}

function dashboardMedia(media: ReworkMediaProposal, visibility: 'public' | 'private'): ReworkDashboardMedia {
    return { ...media, ...(visibility === 'private' ? { url: media.url } : { url: undefined }), urlRedacted: `[redacted URL sha256=${sha256(normalizeImageUrl(media.url || ''))}]` }
}

export function createReworkDashboardModel(value: ReworkCheckpointPackage, visibility: 'public' | 'private'): ReworkDashboardModel {
    const products = value.records.map(record => ({
        ...record.product,
        editorialStatus: record.editorialStatus,
        editorialReviewReason: record.editorial.editorialReviewReason,
        editorialQuality: record.editorial,
        narrativeFamily: record.narrativeFamily,
        structure: record.structure,
        holdout: record.holdout,
        holdoutStatus: record.holdoutStatus,
        officialStatus: record.officialStatus,
        blockedReasons: record.blockedReasons,
        beforeHtml: visibility === 'private' ? cleanupProductHtml(record.input.descriptionHtml) : redactHtml(record.input.descriptionHtml),
        afterHtml: visibility === 'private' ? cleanupProductHtml(record.generatedHtml) : redactHtml(record.generatedHtml),
        previewHtml: visibility === 'private' ? cleanupProductHtml(record.generatedHtml) : redactHtml(record.generatedHtml),
        diff: diff(record.input.descriptionHtml, record.generatedHtml),
        media: record.media.map(media => dashboardMedia(media, visibility)),
    })).sort((a, b) => a.id - b.id)
    return {
        schemaVersion: PHASE_B_REWORK_SCHEMA_VERSION,
        dashboard: 'leo-493-phase-b-rework-checkpoint',
        packageHash: value.packageHash,
        proposalHash: value.proposalHash,
        policyHash: value.policyHash,
        snapshotHash: value.snapshotHash,
        sourceCommit: value.sourceCommit,
        bindingStatus: 'VALID',
        products,
        ...(visibility === 'private' ? { privateMedia: true } : {}),
    }
}

export function buildReworkDeterministicExport(model: ReworkDashboardModel, state: { products?: Record<string, string>; images?: Record<string, string> } = {}): string {
    if (model.bindingStatus !== 'VALID') throw new Error('Cannot export stale Phase-B rework binding')
    const payload = {
        schemaVersion: model.schemaVersion,
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
            images: product.media.map(media => ({ sourceId: media.sourceId, fingerprint: media.fingerprint, decision: state.images?.[`${product.id}:${media.sourceId}`] || media.currentDecision, classification: media.classification })),
        })).sort((a, b) => a.productId - b.productId),
    }
    const stable = (value: unknown): unknown => Array.isArray(value)
        ? value.map(stable)
        : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, stable(nested)]))
            : value
    return `${JSON.stringify(stable(payload), null, 2)}\n`
}
