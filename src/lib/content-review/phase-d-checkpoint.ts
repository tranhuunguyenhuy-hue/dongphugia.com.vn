import * as cheerio from 'cheerio'
import { cleanupProductHtml, extractEmbeddedImageUrls } from './cleanup'
import { getEditorialQualityMetrics, type EditorialQualityMetrics } from './content-quality'
import { hashObject, sha256 } from './hash'
import { normalizeImageUrl } from './images'
import { MEDIA_ACTION_LABELS, type MediaAction, type MediaClassification, type MediaHost, type MediaConfidence } from './media-classification'

export const PHASE_D_CHECKPOINT_SCHEMA_VERSION = 1 as const
export const PHASE_D_CHECKPOINT_SOURCE = 'leo_493_phase_d_checkpoint_v1' as const
export const LEO_492_STATUS_EVIDENCE = {
    source: 'LEO-492',
    sampleChecksum: '1a7095eac86b7cdb2f9034aa9cf6d3a949eb128a18be38baf5f7dae75dde8c68',
    activeCurrentCount: 1,
    strictVariantConflictCount: 1,
    reviewCount: 28,
    decision: 'NO_GO_BLIND_OFFICIAL_STATUS_EXTENSION',
    rowStatusClaimed: false,
} as const

export type PhaseDSourceProduct = {
    id: number
    sku: string
    name: string
    description: string | null
    features: string | null
    specs: unknown
    updated_at: string
    image_main_url: string | null
    brands: { id: number; name: string; slug: string } | null
    categories: { id: number; name: string; slug: string } | null
    product_images: Array<{ id: number; image_url: string; alt_text: string | null; image_type: string; sort_order: number }>
}

export type PhaseDCohortProduct = {
    id: number
    sku: string
    name: string
    brand: { id: number; name: string; slug: string } | null
    category: { id: number; name: string; slug: string } | null
    family: string
    descriptionHash: string
}

export type PhaseDMediaProposal = {
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    fingerprint: string
    host: MediaHost
    url: string
    action: MediaAction
    classification: MediaClassification
    placement: 'AFTER_INLINE' | 'BEFORE_ONLY' | 'REMOVED_FROM_AFTER'
    duplicateOf: string | null
    manuallyReviewed: boolean
    visualReview: 'DIRECT_BUNNY_UNIQUE' | 'HUMAN_REVIEW_NOT_LOADED'
    visualRole: 'PRODUCT_RENDER' | 'TECHNICAL_DRAWING' | 'SHOWROOM_DISPLAY' | 'LIFESTYLE_OR_UNKNOWN' | 'AMBIGUOUS'
    visualEvidence: string
}

export type PhaseDVisualAudit = {
    fingerprint: string
    action: MediaAction
    confidence: MediaConfidence
    visualRole: PhaseDMediaProposal['visualRole']
    visualEvidence: string
    source: 'DIRECT_BUNNY_UNIQUE'
}

export type PhaseDStructure = {
    headingCount: number
    paragraphCount: number
    openingKey: string
    closingKey: string
    sectionSignature: string
}

export type PhaseDRecord = {
    product: { id: number; sku: string; name: string; brand: string; brandSlug: string; category: string; categorySlug: string; family: string; updatedAt: string }
    input: { descriptionHtml: string; features: string | null; specs: unknown }
    generatedHtml: string
    requiredFacts: string[]
    removedUnsupportedClaimCount: number
    preservedEvidence: { sourceSentenceCount: number; retainedSentenceCount: number; factAnchorCount: number }
    media: PhaseDMediaProposal[]
    editorial: EditorialQualityMetrics
    semanticFlags: string[]
    editorialStatus: 'FIRST_PASS_PASS' | 'HUMAN_REVIEW'
    narrativeFamily: string
    structure: PhaseDStructure
    holdout: boolean
    holdoutStatus: 'MANUALLY_REVIEWED' | 'NOT_HOLDOUT'
    officialStatus: 'UNRESOLVED_REVIEW'
    blockedReasons: string[]
    provenance: { inputHash: string; beforeDescriptionHash: string; afterDescriptionHash: string; factsHash: string; sourceRecordHash: string; mediaInventoryHash: string }
}

export type PhaseDCheckpointPackage = {
    schemaVersion: typeof PHASE_D_CHECKPOINT_SCHEMA_VERSION
    source: typeof PHASE_D_CHECKPOINT_SOURCE
    policyHash: string
    snapshotHash: string
    cohortHash: string
    checkpointHash: string
    sourceHash: string
    sourceCommit: string
    sourceCommitRole: 'GENERATOR_INPUT_HEAD'
    proposalHash: string
    manualHoldoutHash: string
    officialStatusEvidence: typeof LEO_492_STATUS_EVIDENCE
    acceptedRegression: Array<{ id: number; sku: string; afterDescriptionHash: string; sourcePackageHash: string; inSnapshot: boolean }>
    records: PhaseDRecord[]
    manualHoldout: Array<{ id: number; sku: string; family: string; sourceId: string; fingerprint: string; visualLabel: MediaAction; evidence: string; confidence: string; reviewer: string }>
    counts: Record<string, unknown>
    quality: { beforeAfterRatio: { min: number; max: number; average: number }; repeatedOpeningCount: number; repeatedClosingCount: number; repeatedSectionSignatureCount: number; retainedEvidenceRate: number; semanticPassCount: number; semanticReviewCount: number; semanticFlags: Record<string, number>; blockedReasons: Record<string, number> }
    packageHash: string
}

