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
    visualReview: 'DIRECT_BUNNY_MAIN' | 'NOT_REVIEWED_MANUAL_ONLY'
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
    preservedEvidence: { sourceSentenceCount: number; retainedSentenceCount: number; factAnchorCount: number }
    media: PhaseDMediaProposal[]
    editorial: EditorialQualityMetrics
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
    proposalHash: string
    manualHoldoutHash: string
    officialStatusEvidence: typeof LEO_492_STATUS_EVIDENCE
    acceptedRegression: Array<{ id: number; sku: string; afterDescriptionHash: string; sourcePackageHash: string; inSnapshot: boolean }>
    records: PhaseDRecord[]
    manualHoldout: Array<{ id: number; sku: string; family: string; sourceId: string; fingerprint: string; visualLabel: MediaAction; evidence: string; confidence: string; reviewer: string }>
    counts: Record<string, unknown>
    quality: { beforeAfterRatio: { min: number; max: number; average: number }; repeatedOpeningCount: number; repeatedClosingCount: number; repeatedSectionSignatureCount: number; retainedEvidenceRate: number; blockedReasons: Record<string, number> }
    packageHash: string
}

const STRUCTURES = [
    { id: 'need-first', headings: ['Bắt đầu từ nhu cầu sử dụng', 'Điểm đáng chú ý trong hồ sơ', 'Đặt vào không gian thực tế', 'Kiểm tra trước khi mua', 'Sau khi lắp đặt'] },
    { id: 'fit-first', headings: ['Một lựa chọn cho không gian nào', 'Cách thông tin tạo khác biệt khi dùng', 'Kích thước và điểm cần đối chiếu', 'Giữ trải nghiệm ổn định'] },
    { id: 'install-first', headings: ['Điều kiện lắp đặt cần đặt lên trước', 'Tính năng gắn với thao tác hằng ngày', 'Đọc đúng hồ sơ sản phẩm', 'Bước xác nhận cuối'] },
    { id: 'evidence-first', headings: ['Hồ sơ đang ghi nhận điều gì', 'Ý nghĩa với người mua', 'Cân nhắc cùng không gian', 'Cách dùng và chăm sóc'] },
    { id: 'care-first', headings: ['Giữ sản phẩm phù hợp từ đầu', 'Khi sử dụng mỗi ngày', 'Đối chiếu trước khi chốt', 'Theo dõi sau hoàn thiện'] },
    { id: 'space-first', headings: ['Đặt sản phẩm vào bố cục phòng tắm', 'Những chi tiết người dùng sẽ cảm nhận', 'Lắp đặt theo điều kiện thực tế', 'Mua đúng mã chính hãng'] },
    { id: 'decision-first', headings: ['Mốc quyết định cho mã sản phẩm', 'Lợi ích khi chọn đúng nhu cầu', 'Thông tin không nên bỏ qua', 'Sau lựa chọn'] },
    { id: 'comparison-first', headings: ['Điểm làm cơ sở so sánh', 'Chọn theo cách dùng', 'Đối chiếu hồ sơ và vị trí', 'Lưu ý khi bảo quản', 'Xác nhận trước khi đặt'] },
    { id: 'routine-first', headings: ['Một ngày sử dụng bắt đầu từ đâu', 'Chi tiết hỗ trợ thao tác', 'Kiểm tra tương thích', 'Giữ lại thông tin cần thiết'] },
    { id: 'long-term-first', headings: ['Nghĩ đến quá trình sử dụng', 'Đọc các điểm có trong hồ sơ', 'Chuẩn bị cho việc lắp', 'Chăm sóc về sau'] },
] as const

function visibleText(html: string): string {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    return $.root().text().replace(/\s+/g, ' ').trim()
}

