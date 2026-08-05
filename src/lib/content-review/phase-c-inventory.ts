import { hashObject } from './hash'

export const PHASE_C_GATES = ['KEEP_EXISTING_CONTENT', 'REWRITE_IMPORTANT', 'CONTENT_REVIEW_CANDIDATE'] as const
export type PhaseCGate = typeof PHASE_C_GATES[number]

export const IMPORTANT_FAMILIES = ['TOILET', 'TOILET_SEAT', 'BATHTUB', 'URINAL', 'LAVABO'] as const
export type ImportantFamily = typeof IMPORTANT_FAMILIES[number]

export const LENGTH_BUCKETS = ['0', '1_199', '200_299', '300_499', '500_999', '1000_PLUS'] as const
export type LengthBucket = typeof LENGTH_BUCKETS[number]

export const MEDIA_RISKS = ['BUNNY_ONLY', 'HITA_HOSTED', 'EXTERNAL_ONLY', 'MIXED', 'NO_MEDIA'] as const
export type MediaRisk = typeof MEDIA_RISKS[number]

export type PhaseCInventoryMedia = {
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    fingerprint: string
    host: 'Bunny CDN' | 'Hita' | 'External'
}

export type PhaseCInventoryProduct = {
    id: number
    sku: string | null
    name: string | null
    brand: { id: number; name: string; slug: string } | null
    category: { id: number; name: string; slug: string } | null
    updatedAt: string
    descriptionHash: string
    visibleLength: number
    media: PhaseCInventoryMedia[]
}

export type PhaseCClassification = {
    gate: PhaseCGate
    family: ImportantFamily | 'AMBIGUOUS' | 'OUTSIDE_APPROVED_FAMILY'
    reasonCodes: string[]
    lengthBucket: LengthBucket
    embeddedCount: number
    mediaCount: number
    mediaRisk: MediaRisk
    identityHash: string
    blocker: 'MISSING_RAW_SKU' | 'DUPLICATE_RAW_SKU' | null
}

export type PhaseCInventoryBinding = {
    policyHash: string
    snapshotHash: string
    proposalHash: null
    sourceCommit: string
    bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL'
}

const ACCESSORY_RULES: Array<{ code: string; pattern: RegExp }> = [
    { code: 'ACCESSORY_OR_COMPONENT_TERM', pattern: /\b(phu kien|accessory|spare|replacement|thay the|linh kien)\b/i },
    { code: 'MOUNTING_OR_INSTALLATION_COMPONENT', pattern: /\b(mounting|installation kit|lap dat|de lap|chan|de)\b/i },
    { code: 'PLUMBING_COMPONENT', pattern: /\b(connector|connectors|dau noi|co noi|ong|drain|waste|thoat|xa|van|valve|voi|hose|day cap|tay gat|tay nhan|nut nhan|bo xa)\b/i },
    { code: 'HARDWARE_OR_REPLACEMENT_PART', pattern: /\b(handle|screw|oc|gioang|seal|bracket|gia do|kep|repair|repair kit|replacement part|linh phu kien)\b/i },
    { code: 'LOW_VALUE_SURFACE_OR_SUPPORT_PART', pattern: /\b(mat ban|chan lavabo|ke lavabo|be mat|support base|mounting base)\b/i },
]

const FAMILY_RULES: Array<{ family: ImportantFamily; patterns: RegExp[] }> = [
    { family: 'TOILET', patterns: [/\b(bon cau|toilet|bet|cau ve sinh|one piece|two piece|wall hung|treo tuong|back to wall)\b/i] },
    { family: 'TOILET_SEAT', patterns: [/\b(nap bon cau|toilet seat|seat cover|seat)\b/i] },
    { family: 'BATHTUB', patterns: [/\b(bon tam|bathtub|bon massage|jacuzzi)\b/i] },
    { family: 'URINAL', patterns: [/\b(bon tieu|tieu nam|urinal)\b/i] },
    { family: 'LAVABO', patterns: [/\b(lavabo|chau rua mat|wash basin|washbasin|basin)\b/i] },
]

function fold(value: string | null | undefined): string {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim()
}

function identityText(product: PhaseCInventoryProduct): string {
    return fold([product.name, product.sku, product.brand?.name, product.category?.name, product.category?.slug].filter(Boolean).join(' '))
}

export function descriptionLengthBucket(length: number): LengthBucket {
    if (length <= 0) return '0'
    if (length < 200) return '1_199'
    if (length < 300) return '200_299'
    if (length < 500) return '300_499'
    if (length < 1000) return '500_999'
    return '1000_PLUS'
}