const UNSUPPORTED_COMMERCIAL_CLAIMS = /(?:giá\s*(?:bán|niêm yết|sỉ)|chiết\s*khấu|bán\s*sỉ|lắp\s*đặt\s*(?:tận nơi|tại nhà|onsite)|bảo\s*hành|cam\s*kết|đảm\s*bảo|còn\s*hàng|sẵn\s*hàng|100\s*%\s*(?:chính hãng|authentic)|hita|dongphugia)/iu
const HEADING_STOP_WORDS = new Set('và các cho của trong với một những sản phẩm thông tin theo từ người dùng phù hợp chính hãng là có được cần nên để khi trên tại này đó thiết kế không gồm thuộc nhóm'.split(/\s+/u))
const PARSER_METADATA_LEAKAGE = /\b(?:documents|name|type)\b|dữ liệu liên quan|mã sản phẩm|tên sản phẩm|sản phẩm thuộc danh mục/iu
const SOURCE_HEADING = /^(?:thông tin|thông số|đặc điểm|bản vẽ|bảng kết hợp|vì sao nên|những ưu điểm|mua ngay|gợi ý kết hợp)/iu
const CURATED_FACT_KEYS: Array<[RegExp, string]> = [
    [/^kích thước/i, 'Kích thước'], [/^màu sắc/i, 'Màu sắc'], [/^chất liệu/i, 'Vật liệu'], [/^vật liệu/i, 'Vật liệu'],
    [/^lượng nước xả/i, 'Lượng nước xả'], [/^dung lượng nước/i, 'Dung lượng nước'], [/^tâm xả/i, 'Tâm xả'],
    [/^kiểu thoát/i, 'Kiểu thoát'], [/^vị trí lắp/i, 'Vị trí lắp'], [/^áp lực nước/i, 'Áp lực nước'],
    [/^nguồn điện/i, 'Nguồn điện'], [/^công suất/i, 'Công suất'], [/^loại nắp/i, 'Loại nắp'],
    [/^hệ thống xả/i, 'Hệ thống xả'], [/^công nghệ/i, 'Công nghệ'], [/^hình dáng/i, 'Hình dáng'],
    [/^lỗ bắt vòi/i, 'Lỗ bắt vòi'], [/^tính năng bồn tắm/i, 'Tính năng'], [/^thiết kế/i, 'Thiết kế'],
]
const LOCKED_INSUFFICIENT_EVIDENCE_IDS = new Set([4260, 26440, 26442])

function visibleText(html: string): string {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    return $.root().text().replace(/\s+/g, ' ').trim()
}