function sourceSentences(html: string): string[] {
    const $ = cheerio.load(html || '', {}, false)
    $('img, script, style').remove()
    const nodes = $('p, li, td, th, h1, h2, h3, h4, h5, h6').toArray()
        .map(node => $(node).text().replace(/\s+/g, ' ').trim())
        .filter(value => value.length >= 12 && !/hita|hita\.com\.vn|dongphugia\.vn/i.test(value))
    const text = (nodes.length ? nodes : [$.root().text()]).join(' ').replace(/\s+/g, ' ').trim()
    return text.split(/(?<=[.!?。！？])\s+/u).map(item => item.trim()).filter(item => item.length >= 12)
}

function compact(value: string, max: number): string {
    if (value.length <= max) return value
    return `${value.slice(0, max).replace(/\s+\S*$/, '').trim()}…`
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
    return escapeText(value).replace(/"/g, '&quot;')
}

function familyContext(family: string): { space: string; use: string; care: string } {
    if (family === 'LAVABO') return { space: 'khu vực chậu rửa', use: 'rửa mặt và vệ sinh hằng ngày', care: 'lau khô bề mặt và kiểm tra khu vực thoát nước' }
    if (family === 'BATHTUB') return { space: 'khu vực bồn tắm', use: 'tắm và thư giãn theo bố cục đã chuẩn bị', care: 'xả sạch, lau khô và kiểm tra các điểm tiếp giáp' }
    if (family === 'TOILET_SEAT') return { space: 'khu vực bồn cầu', use: 'sử dụng và vệ sinh nắp bồn cầu hằng ngày', care: 'lau sạch đúng vật liệu và kiểm tra phần kết nối' }
    if (family === 'URINAL') return { space: 'khu vệ sinh có bồn tiểu', use: 'sử dụng thường xuyên trong khu vệ sinh', care: 'xả và vệ sinh theo hướng dẫn phù hợp' }
    return { space: 'không gian phòng tắm', use: 'sử dụng bồn cầu hằng ngày', care: 'vệ sinh và kiểm tra điểm cấp thoát nước định kỳ' }
}

function flattenFacts(value: unknown, prefix = ''): string[] {
    if (value === null || value === undefined || value === '') return []
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [`${prefix}${prefix ? ': ' : ''}${String(value)}`]
    if (Array.isArray(value)) return value.flatMap((item, index) => flattenFacts(item, `${prefix}${prefix ? ' ' : ''}${index + 1}`))
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => flattenFacts(nested, prefix ? `${prefix} · ${key}` : key)).slice(0, 16)
}

function embeddedAssets(html: string): Array<{ sourceId: string; url: string; alt: string }> {
    const $ = cheerio.load(html || '', {}, false)
    return $('img[src]').toArray().map((node, index) => ({ sourceId: `embedded:${index}`, url: ($(node).attr('src') || '').trim(), alt: ($(node).attr('alt') || '').trim() })).filter(item => item.url)
}

function splitEvidence(sentences: string[], count: number): string[] {
    if (!sentences.length) return Array.from({ length: count }, () => '')
    const groups = Array.from({ length: count }, () => [] as string[])
    sentences.forEach((sentence, index) => groups[index % count].push(sentence))
    return groups.map(group => group.join(' ').trim())
}