export function mediaRisk(media: PhaseCInventoryMedia[]): MediaRisk {
    if (media.length === 0) return 'NO_MEDIA'
    const hosts = new Set(media.map((item) => item.host))
    if (hosts.size > 1) return 'MIXED'
    if (hosts.has('Bunny CDN')) return 'BUNNY_ONLY'
    if (hosts.has('Hita')) return 'HITA_HOSTED'
    return 'EXTERNAL_ONLY'
}

function matchFamily(text: string): ImportantFamily[] {
    const seatRule = FAMILY_RULES.find((rule) => rule.family === 'TOILET_SEAT')
    if (seatRule?.patterns.some((pattern) => pattern.test(text))) return ['TOILET_SEAT']
    return FAMILY_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map((rule) => rule.family)
}

function exclusionReasons(text: string): string[] {
    return ACCESSORY_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.code)
}

export function classifyPhaseCProduct(product: PhaseCInventoryProduct, duplicateSkus = new Set<string>()): PhaseCClassification {
    const text = identityText(product)
    const exclusionCodes = exclusionReasons(text)
    const families = matchFamily(text)
    const uniqueFamilies = [...new Set(families)]
    const embeddedCount = product.media.filter((item) => item.kind === 'embedded').length
    const lengthBucket = descriptionLengthBucket(product.visibleLength)
    const blocker: PhaseCClassification['blocker'] = !product.sku?.trim() ? 'MISSING_RAW_SKU' : duplicateSkus.has(product.sku.trim()) ? 'DUPLICATE_RAW_SKU' : null
    const identityHash = hashObject({ id: product.id, sku: product.sku, name: product.name, brand: product.brand, category: product.category })
    const base = { lengthBucket, embeddedCount, mediaCount: product.media.length, mediaRisk: mediaRisk(product.media), identityHash, blocker }

    if (blocker) return { ...base, gate: 'CONTENT_REVIEW_CANDIDATE', family: 'AMBIGUOUS', reasonCodes: ['IDENTITY_BLOCKER', blocker] }
    if (exclusionCodes.length > 0) return { ...base, gate: 'KEEP_EXISTING_CONTENT', family: uniqueFamilies.length === 1 ? uniqueFamilies[0] : 'OUTSIDE_APPROVED_FAMILY', reasonCodes: exclusionCodes }
    if (uniqueFamilies.length !== 1) {
        return {
            ...base,
            gate: uniqueFamilies.length === 0 ? 'KEEP_EXISTING_CONTENT' : 'CONTENT_REVIEW_CANDIDATE',
            family: uniqueFamilies.length === 0 ? 'OUTSIDE_APPROVED_FAMILY' : 'AMBIGUOUS',
            reasonCodes: uniqueFamilies.length === 0 ? ['OUTSIDE_APPROVED_FAMILY'] : ['AMBIGUOUS_IMPORTANT_FAMILY'],
        }
    }

    const family = uniqueFamilies[0]
    const hasLength = product.visibleLength >= 500
    const hasEmbeddedImage = embeddedCount >= 1
    if (hasLength && hasEmbeddedImage) return { ...base, gate: 'REWRITE_IMPORTANT', family, reasonCodes: ['IMPORTANT_FAMILY', 'VISIBLE_BEFORE_GE_500', 'EMBEDDED_DESCRIPTION_IMAGE'] }
    if (hasLength || hasEmbeddedImage) return { ...base, gate: 'CONTENT_REVIEW_CANDIDATE', family, reasonCodes: ['IMPORTANT_FAMILY', hasLength ? 'EMBEDDED_DESCRIPTION_IMAGE_MISSING' : 'VISIBLE_BEFORE_LT_500'] }
    return { ...base, gate: 'KEEP_EXISTING_CONTENT', family, reasonCodes: ['IMPORTANT_FAMILY_SOURCE_SPARSE'] }
}

export function classifyInventory(products: PhaseCInventoryProduct[]): Array<PhaseCInventoryProduct & { classification: PhaseCClassification }> {
    const counts = new Map<string, number>()
    for (const product of products) {
        const sku = product.sku?.trim()
        if (sku) counts.set(sku, (counts.get(sku) || 0) + 1)
    }
    const duplicateSkus = new Set([...counts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku))
    return products.map((product) => ({ ...product, classification: classifyPhaseCProduct(product, duplicateSkus) }))
}

export function assertPhaseCInventoryBinding(binding: PhaseCInventoryBinding, expected: Omit<PhaseCInventoryBinding, 'proposalHash'>): void {
    if (binding.policyHash !== expected.policyHash || binding.snapshotHash !== expected.snapshotHash || binding.sourceCommit !== expected.sourceCommit || binding.proposalHash !== null || binding.bindingStatus !== 'INVENTORY_ONLY_NO_PROPOSAL') {
        throw new Error('Stale or invalid Phase C inventory binding')
    }
}