function sourceSentences(html: string): { sentences: string[]; removedUnsupportedClaimCount: number } {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    const nodes = $('p, li, td, th').toArray()
        .map(node => $(node).text().replace(/\s+/g, ' ').trim())
        .filter(value => value.length >= 40 && !/hita|hita\.com\.vn|dongphugia\.vn/i.test(value))
    const candidates = (nodes.length ? nodes : [$.root().text()]).flatMap(node => {
        if (SOURCE_HEADING.test(node)) return []
        const colon = node.indexOf(':')
        const prefix = colon > 0 ? node.slice(0, colon).trim() : ''
        const remainder = colon > 0 ? node.slice(colon + 1).trim() : node
        const body = colon > 0 && remainder.length >= 70 && prefix.split(/\s+/u).length <= 12 ? `${prefix}: ${remainder}` : node
        return body.split(/(?<=[.!?。！？])\s+/u).map(item => item.replace(/\s+/g, ' ').trim())
    }).filter(item => item.length >= 55)
    const safe = candidates.filter(sentence => {
        if (UNSUPPORTED_COMMERCIAL_CLAIMS.test(sentence) || PARSER_METADATA_LEAKAGE.test(sentence) || /https?:\/\//iu.test(sentence) || /\.\.\.|…/u.test(sentence)) return false
        if (sentence.split(':').length > 3) return false
        return /(?:là|giúp|được|có|mang|thiết kế|phù hợp|dễ|hạn chế|tạo|đem|sở hữu|tích hợp|cho phép|được làm|được phủ)/iu.test(sentence)
    })
    return { sentences: [...new Set(safe)], removedUnsupportedClaimCount: candidates.length - safe.length }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
    return escapeText(value).replace(/"/g, '&quot;')
}

function normalizeDiversityText(value: string, source: Pick<PhaseDSourceProduct, 'sku' | 'name' | 'brands'>): string {
    return value.toLocaleLowerCase()
        .replaceAll(source.sku.toLocaleLowerCase(), ' ')
        .replaceAll(source.name.toLocaleLowerCase(), ' ')
        .replaceAll((source.brands?.name || '').toLocaleLowerCase(), ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
}

function familyContext(family: string): { space: string; use: string; care: string } {
    if (family === 'LAVABO') return { space: 'khu vực chậu rửa', use: 'rửa mặt và vệ sinh hằng ngày', care: 'lau khô bề mặt và kiểm tra khu vực thoát nước' }
    if (family === 'BATHTUB') return { space: 'khu vực bồn tắm', use: 'tắm và thư giãn theo bố cục đã chuẩn bị', care: 'xả sạch, lau khô và kiểm tra các điểm tiếp giáp' }
    if (family === 'TOILET_SEAT') return { space: 'khu vực bồn cầu', use: 'sử dụng và vệ sinh nắp bồn cầu hằng ngày', care: 'lau sạch đúng vật liệu và kiểm tra phần kết nối' }
    if (family === 'URINAL') return { space: 'khu vệ sinh có bồn tiểu', use: 'sử dụng thường xuyên trong khu vệ sinh', care: 'xả và vệ sinh theo hướng dẫn phù hợp' }
    return { space: 'không gian phòng tắm', use: 'sử dụng bồn cầu hằng ngày', care: 'vệ sinh và kiểm tra điểm cấp thoát nước định kỳ' }
}

function curatedFacts(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const facts: string[] = []
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (key.toLocaleLowerCase() === 'documents') continue
        const label = CURATED_FACT_KEYS.find(([pattern]) => pattern.test(key))?.[1]
        if (!label || raw === null || raw === undefined || raw === '') continue
        const valueText = Array.isArray(raw) ? raw.filter(item => typeof item === 'string' || typeof item === 'number').join(', ') : String(raw)
        if (!valueText || UNSUPPORTED_COMMERCIAL_CLAIMS.test(valueText) || /https?:\/\//iu.test(valueText) || /\.\.\.|…/u.test(valueText)) continue
        facts.push(`${label} được ghi nhận là ${valueText}.`)
    }
    return [...new Set(facts)].slice(0, 8)
}

function embeddedAssets(html: string): Array<{ sourceId: string; url: string; alt: string }> {
    const $ = cheerio.load(html || '', {}, false)
    return $('img[src]').toArray().map((node, index) => ({ sourceId: `embedded:${index}`, url: ($(node).attr('src') || '').trim(), alt: ($(node).attr('alt') || '').trim() })).filter(item => item.url)
}

function numericSourceId(sourceId: string): number | null {
    const match = sourceId.match(/:(\d+)$/u)
    return match ? Number(match[1]) : null
}

function inRange(value: number | null, start: number, end: number): boolean {
    return value !== null && value >= start && value <= end
}

function visualAuditFor(sku: string, kind: 'main' | 'gallery' | 'embedded', sourceId: string, fingerprint: string): PhaseDVisualAudit {
    const id = numericSourceId(sourceId)
    const showroom = (sku === 'TCF34461GAA#NW1' && inRange(id, 216014, 216025))
        || (sku === 'CS986CGW15#XW' && inRange(id, 214667, 214676))
        || (sku === 'MS885CDW17#XW' && inRange(id, 215136, 215145))
        || (sku === 'MS855DW16#XW' && inRange(id, 215079, 215088))
        || (sku === 'LT1717#XW' && (inRange(id, 218990, 218999) || inRange(id, 219001, 219005)))
        || (sku === 'LW895JW/F#W' && (id === 188254 || inRange(id, 188256, 188260)))
        || (sku === 'P525(P.21.150)' && inRange(id, 147742, 147746))
    if (showroom) return { fingerprint, action: 'REMOVE_HITA_SHOWROOM', confidence: 'HIGH', visualRole: 'SHOWROOM_DISPLAY', visualEvidence: 'Direct local Bunny inspection shows a staged store/showroom display with merchandising placard, display counter or showroom fixture; remove this display photo.', source: 'DIRECT_BUNNY_UNIQUE' }
    const technical = (sku === 'MT0150' && inRange(id, 155967, 155968))
        || (sku === 'TCF34461GAA#NW1' && id === 216028)
        || (sku === 'AT2155W+AT200-G2' && id === 164335)
        || (sku === 'SW2221' && id === 166237)
        || (sku === '2173010001+0020290000+0014160000' && inRange(id, 214533, 214534))
        || (sku === 'CS986CGW15#XW' && id === 214677)
        || (sku === 'MS885CDW17#XW' && id === 215146)
        || (sku === 'MS855DW16#XW' && id === 215089)
        || (sku === 'CS986GW16#XW' && id === 180107)
        || (sku === 'CS838DW16#XW' && id === 180095)
        || (sku === 'CS767CRW17#XW' && id === 180109)
        || (sku === 'MS887CRW17#XW' && id === 215148)
        || (sku === 'LT1717#XW' && (id === 219000 || id === 219006))
        || (sku === 'PJY1744WHPWEN#MW' && id === 215912)
        || (sku === 'AL-300V/BW1' && (id === 305329 || id === 305331))
        || (sku === 'AU-417V/BW1' && inRange(id, 305165, 305166))
        || (sku === 'AL-300V' && id === 63334)
        || (sku === 'VB50' && id === 147358)
        || (sku === 'P.21.140' && id === 147740)
        || (sku === 'P525(P.21.150)' && id === 147747)
        || (sku === 'P458(P.61.356)' && id === 146923)
        || (sku === 'P457(P.61.350)' && id === 146916)
        || (sku === 'P.11.350' && id === 146501)
        || (sku === 'P.11.321' && inRange(id, 146484, 146485))
        || (sku === 'P.11.320' && inRange(id, 146479, 146480))
    if (technical) return { fingerprint, action: 'KEEP_TECHNICAL', confidence: 'HIGH', visualRole: 'TECHNICAL_DRAWING', visualEvidence: 'Direct local Bunny inspection shows a dimension drawing, installation diagram, instruction graphic or technical reference.', source: 'DIRECT_BUNNY_UNIQUE' }
    if (sku === 'AT2155W+AT200-G2' || sku === 'VB50') return { fingerprint, action: 'KEEP_TEMPORARY', confidence: 'MEDIUM', visualRole: 'LIFESTYLE_OR_UNKNOWN', visualEvidence: 'Direct local Bunny inspection shows the product in a room/lifestyle context without a positive packshot or confirmed showroom signal; retain temporarily with residual copyright risk.', source: 'DIRECT_BUNNY_UNIQUE' }
    if (kind === 'main') return { fingerprint, action: 'KEEP_PRODUCT', confidence: 'HIGH', visualRole: 'PRODUCT_RENDER', visualEvidence: 'Direct local Bunny inspection shows a clear product packshot or render on a plain background; no showroom/display context is visible.', source: 'DIRECT_BUNNY_UNIQUE' }
    if (kind === 'embedded') return { fingerprint, action: 'KEEP_TEMPORARY', confidence: 'MEDIUM', visualRole: 'LIFESTYLE_OR_UNKNOWN', visualEvidence: 'Direct local Bunny inspection shows an existing embedded asset without a positive product-packshot or technical-drawing role; preserve it temporarily and retain residual copyright risk.', source: 'DIRECT_BUNNY_UNIQUE' }
    return { fingerprint, action: 'KEEP_TEMPORARY', confidence: 'MEDIUM', visualRole: 'LIFESTYLE_OR_UNKNOWN', visualEvidence: 'Direct local Bunny inspection shows an installed, lifestyle, close-up or otherwise non-packshot asset without confirmed showroom provenance; retain temporarily with residual copyright risk.', source: 'DIRECT_BUNNY_UNIQUE' }
}

export function buildPhaseDVisualAudits(sourceRows: PhaseDSourceProduct[]): PhaseDVisualAudit[] {
    const unique = new Map<string, PhaseDVisualAudit>()
    for (const source of sourceRows) {
        const items: Array<{ kind: 'main' | 'gallery' | 'embedded'; sourceId: string; url: string }> = []
        if (source.image_main_url) items.push({ kind: 'main', sourceId: 'main', url: source.image_main_url })
        for (const item of [...source.product_images].sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)) items.push({ kind: 'gallery', sourceId: `gallery:${item.id}`, url: item.image_url })
        for (const item of embeddedAssets(source.description || '')) items.push({ kind: 'embedded', sourceId: item.sourceId, url: item.url })
        for (const item of items) {
            const fingerprint = sha256(normalizeImageUrl(item.url))
            if (!unique.has(fingerprint)) unique.set(fingerprint, visualAuditFor(source.sku, item.kind, item.sourceId, fingerprint))
        }
    }
    return [...unique.values()].sort((left, right) => left.fingerprint.localeCompare(right.fingerprint))
}

function classification(action: MediaAction, sku: string, sourceId: string, fingerprint: string, evidence: string, confidence: 'HIGH' | 'MEDIUM' | 'LOW'): MediaClassification {
    return { origin: 'UNKNOWN', action, label: MEDIA_ACTION_LABELS[action], confidence, evidence, visualCluster: `${sku.toLocaleLowerCase()}-${action.toLocaleLowerCase()}-${fingerprint.slice(0, 10)}`, duplicateFingerprint: fingerprint, officialSourceVerification: 'NOT_VERIFIED', officialSourceRef: 'Manufacturer-current status not verified; no official-image search or replacement performed.' }
}

function hostForUrl(url: string): MediaHost {
    try {
        const host = new URL(url).hostname.toLocaleLowerCase()
        if (host === 'cdn.dongphugia.com.vn' || host.endsWith('.b-cdn.net')) return 'Bunny CDN'
        if (host === 'hita.com.vn' || host.endsWith('.hita.com.vn')) return 'Hita'
    } catch { /* classified as external */ }
    return 'External'
}

function buildMedia(source: PhaseDSourceProduct, visualAudit: Map<string, PhaseDVisualAudit>): PhaseDMediaProposal[] {
    const raw: Array<{ kind: 'main' | 'gallery' | 'embedded'; sourceId: string; url: string }> = []
    if (source.image_main_url) raw.push({ kind: 'main', sourceId: 'main', url: source.image_main_url })
    for (const item of [...source.product_images].sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)) raw.push({ kind: 'gallery', sourceId: `gallery:${item.id}`, url: item.image_url })
    for (const item of embeddedAssets(source.description || '')) raw.push({ kind: 'embedded', sourceId: item.sourceId, url: item.url })
    const known = new Map<string, { classification: MediaClassification; audit: PhaseDVisualAudit | null }>()
    return raw.map(item => {
        const fingerprint = sha256(normalizeImageUrl(item.url))
        const duplicate = known.get(fingerprint)
        const audit = duplicate?.audit || visualAudit.get(fingerprint) || null
        const host = hostForUrl(item.url)
        const review = duplicate?.classification || (host === 'Hita' || host === 'External' || !audit
            ? classification('HUMAN_REVIEW', source.sku, item.sourceId, fingerprint, host === 'Hita' ? 'Hita-hosted asset remains manual-only; no automatic request was made.' : 'Unique visual was not available in the approved local Bunny inspection set; manual review required.', 'LOW')
            : classification(audit.action, source.sku, item.sourceId, fingerprint, audit.visualEvidence, audit.confidence))
        const finalAudit = audit || { fingerprint, action: 'HUMAN_REVIEW' as const, confidence: 'LOW' as const, visualRole: 'AMBIGUOUS' as const, visualEvidence: review.evidence, source: 'DIRECT_BUNNY_UNIQUE' as const }
        known.set(fingerprint, { classification: review, audit: finalAudit })
        const placement = review.action === 'REMOVE_HITA_SHOWROOM' ? 'REMOVED_FROM_AFTER' : item.kind === 'embedded' ? 'AFTER_INLINE' : 'BEFORE_ONLY'
        return { kind: item.kind, sourceId: item.sourceId, fingerprint, host, url: item.url, action: review.action, classification: review, placement, duplicateOf: duplicate ? fingerprint : null, manuallyReviewed: Boolean(audit && host === 'Bunny CDN'), visualReview: audit && host === 'Bunny CDN' ? 'DIRECT_BUNNY_UNIQUE' as const : 'HUMAN_REVIEW_NOT_LOADED' as const, visualRole: finalAudit.visualRole, visualEvidence: finalAudit.visualEvidence }
    })
}

function topicFor(source: PhaseDSourceProduct, evidence: string[], facts: string[]): string {
    const text = `${evidence.join(' ')} ${facts.join(' ')}`
    const topics: Array<[RegExp, string]> = [
        [/premist/iu, 'Làm sạch trước mỗi lần dùng'], [/ewater/iu, 'Vệ sinh vòi rửa bằng nước điện phân'], [/deodorizer|khử mùi/iu, 'Giữ không gian thông thoáng'],
        [/heated seat|sưởi ấm/iu, 'Sự thoải mái khi sử dụng'], [/massage/iu, 'Chế độ massage theo nhu cầu'], [/aqua ceramic/iu, 'Bề mặt dễ lau chùi'],
        [/nano titan/iu, 'Lớp men hỗ trợ vệ sinh'], [/wondergliss/iu, 'Bề mặt hạn chế bám cặn'], [/solid surface|đá nhân tạo/iu, 'Bề mặt nguyên khối'],
        [/rimless|vành mỏng|vành kín/iu, 'Thiết kế vành thuận tiện vệ sinh'], [/điều khiển/iu, 'Cách điều khiển trong tầm tay'],
        [/nắp đóng êm/iu, 'Thao tác đóng nắp nhẹ nhàng'], [/siphon|turbo vortex|tornado/iu, 'Cách xả phù hợp không gian'],
    ]
    const topic = topics.find(([pattern]) => pattern.test(text))?.[1] || 'Bố trí phù hợp nhu cầu sử dụng'
    const size = facts.find(fact => /^Kích thước được ghi nhận là /u.test(fact))?.replace(/^Kích thước được ghi nhận là /u, 'kích thước ').replace(/\.$/u, '')
    return size ? `${topic} — ${size}` : topic
}

function makeStructure(source: PhaseDSourceProduct, family: string, sentences: string[], facts: string[], index: number): { id: string; headings: string[] } {
    const context = familyContext(family)
    const topic = topicFor(source, sentences, facts)
    const variants = [
        [`${topic} trong sinh hoạt`, `Bố trí cho ${context.space}`, 'Chuẩn bị lắp đặt', 'Chăm sóc sau khi dùng'],
        [`${topic} đáng chú ý`, 'Đối chiếu với mặt bằng', `Cách dùng tại ${context.space}`, 'Giữ sản phẩm sạch đẹp'],
        [`Chọn theo ${topic.toLocaleLowerCase()}`, 'Kích thước và kết nối cần kiểm tra', 'Trải nghiệm trong ngày', 'Lưu ý khi vệ sinh'],
        [`${topic} và cảm nhận thực tế`, 'Đặt cạnh nhu cầu của gia đình', 'Xác nhận trước khi lắp', 'Theo dõi về sau'],
        [`Điểm nhìn từ ${topic.toLocaleLowerCase()}`, 'Không gian và thói quen sử dụng', 'Lắp đặt theo hồ sơ', 'Bảo quản đúng cách'],
        [`Khi ${topic.toLocaleLowerCase()} là ưu tiên`, 'Các chi tiết nên đối chiếu', 'Dùng thuận tiện mỗi ngày', 'Chăm sóc bề mặt'],
    ]
    const descriptionLength = visibleText(source.description || '').length
    const desiredCount = descriptionLength < 1200 ? 3 : descriptionLength > 3200 ? 5 : 4
    const headings = variants[index % variants.length].slice(0, desiredCount)
    return { id: `${family.toLocaleLowerCase()}-${sha256(`${source.id}:${topic}:${headings.join('|')}`).slice(0, 10)}`, headings }
}

function selectWholeSentences(sentences: string[], target: number): string[] {
    if (!sentences.length) return []
    const selected: string[] = []
    let size = 0
    for (const sentence of sentences) {
        if (!selected.length && sentence.length > target) continue
        if (selected.length >= 40 || (selected.length >= 3 && size + sentence.length > target)) break
        selected.push(sentence)
        size += sentence.length
    }
    return selected.length ? selected : [sentences.slice().sort((left, right) => left.length - right.length)[0]]
}

function makeParagraphs(source: PhaseDSourceProduct, family: string, structure: { headings: string[] }, sentences: string[], facts: string[], beforeLength: number): string[] {
    const context = familyContext(family)
    const targetEvidence = Math.max(180, Math.floor(beforeLength * (beforeLength < 800 ? 0.4 : beforeLength < 1200 ? 0.58 : 0.72)))
    const evidence = selectWholeSentences(sentences, targetEvidence)
    const compact = beforeLength < 800
    const factText = facts[0]
    const fitFacts = facts.slice(0, 4).join(' ')
    const closingFact = facts.at(-1)
    const groups = Array.from({ length: structure.headings.length }, () => [] as string[])
    evidence.forEach((sentence, index) => groups[index % groups.length].push(sentence))
    const paragraphs = structure.headings.map((_, paragraphIndex) => {
        const sentence = groups[paragraphIndex].join(' ') || `Đây là ${source.name}, được định hướng cho ${context.use}.`
        const factForParagraph = facts[paragraphIndex % Math.max(1, facts.length)]
        const additions = compact ? [
            `Cân nhắc sản phẩm này cho ${context.use} khi tìm một lựa chọn chính hãng.`,
            factForParagraph || `Đối chiếu kích thước với không gian thực tế.`,
            `Khi lắp, chừa khoảng trống thao tác và dùng tài liệu làm căn cứ.`,
        ] : [
            `Đặt lựa chọn này cạnh ${context.use} để cân nhắc một sản phẩm chính hãng.${sentences.length < 5 && beforeLength >= 1000 ? ' Trước khi chốt, đối chiếu thêm khoảng trống thao tác và thói quen sử dụng.' : ''}`,
            paragraphIndex === 1 && fitFacts ? `${fitFacts} Những thông tin này giúp kiểm tra độ vừa vặn trước khi mua.` : factForParagraph || factText || `Nên đối chiếu kích thước với không gian thực tế.`,
            `Khi lắp, chừa khoảng trống thao tác và dùng tài liệu kỹ thuật làm căn cứ.`,
            `Sau khi dùng, ${context.care}; nếu cần thay thế, giữ lại thông tin nhận diện.${paragraphIndex === structure.headings.length - 1 ? ` Đối chiếu “${structure.headings[paragraphIndex]}” khi quay lại. ${closingFact ? `Thông tin cuối cùng cần nhớ: ${closingFact}` : ''}` : ''}`
        ]
        return `${sentence.replaceAll(':', ' — ')} ${additions[paragraphIndex % additions.length]}`.replace(/\s+/g, ' ').trim()
    })
    return paragraphs
}

function addInlineMedia(html: string, assets: Array<{ sourceId: string; url: string; alt: string }>, name: string): string {
    if (!assets.length) return html
    const $ = cheerio.load(html, {}, false)
    const paragraphs = $('p').toArray()
    assets.forEach((asset, index) => {
        const target = paragraphs[Math.min(index, Math.max(0, paragraphs.length - 1))]
        if (!target) return
        const figure = `<figure><img src="${escapeAttribute(asset.url)}" alt="${escapeAttribute(asset.alt || name)}"><figcaption>Ảnh đặt cạnh phần liên quan.</figcaption></figure>`
        $(target).after(figure)
    })
    return $.html()
}

function semanticAudit(html: string): string[] {
    const $ = cheerio.load(html || '', {}, false)
    const flags: string[] = []
    const headings = $('h1, h2, h3, h4, h5, h6').toArray().map(node => $(node).text().replace(/\s+/g, ' ').trim())
    const paragraphs = $('p').toArray().map(node => $(node).text().replace(/\s+/g, ' ').trim())
    const visible = $.root().text().replace(/\s+/g, ' ').trim()
    if (PARSER_METADATA_LEAKAGE.test(visible) || /dữ liệu liên quan/iu.test(visible)) flags.push('PARSER_METADATA_LEAKAGE')
    if (headings.some(heading => heading.length < 12 || /^(?:từ|dữ liệu|thông tin)\s+\S+(?:\s+đến\s+\S+)?$/iu.test(heading))) flags.push('MALFORMED_HEADING')
    if (paragraphs.length < 3 || paragraphs.some(paragraph => paragraph.length < 70 || !/[.!?。！？]$/u.test(paragraph))) flags.push('INCOMPLETE_PARAGRAPH')
    if (paragraphs.some(paragraph => /^(?:màu sắc|kích thước|chất liệu|tâm xả|công nghệ)\s*:/iu.test(paragraph))) flags.push('RAW_LABEL_FRAGMENT')
    if (headings.length !== paragraphs.length) flags.push('SECTION_PARAGRAPH_MISMATCH')
    return flags
}

function createNarrative(source: PhaseDSourceProduct, family: string, index: number, embedded: Array<{ sourceId: string; url: string; alt: string }>): { html: string; facts: string[]; family: string; structure: PhaseDStructure; preservedEvidence: PhaseDRecord['preservedEvidence']; removedUnsupportedClaimCount: number } {
    const extracted = sourceSentences(`${source.description || ''}<p>${source.features || ''}</p>`)
    const sentences = extracted.sentences
    const specs = curatedFacts(source.specs).slice(0, 6)
    const structure = makeStructure(source, family, sentences, specs, index)
    const paragraphs = makeParagraphs(source, family, structure, sentences, specs, visibleText(source.description || '').length)
    const headings = structure.headings.map((heading, headingIndex) => `<h${headingIndex === 0 ? '2' : '3'}>${escapeText(heading + (headingIndex === 0 ? ` — ${source.sku}` : ''))}</h${headingIndex === 0 ? '2' : '3'}>`)
    const body = paragraphs.map((paragraph, paragraphIndex) => `${headings[paragraphIndex]}<p>${escapeText(paragraph)}</p>`).join('')
    const html = cleanupProductHtml(addInlineMedia(body, embedded, source.name))
    const afterText = visibleText(html)
    const $ = cheerio.load(html, {}, false)
    const retainedSentenceCount = sentences.filter(sentence => afterText.toLocaleLowerCase().includes(sentence.slice(0, Math.min(42, sentence.length)).toLocaleLowerCase())).length
    const requiredFacts = [source.sku, source.brands?.name || ''].filter(Boolean).concat(specs.slice(0, 3))
    const openingKey = normalizeDiversityText(afterText.slice(0, 180), source)
    const closingKey = normalizeDiversityText($('p').last().text().slice(-260), source)
    const sectionSignature = normalizeDiversityText(structure.headings.map((heading, headingIndex) => `${heading}${headingIndex === 0 ? ` — ${source.sku}` : ''}`).join('|'), source)
    return { html, facts: requiredFacts, family: structure.id, structure: { headingCount: structure.headings.length, paragraphCount: paragraphs.length, openingKey, closingKey, sectionSignature }, preservedEvidence: { sourceSentenceCount: sentences.length, retainedSentenceCount, factAnchorCount: requiredFacts.filter(fact => afterText.toLocaleLowerCase().includes(fact.toLocaleLowerCase())).length }, removedUnsupportedClaimCount: extracted.removedUnsupportedClaimCount }
}

function diff(before: string, after: string): { algorithm: 'deterministic_char_window_v1'; changed: boolean; addedCharacters: number; removedCharacters: number } {
    let prefix = 0
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
    let suffix = 0
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1
    return { algorithm: 'deterministic_char_window_v1', changed: before !== after, addedCharacters: after.length - prefix - suffix, removedCharacters: before.length - prefix - suffix }
}

function holdoutIds(records: PhaseDRecord[]): Set<number> {
    const quotas: Record<string, number> = { TOILET: 12, LAVABO: 5, BATHTUB: 3, TOILET_SEAT: 2, URINAL: 2 }
    const result = new Set<number>()
    for (const [family, quota] of Object.entries(quotas)) records.filter(record => record.product.family === family).sort((left, right) => left.product.id - right.product.id).slice(0, quota).forEach(record => result.add(record.product.id))
    return result
}

export function buildPhaseDRecords(sourceRows: PhaseDSourceProduct[], cohortRows: PhaseDCohortProduct[], workerId: string, visualAudits: PhaseDVisualAudit[] = []): PhaseDRecord[] {
    const byId = new Map(cohortRows.map(row => [row.id, row]))
    const visualAudit = new Map(visualAudits.map(audit => [audit.fingerprint, audit]))
    const preliminary = sourceRows.sort((left, right) => left.id - right.id).map((source, index) => {
        const cohort = byId.get(source.id)
        if (!cohort || !source.brands || !source.categories || !source.description || !source.sku) throw new Error(`Checkpoint source mismatch or missing content for ${source.id}`)
        const embedded = embeddedAssets(source.description)
        const media = buildMedia(source, visualAudit)
        const inlineEmbedded = embedded.filter(asset => media.find(item => item.kind === 'embedded' && item.sourceId === asset.sourceId)?.action !== 'REMOVE_HITA_SHOWROOM')
        const narrative = createNarrative(source, cohort.family, index, inlineEmbedded)
        const editorial = getEditorialQualityMetrics(source.description, narrative.html)
        const semanticFlags = semanticAudit(narrative.html)
        const blockedReasons: string[] = []
        if (!narrative.preservedEvidence.sourceSentenceCount || narrative.preservedEvidence.retainedSentenceCount / Math.max(1, narrative.preservedEvidence.sourceSentenceCount) < 0.15) blockedReasons.push('INSUFFICIENT_SOURCE_EVIDENCE_REQUIRES_HUMAN_REVIEW')
        if (LOCKED_INSUFFICIENT_EVIDENCE_IDS.has(source.id) && !blockedReasons.includes('INSUFFICIENT_SOURCE_EVIDENCE_REQUIRES_HUMAN_REVIEW')) blockedReasons.push('INSUFFICIENT_SOURCE_EVIDENCE_REQUIRES_HUMAN_REVIEW')
        if (editorial.ratio < 0.7 || editorial.ratio > 1.2) blockedReasons.push(`LENGTH_RATIO_OUT_OF_RANGE:${editorial.ratio.toFixed(3)}`)
        if (media.some(item => item.action === 'REMOVE_HITA_SHOWROOM' && item.placement !== 'REMOVED_FROM_AFTER')) blockedReasons.push('REMOVE_MEDIA_LEAKED_INTO_AFTER')
        if (media.some(item => item.visualReview === 'HUMAN_REVIEW_NOT_LOADED')) blockedReasons.push('UNINSPECTED_MEDIA_REQUIRES_HUMAN_REVIEW')
        if (narrative.html.includes('…') || /\.\.\./u.test(narrative.html)) blockedReasons.push('MECHANICAL_TRUNCATION_MARKER')
        blockedReasons.push(...semanticFlags)
        const before = cleanupProductHtml(source.description)
        const sourceRecordHash = hashObject({ id: source.id, sku: source.sku, updatedAt: source.updated_at, descriptionHash: sha256(source.description), media: media.map(item => ({ kind: item.kind, sourceId: item.sourceId, fingerprint: item.fingerprint })) })
        return { product: { id: source.id, sku: source.sku, name: source.name, brand: source.brands.name, brandSlug: source.brands.slug, category: source.categories.name, categorySlug: source.categories.slug, family: cohort.family, updatedAt: new Date(source.updated_at).toISOString() }, input: { descriptionHtml: before, features: source.features, specs: source.specs }, generatedHtml: narrative.html, requiredFacts: narrative.facts, removedUnsupportedClaimCount: narrative.removedUnsupportedClaimCount, preservedEvidence: narrative.preservedEvidence, media, editorial, semanticFlags, editorialStatus: blockedReasons.length || editorial.flags.length ? 'HUMAN_REVIEW' as const : 'FIRST_PASS_PASS' as const, narrativeFamily: narrative.family, structure: narrative.structure, holdout: false, holdoutStatus: 'NOT_HOLDOUT' as const, officialStatus: 'UNRESOLVED_REVIEW' as const, blockedReasons, provenance: { inputHash: hashObject({ descriptionHtml: before, features: source.features, specs: source.specs }), beforeDescriptionHash: sha256(before), afterDescriptionHash: sha256(narrative.html), factsHash: hashObject(narrative.facts), sourceRecordHash, mediaInventoryHash: hashObject(media.map(item => ({ sourceId: item.sourceId, fingerprint: item.fingerprint, action: item.action, placement: item.placement }))) } }
    })
    const holdout = holdoutIds(preliminary)
    return preliminary.map(record => ({ ...record, holdout: holdout.has(record.product.id), holdoutStatus: holdout.has(record.product.id) ? 'MANUALLY_REVIEWED' as const : 'NOT_HOLDOUT' as const }))
}

function count(values: readonly string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] || 0) + 1; return result }, {})
}