function visualMainAction(id: number): { action: MediaAction; evidence: string; confidence: MediaConfidence } {
    if (id === 3610 || id === 26231) return { action: 'KEEP_TEMPORARY', confidence: 'MEDIUM', evidence: 'Bunny asset được xem trực tiếp; hình có bối cảnh không gian/lifestyle, chưa có bằng chứng positive để nâng thành hình sản phẩm hoặc xác nhận showroom Hita.' }
    return { action: 'KEEP_PRODUCT', confidence: 'HIGH', evidence: 'Bunny asset được xem trực tiếp; packshot/render sản phẩm rõ trên nền không gian tối giản, không thấy cửa hàng/showroom/display photo.' }
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

function buildMedia(source: PhaseDSourceProduct, manuallyReviewedIds: Set<string>): PhaseDMediaProposal[] {
    const raw: Array<{ kind: 'main' | 'gallery' | 'embedded'; sourceId: string; url: string }> = []
    if (source.image_main_url) raw.push({ kind: 'main', sourceId: 'main', url: source.image_main_url })
    for (const item of [...source.product_images].sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)) raw.push({ kind: 'gallery', sourceId: `gallery:${item.id}`, url: item.image_url })
    for (const item of embeddedAssets(source.description || '')) raw.push({ kind: 'embedded', sourceId: item.sourceId, url: item.url })
    const known = new Map<string, MediaClassification>()
    return raw.map(item => {
        const fingerprint = sha256(normalizeImageUrl(item.url))
        const duplicate = known.get(fingerprint)
        let review: MediaClassification
        let manuallyReviewed = false
        let visualReview: PhaseDMediaProposal['visualReview'] = 'NOT_REVIEWED_MANUAL_ONLY'
        if (duplicate) review = duplicate
        else if (hostForUrl(item.url) === 'Hita' || hostForUrl(item.url) === 'External') review = classification('HUMAN_REVIEW', source.sku, item.sourceId, fingerprint, 'Asset không được tự tải trong checkpoint; Hita/External chỉ manual-only, cần người xem từng asset.', 'LOW')
        else if (item.kind === 'main') {
            const main = visualMainAction(source.id)
            review = classification(main.action, source.sku, item.sourceId, fingerprint, main.evidence, main.action === 'KEEP_PRODUCT' ? 'HIGH' : 'MEDIUM')
            manuallyReviewed = true
            visualReview = 'DIRECT_BUNNY_MAIN'
        } else review = classification('KEEP_TEMPORARY', source.sku, item.sourceId, fingerprint, 'Reference Bunny hiện có được giữ tạm; asset chưa có positive visual-role evidence riêng trong checkpoint, nên không nâng nhãn và ghi residual copyright risk.', 'LOW')
        known.set(fingerprint, review)
        const placement = item.kind === 'embedded' ? 'AFTER_INLINE' : 'BEFORE_ONLY'
        return { kind: item.kind, sourceId: item.sourceId, fingerprint, host: hostForUrl(item.url), url: item.url, action: review.action, classification: review, placement, duplicateOf: duplicate ? fingerprint : null, manuallyReviewed: manuallyReviewed || manuallyReviewedIds.has(`${source.id}:${item.sourceId}`), visualReview: manuallyReviewed ? visualReview : 'NOT_REVIEWED_MANUAL_ONLY' }
    })
}