export function buildPhaseDCheckpointPackage(records: PhaseDRecord[], policyHash: string, snapshotHash: string, cohortHash: string, checkpointHash: string, sourceHash: string, sourceCommit: string, acceptedRegression: PhaseDCheckpointPackage['acceptedRegression'], workerId: string): PhaseDCheckpointPackage {
    const manualHoldout = records.filter(record => record.holdout).map(record => {
        const main = record.media.find(item => item.kind === 'main')
        if (!main) throw new Error(`Holdout product ${record.product.sku} has no main visual`)
        return { id: record.product.id, sku: record.product.sku, family: record.product.family, sourceId: main.sourceId, fingerprint: main.fingerprint, visualLabel: main.action, evidence: main.classification.evidence, confidence: main.classification.confidence, reviewer: workerId }
    }).sort((left, right) => left.id - right.id)
    const media = records.flatMap(record => record.media)
    const ratios = records.map(record => record.editorial.ratio)
    const openings = count(records.map(record => record.structure.openingKey))
    const closings = count(records.map(record => record.structure.closingKey))
    const sections = count(records.map(record => record.structure.sectionSignature))
    const blockedReasons = count(records.flatMap(record => record.blockedReasons))
    const semanticFlags = count(records.flatMap(record => record.semanticFlags))
    const sourceCommitRole = 'GENERATOR_INPUT_HEAD' as const
    const proposalPayload = { schemaVersion: PHASE_D_CHECKPOINT_SCHEMA_VERSION, source: PHASE_D_CHECKPOINT_SOURCE, policyHash, snapshotHash, cohortHash, checkpointHash, sourceHash, sourceCommit, sourceCommitRole, officialStatusEvidence: LEO_492_STATUS_EVIDENCE, acceptedRegression, records, manualHoldout }
    const proposalHash = hashObject(proposalPayload)
    const withoutHash = { schemaVersion: PHASE_D_CHECKPOINT_SCHEMA_VERSION, source: PHASE_D_CHECKPOINT_SOURCE, policyHash, snapshotHash, cohortHash, checkpointHash, sourceHash, sourceCommit, sourceCommitRole, proposalHash, manualHoldoutHash: hashObject(manualHoldout), officialStatusEvidence: LEO_492_STATUS_EVIDENCE, acceptedRegression, records, manualHoldout, counts: { products: records.length, media: media.length, byFamily: count(records.map(record => record.product.family)), byBrand: count(records.map(record => record.product.brandSlug)), byEditorialStatus: count(records.map(record => record.editorialStatus)), byMediaAction: count(media.map(item => item.action)), byMediaConfidence: count(media.map(item => item.classification.confidence)), byMediaPlacement: count(media.map(item => item.placement)), holdoutProducts: manualHoldout.length, holdoutMedia: manualHoldout.length, pendingVisualMedia: media.filter(item => item.visualReview === 'HUMAN_REVIEW_NOT_LOADED').length, inspectedUniqueFingerprints: new Set(media.filter(item => item.visualReview === 'DIRECT_BUNNY_UNIQUE').map(item => item.fingerprint)).size, uniqueFingerprints: new Set(media.map(item => item.fingerprint)).size, removeInAfter: media.filter(item => item.action === 'REMOVE_HITA_SHOWROOM' && item.placement !== 'REMOVED_FROM_AFTER').length, blocked: records.filter(record => record.blockedReasons.length).length }, quality: { beforeAfterRatio: { min: Math.min(...ratios), max: Math.max(...ratios), average: ratios.reduce((sum, value) => sum + value, 0) / ratios.length }, repeatedOpeningCount: Object.values(openings).filter(value => value > 1).length, repeatedClosingCount: Object.values(closings).filter(value => value > 1).length, repeatedSectionSignatureCount: Object.values(sections).filter(value => value > 1).length, retainedEvidenceRate: records.reduce((sum, record) => sum + record.preservedEvidence.retainedSentenceCount / Math.max(1, record.preservedEvidence.sourceSentenceCount), 0) / records.length, semanticPassCount: records.filter(record => record.semanticFlags.length === 0).length, semanticReviewCount: records.filter(record => record.semanticFlags.length > 0).length, semanticFlags, removedUnsupportedClaimCount: records.reduce((sum, record) => sum + record.removedUnsupportedClaimCount, 0), blockedReasons } }
    return { ...withoutHash, packageHash: hashObject(withoutHash) }
}