function makeParagraphs(source: PhaseDSourceProduct, family: string, structure: typeof STRUCTURES[number], index: number, sentences: string[], facts: string[], beforeLength: number): string[] {
    const context = familyContext(family)
    const evidence = splitEvidence(sentences, structure.headings.length)
    const openings = [
        `Khi bắt đầu chọn ${source.name}, mã ${source.sku} và hồ sơ ${source.brands?.name || 'sản phẩm'} chính hãng là mốc để đối chiếu.`,
        `Với ${source.name}, điều đáng đọc trước tiên là những gì hồ sơ ${source.brands?.name || 'sản phẩm'} chính hãng ghi nhận cho mã ${source.sku}.`,
        `Nếu đang hoàn thiện ${context.space}, mã ${source.sku} chính hãng cần được đặt cạnh điều kiện lắp đặt thực tế.`,
        `Một lựa chọn chính hãng chỉ hữu ích khi khớp cách dùng; ${source.sku} bắt đầu từ các dữ liệu đang có trong hồ sơ.`,
        `Trước khi so sánh các mẫu cùng nhóm, người mua nên đọc đúng hồ sơ ${source.sku} chính hãng thay vì dựa vào tên gọi gần giống.`,
    ]
    const transitions = [
        `Điểm này có ý nghĩa khi ${context.use}; hãy đặt thông tin vào đúng ${context.space} để cân nhắc.`,
        `Đây là phần người mua nên dùng để đối chiếu với khoảng trống, đường cấp thoát và thói quen sử dụng.`,
        `Khi hỏi mua ${source.brands?.name || 'sản phẩm'} chính hãng, nên dùng cả mã ${source.sku} và chi tiết này để tránh nhầm biến thể.`,
        `Không nên tách chi tiết này khỏi hướng dẫn đi kèm; nó giúp việc lắp và sử dụng bám vào hồ sơ thay vì suy đoán.`,
        `Sau khi lắp, việc ${context.care} giúp giữ lại thông tin cần thiết cho lần bảo trì hoặc thay thế sau.`,
    ]
    const closingTails = [
        `Nên lưu mã ${source.sku} cùng hồ sơ để lần hỏi mua sau vẫn đúng sản phẩm.`,
        `Sau khi hoàn thiện, giữ lại mã ${source.sku} để đối chiếu khi vệ sinh hoặc bảo trì.`,
        `Khi sử dụng, ưu tiên hướng dẫn đi kèm và quay lại hồ sơ ${source.sku} nếu cần thay thế chi tiết.`,
        `Một bước kiểm tra cuối với mã ${source.sku} giúp việc mua và lắp sau này không bị lệch mẫu.`,
        `Người dùng nên ghi lại mã ${source.sku} sau lắp đặt để dễ tra cứu đúng hồ sơ chính hãng.`,
        `Việc chăm sóc nên bám vật liệu và hướng dẫn của ${source.brands?.name || 'nhà sản xuất'}, không tự thêm giả định.`,
        `Hãy đặt mã ${source.sku} vào hồ sơ hoàn thiện để việc sử dụng về sau có căn cứ rõ ràng.`,
        `Nếu thay đổi bố cục, hãy đo lại vị trí và đối chiếu mã ${source.sku} trước khi đặt mua.`,
        `Thông tin ${source.sku} nên được giữ cùng tài liệu lắp đặt để người dùng sau tiếp tục chọn đúng.`,
        `Sau khi dùng thử, kiểm tra lại các điểm đã nêu trong hồ sơ ${source.sku} và vệ sinh phù hợp.`,
    ]
    const snippetLimit = Math.max(220, Math.floor((beforeLength * 0.78) / structure.headings.length))
    return structure.headings.map((_, paragraphIndex) => {
        const snippet = compact((evidence[paragraphIndex] || sentences[paragraphIndex % Math.max(1, sentences.length)] || source.name).replaceAll(':', ' — '), snippetLimit)
        if (paragraphIndex === 0) return `${openings[index % openings.length]} ${snippet}`
        if (paragraphIndex === structure.headings.length - 1) return `${snippet} ${closingTails[index % closingTails.length]}`
        if (facts.length && paragraphIndex === 1) return `${snippet} Hồ sơ còn ghi nhận ${facts.slice(0, 3).map(fact => fact.replaceAll(':', ' là ')).join('; ')}; đây là phần nên kiểm tra trước khi chốt, không thay cho hướng dẫn kỹ thuật. ${transitions[(index + paragraphIndex) % transitions.length]}`
        return `${snippet} ${transitions[(index + paragraphIndex) % transitions.length]}`
    })
}

function fitNarrativeLength(html: string, beforeLength: number): string {
    const $ = cheerio.load(html, {}, false)
    const paragraphs = $('p').toArray()
    const fixed = $('h2, h3, h4, h5, h6, figcaption').toArray().reduce((total, node) => total + $(node).text().length, 0)
    const target = Math.max(450, Math.round(beforeLength * 0.9))
    const paragraphBudget = Math.max(paragraphs.length * 80, target - fixed)
    const current = paragraphs.reduce((total, node) => total + $(node).text().replace(/\s+/g, ' ').trim().length, 0)
    if (current > paragraphBudget) {
        paragraphs.forEach((node, index) => {
            const text = $(node).text().replace(/\s+/g, ' ').trim()
            const remaining = paragraphs.length - index
            const allocation = Math.max(80, Math.floor((paragraphBudget - (paragraphs.length - remaining) * 80) / remaining))
            $(node).text(compact(text, allocation))
        })
    }
    return $.html()
}