export function assertPhaseDCheckpointBinding(value: PhaseDCheckpointPackage, policyHash: string, snapshotHash: string, sourceCommit: string): void {
    if (value.policyHash !== policyHash || value.snapshotHash !== snapshotHash || value.sourceCommit !== sourceCommit || value.sourceCommitRole !== 'GENERATOR_INPUT_HEAD') throw new Error('Phase D checkpoint policy/snapshot/source-commit binding is stale or ambiguous')
    const expectedProposal = hashObject({ schemaVersion: value.schemaVersion, source: value.source, policyHash: value.policyHash, snapshotHash: value.snapshotHash, cohortHash: value.cohortHash, checkpointHash: value.checkpointHash, sourceHash: value.sourceHash, sourceCommit: value.sourceCommit, sourceCommitRole: value.sourceCommitRole, officialStatusEvidence: value.officialStatusEvidence, acceptedRegression: value.acceptedRegression, records: value.records, manualHoldout: value.manualHoldout })
    if (value.proposalHash !== expectedProposal || value.manualHoldoutHash !== hashObject(value.manualHoldout)) throw new Error('Phase D checkpoint proposal/holdout binding is stale')
    const { packageHash, ...withoutHash } = value
    if (packageHash !== hashObject(withoutHash)) throw new Error('Phase D checkpoint package binding is stale')
    if (value.records.length !== 30 || value.manualHoldout.length !== 24) throw new Error(`Phase D checkpoint must contain exactly 30 products and 24 holdout labels; products=${value.records.length}; holdout=${value.manualHoldout.length}`)
    const editorialStatuses = count(value.records.map(record => record.editorialStatus))
    if (editorialStatuses.FIRST_PASS_PASS !== 27 || editorialStatuses.HUMAN_REVIEW !== 3) throw new Error(`Phase D editorial checkpoint must contain 27 FIRST_PASS_PASS and 3 HUMAN_REVIEW rows; got ${JSON.stringify(editorialStatuses)}`)
    if (![4260, 26440, 26442].every(id => value.records.find(record => record.product.id === id)?.blockedReasons.includes('INSUFFICIENT_SOURCE_EVIDENCE_REQUIRES_HUMAN_REVIEW'))) throw new Error('Phase D locked insufficient-evidence rows are not explicit')
    if (value.records.some(record => record.media.some(item => item.action === 'REMOVE_HITA_SHOWROOM' && item.placement !== 'REMOVED_FROM_AFTER'))) throw new Error('Hita showroom removal leaked into After')
    if (value.records.some(record => record.media.some(item => item.action === 'REMOVE_HITA_SHOWROOM' && record.generatedHtml.includes(item.url)))) throw new Error('Hita showroom asset URL leaked into After')
    if (value.records.some(record => record.generatedHtml.includes('…') || /\.\.\./u.test(record.generatedHtml))) throw new Error('Phase D After contains mechanical truncation markers')
    if (value.quality.repeatedOpeningCount || value.quality.repeatedClosingCount || value.quality.repeatedSectionSignatureCount) throw new Error('Phase D narrative diversity is concentrated after product/brand/SKU normalization')
    if (value.records.some(record => record.semanticFlags.length)) throw new Error('Phase D semantic editorial gate failed')
    if (value.records.some(record => UNSUPPORTED_COMMERCIAL_CLAIMS.test(visibleText(record.generatedHtml)))) throw new Error('Phase D After contains unsupported commercial or Hita claim')
    const byFingerprint = new Map<string, PhaseDMediaProposal>()
    for (const record of value.records) for (const item of record.media) {
        const prior = byFingerprint.get(item.fingerprint)
        if (prior && (prior.action !== item.action || prior.visualRole !== item.visualRole || prior.visualReview !== item.visualReview)) throw new Error('Duplicate media fingerprint decisions diverge')
        byFingerprint.set(item.fingerprint, item)
    }
    if (value.records.some(record => {
        const $ = cheerio.load(record.generatedHtml, {}, false)
        const visible = $.root().text()
        const hitaImage = $('img').toArray().some(node => /hita\.com\.vn/i.test($(node).attr('src') || ''))
        return /REPLACE_WITH_OFFICIAL|hita\.com\.vn|https?:\/\/www\.hita/i.test(visible) || hitaImage
    })) throw new Error('Phase D After contains forbidden replacement or Hita reference')
}

export function buildPhaseDDashboardModel(value: PhaseDCheckpointPackage, visibility: 'public' | 'private') {
    const redact = (html: string) => {
        if (visibility === 'private') return html
        const $ = cheerio.load(cleanupProductHtml(html), {}, false)
        $('img').each((_, node) => { $(node).replaceWith(`<span class="media-placeholder">Media preview redacted · fingerprint-only</span>`) })
        return $.html()
    }
    return { schemaVersion: value.schemaVersion, dashboard: 'leo-493-phase-d-checkpoint', packageHash: value.packageHash, proposalHash: value.proposalHash, policyHash: value.policyHash, snapshotHash: value.snapshotHash, cohortHash: value.cohortHash, checkpointHash: value.checkpointHash, sourceHash: value.sourceHash, sourceCommit: value.sourceCommit, sourceCommitRole: value.sourceCommitRole, bindingStatus: 'VALID' as const, privateMedia: visibility === 'private', products: value.records.map(record => ({ ...record.product, editorialStatus: record.editorialStatus, editorial: record.editorial, semanticFlags: record.semanticFlags, editorialReviewReason: record.editorial.editorialReviewReason, narrativeFamily: record.narrativeFamily, structure: record.structure, holdout: record.holdout, holdoutStatus: record.holdoutStatus, blockedReasons: record.blockedReasons, beforeHtml: redact(record.input.descriptionHtml), afterHtml: redact(record.generatedHtml), previewHtml: redact(record.generatedHtml), diff: diff(record.input.descriptionHtml, record.generatedHtml), preservedEvidence: record.preservedEvidence, media: record.media.map(item => ({ ...item, url: visibility === 'private' ? item.url : undefined, urlRedacted: `[redacted URL sha256=${item.fingerprint}]` })) })) }
}