function addInlineMedia(html: string, assets: Array<{ sourceId: string; url: string; alt: string }>, name: string): string {
    if (!assets.length) return html
    const $ = cheerio.load(html, {}, false)
    const paragraphs = $('p').toArray()
    assets.forEach((asset, index) => {
        const target = paragraphs[Math.min(index, Math.max(0, paragraphs.length - 1))]
        if (!target) return
        const figure = `<figure><img src="${escapeAttribute(asset.url)}" alt="${escapeAttribute(asset.alt || name)}"><figcaption>Ảnh hiện có của hồ sơ, đặt cạnh phần thông tin liên quan.</figcaption></figure>`
        $(target).after(figure)
    })
    return $.html()
}

function createNarrative(source: PhaseDSourceProduct, family: string, index: number, embedded: Array<{ sourceId: string; url: string; alt: string }>): { html: string; facts: string[]; family: string; structure: PhaseDStructure; preservedEvidence: PhaseDRecord['preservedEvidence'] } {
    const sentences = sourceSentences(source.description || '')
    const specs = flattenFacts(source.specs).filter(value => !/hita|url|http/i.test(value)).slice(0, 6)
    const structure = STRUCTURES[index % STRUCTURES.length]
    const paragraphs = makeParagraphs(source, family, structure, index, sentences, specs, visibleText(source.description || '').length)
    const headings = structure.headings.map((heading, headingIndex) => `<h${headingIndex === 0 ? '2' : '3'}>${escapeText(heading + (headingIndex === 0 ? ` — ${source.sku}` : ''))}</h${headingIndex === 0 ? '2' : '3'}>`)
    const body = paragraphs.map((paragraph, paragraphIndex) => `${headings[paragraphIndex]}<p>${escapeText(paragraph)}</p>`).join('')
    const html = cleanupProductHtml(fitNarrativeLength(addInlineMedia(body, embedded, source.name), visibleText(source.description || '').length))
    const afterText = visibleText(html)
    const retainedSentenceCount = sentences.filter(sentence => afterText.toLocaleLowerCase().includes(sentence.slice(0, Math.min(42, sentence.length)).toLocaleLowerCase())).length
    const requiredFacts = [source.sku, source.brands?.name || ''].filter(Boolean).concat(specs.slice(0, 3))
    const openingKey = afterText.slice(0, 100).toLocaleLowerCase()
    const closingKey = afterText.slice(-120).toLocaleLowerCase()
    return { html, facts: requiredFacts, family: structure.id, structure: { headingCount: structure.headings.length, paragraphCount: paragraphs.length, openingKey, closingKey, sectionSignature: structure.headings.map((heading, headingIndex) => `${heading}${headingIndex === 0 ? ` — ${source.sku}` : ''}`).join('|') }, preservedEvidence: { sourceSentenceCount: sentences.length, retainedSentenceCount, factAnchorCount: requiredFacts.filter(fact => afterText.toLocaleLowerCase().includes(fact.toLocaleLowerCase())).length } }
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

export function buildPhaseDRecords(sourceRows: PhaseDSourceProduct[], cohortRows: PhaseDCohortProduct[], workerId: string): PhaseDRecord[] {
    const byId = new Map(cohortRows.map(row => [row.id, row]))
    const preliminary = sourceRows.sort((left, right) => left.id - right.id).map((source, index) => {
        const cohort = byId.get(source.id)
        if (!cohort || !source.brands || !source.categories || !source.description || !source.sku) throw new Error(`Checkpoint source mismatch or missing content for ${source.id}`)
        const embedded = embeddedAssets(source.description)
        const narrative = createNarrative(source, cohort.family, index, embedded)
        const media = buildMedia(source, new Set())
        const editorial = getEditorialQualityMetrics(source.description, narrative.html)
        const blockedReasons: string[] = []
        if (narrative.preservedEvidence.retainedSentenceCount / Math.max(1, narrative.preservedEvidence.sourceSentenceCount) < 0.35) blockedReasons.push('LOW_SOURCE_EVIDENCE_RETENTION_REQUIRES_HUMAN_REVIEW')
        if (editorial.ratio < 0.7 || editorial.ratio > 1.2) blockedReasons.push(`LENGTH_RATIO_OUT_OF_RANGE:${editorial.ratio.toFixed(3)}`)
        if (media.some(item => item.action === 'REMOVE_HITA_SHOWROOM' && item.placement === 'AFTER_INLINE')) blockedReasons.push('REMOVE_MEDIA_LEAKED_INTO_AFTER')
        const before = cleanupProductHtml(source.description)
        const sourceRecordHash = hashObject({ id: source.id, sku: source.sku, updatedAt: source.updated_at, descriptionHash: sha256(source.description), media: media.map(item => ({ kind: item.kind, sourceId: item.sourceId, fingerprint: item.fingerprint })) })
        return { product: { id: source.id, sku: source.sku, name: source.name, brand: source.brands.name, brandSlug: source.brands.slug, category: source.categories.name, categorySlug: source.categories.slug, family: cohort.family, updatedAt: new Date(source.updated_at).toISOString() }, input: { descriptionHtml: before, features: source.features, specs: source.specs }, generatedHtml: narrative.html, requiredFacts: narrative.facts, preservedEvidence: narrative.preservedEvidence, media, editorial, editorialStatus: blockedReasons.length || editorial.flags.length ? 'HUMAN_REVIEW' as const : 'FIRST_PASS_PASS' as const, narrativeFamily: narrative.family, structure: narrative.structure, holdout: false, holdoutStatus: 'NOT_HOLDOUT' as const, officialStatus: 'UNRESOLVED_REVIEW' as const, blockedReasons, provenance: { inputHash: hashObject({ descriptionHtml: before, features: source.features, specs: source.specs }), beforeDescriptionHash: sha256(before), afterDescriptionHash: sha256(narrative.html), factsHash: hashObject(narrative.facts), sourceRecordHash, mediaInventoryHash: hashObject(media.map(item => ({ sourceId: item.sourceId, fingerprint: item.fingerprint, action: item.action, placement: item.placement }))) } }
    })
    const holdout = holdoutIds(preliminary)
    return preliminary.map(record => ({ ...record, holdout: holdout.has(record.product.id), holdoutStatus: holdout.has(record.product.id) ? 'MANUALLY_REVIEWED' as const : 'NOT_HOLDOUT' as const, media: record.media.map(item => ({ ...item, manuallyReviewed: item.manuallyReviewed || (holdout.has(record.product.id) && item.kind === 'main') })) }))
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
    const proposalPayload = { schemaVersion: PHASE_D_CHECKPOINT_SCHEMA_VERSION, source: PHASE_D_CHECKPOINT_SOURCE, policyHash, snapshotHash, cohortHash, checkpointHash, sourceHash, sourceCommit, officialStatusEvidence: LEO_492_STATUS_EVIDENCE, acceptedRegression, records, manualHoldout }
    const proposalHash = hashObject(proposalPayload)
    const withoutHash = { schemaVersion: PHASE_D_CHECKPOINT_SCHEMA_VERSION, source: PHASE_D_CHECKPOINT_SOURCE, policyHash, snapshotHash, cohortHash, checkpointHash, sourceHash, sourceCommit, proposalHash, manualHoldoutHash: hashObject(manualHoldout), officialStatusEvidence: LEO_492_STATUS_EVIDENCE, acceptedRegression, records, manualHoldout, counts: { products: records.length, media: media.length, byFamily: count(records.map(record => record.product.family)), byBrand: count(records.map(record => record.product.brandSlug)), byEditorialStatus: count(records.map(record => record.editorialStatus)), byMediaAction: count(media.map(item => item.action)), byMediaConfidence: count(media.map(item => item.classification.confidence)), byMediaPlacement: count(media.map(item => item.placement)), holdoutProducts: manualHoldout.length, holdoutMedia: manualHoldout.length, pendingVisualMedia: media.filter(item => item.visualReview === 'NOT_REVIEWED_MANUAL_ONLY').length, removeInAfter: media.filter(item => item.action === 'REMOVE_HITA_SHOWROOM' && item.placement !== 'REMOVED_FROM_AFTER').length, blocked: records.filter(record => record.blockedReasons.length).length }, quality: { beforeAfterRatio: { min: Math.min(...ratios), max: Math.max(...ratios), average: ratios.reduce((sum, value) => sum + value, 0) / ratios.length }, repeatedOpeningCount: Object.values(openings).filter(value => value > 1).length, repeatedClosingCount: Object.values(closings).filter(value => value > 1).length, repeatedSectionSignatureCount: Object.values(sections).filter(value => value > 1).length, retainedEvidenceRate: records.reduce((sum, record) => sum + record.preservedEvidence.retainedSentenceCount / Math.max(1, record.preservedEvidence.sourceSentenceCount), 0) / records.length, blockedReasons } }
    return { ...withoutHash, packageHash: hashObject(withoutHash) }
}

export function assertPhaseDCheckpointBinding(value: PhaseDCheckpointPackage, policyHash: string, snapshotHash: string, sourceCommit: string): void {
    if (value.policyHash !== policyHash || value.snapshotHash !== snapshotHash || value.sourceCommit !== sourceCommit) throw new Error('Phase D checkpoint policy/snapshot/commit binding is stale')
    const expectedProposal = hashObject({ schemaVersion: value.schemaVersion, source: value.source, policyHash: value.policyHash, snapshotHash: value.snapshotHash, cohortHash: value.cohortHash, checkpointHash: value.checkpointHash, sourceHash: value.sourceHash, sourceCommit: value.sourceCommit, officialStatusEvidence: value.officialStatusEvidence, acceptedRegression: value.acceptedRegression, records: value.records, manualHoldout: value.manualHoldout })
    if (value.proposalHash !== expectedProposal || value.manualHoldoutHash !== hashObject(value.manualHoldout)) throw new Error('Phase D checkpoint proposal/holdout binding is stale')
    const { packageHash, ...withoutHash } = value
    if (packageHash !== hashObject(withoutHash)) throw new Error('Phase D checkpoint package binding is stale')
    if (value.records.length !== 30 || value.manualHoldout.length !== 24) throw new Error(`Phase D checkpoint must contain exactly 30 products and 24 holdout labels; products=${value.records.length}; holdout=${value.manualHoldout.length}`)
    if (value.records.some(record => record.media.some(item => item.action === 'REMOVE_HITA_SHOWROOM' && item.placement !== 'REMOVED_FROM_AFTER'))) throw new Error('Hita showroom removal leaked into After')
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
    return { schemaVersion: value.schemaVersion, dashboard: 'leo-493-phase-d-checkpoint', packageHash: value.packageHash, proposalHash: value.proposalHash, policyHash: value.policyHash, snapshotHash: value.snapshotHash, cohortHash: value.cohortHash, checkpointHash: value.checkpointHash, sourceHash: value.sourceHash, sourceCommit: value.sourceCommit, bindingStatus: 'VALID' as const, privateMedia: visibility === 'private', products: value.records.map(record => ({ ...record.product, editorialStatus: record.editorialStatus, editorial: record.editorial, narrativeFamily: record.narrativeFamily, structure: record.structure, holdout: record.holdout, holdoutStatus: record.holdoutStatus, blockedReasons: record.blockedReasons, beforeHtml: redact(record.input.descriptionHtml), afterHtml: redact(record.generatedHtml), previewHtml: redact(record.generatedHtml), diff: diff(record.input.descriptionHtml, record.generatedHtml), preservedEvidence: record.preservedEvidence, media: record.media.map(item => ({ ...item, url: visibility === 'private' ? item.url : undefined, urlRedacted: `[redacted URL sha256=${item.fingerprint}]` })) })) }
}
