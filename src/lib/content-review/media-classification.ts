export const MEDIA_ORIGINS = [
    'OFFICIAL_MANUFACTURER',
    'HITA_EXCLUSIVE',
    'UNVERIFIED_THIRD_PARTY',
    'UNKNOWN',
] as const

export const MEDIA_ACTIONS = [
    'KEEP_PRODUCT',
    'KEEP_TECHNICAL',
    'KEEP_TEMPORARY',
    'REMOVE_HITA_SHOWROOM',
    'HUMAN_REVIEW',
] as const

export type MediaOrigin = typeof MEDIA_ORIGINS[number]
export type MediaAction = typeof MEDIA_ACTIONS[number]
export type MediaConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type OfficialSourceVerification = 'VERIFIED' | 'NOT_VERIFIED' | 'NOT_APPLICABLE'
export type MediaHost = 'Bunny CDN' | 'Hita' | 'External'

export const MEDIA_ACTION_LABELS: Record<MediaAction, string> = {
    KEEP_PRODUCT: 'GIỮ — Hình sản phẩm',
    KEEP_TECHNICAL: 'GIỮ — Bản vẽ/HDSD',
    KEEP_TEMPORARY: 'GIỮ TẠM — Chưa chứng minh nguồn, không phải showroom Hita',
    REMOVE_HITA_SHOWROOM: 'XOÁ — Showroom/cửa hàng Hita',
    HUMAN_REVIEW: 'CẦN XEM',
}

export interface MediaClassification {
    origin: MediaOrigin
    action: MediaAction
    label: string
    confidence: MediaConfidence
    evidence: string
    visualCluster: string
    duplicateFingerprint: string
    officialSourceVerification: OfficialSourceVerification
    officialSourceRef: string
}

export interface MediaClassificationInput {
    sku: string
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    fingerprint: string
    host: MediaHost
}

const officialRefs: Record<string, string> = {
    'SFV-900SX': 'INAX official SFV-900SX product page and technical files; URL redacted',
}

function retained(
    input: MediaClassificationInput,
    action: Exclude<MediaAction, 'REMOVE_HITA_SHOWROOM' | 'HUMAN_REVIEW'>,
    evidence: string,
    cluster: string,
    origin: MediaOrigin = 'UNKNOWN',
): MediaClassification {
    const officialSourceRef = officialRefs[input.sku] && input.sku === 'SFV-900SX'
        ? officialRefs[input.sku]
        : 'No official-source verification performed; existing asset retained with residual copyright risk.'
    return {
        origin,
        action,
        label: MEDIA_ACTION_LABELS[action],
        confidence: action === 'KEEP_TEMPORARY' ? 'MEDIUM' : 'HIGH',
        evidence,
        visualCluster: cluster,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: officialRefs[input.sku] ? 'VERIFIED' : 'NOT_VERIFIED',
        officialSourceRef,
    }
}

function removeHitaShowroom(input: MediaClassificationInput, evidence: string, cluster: string): MediaClassification {
    return {
        origin: 'HITA_EXCLUSIVE',
        action: 'REMOVE_HITA_SHOWROOM',
        label: MEDIA_ACTION_LABELS.REMOVE_HITA_SHOWROOM,
        confidence: 'HIGH',
        evidence,
        visualCluster: cluster,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_APPLICABLE',
        officialSourceRef: 'Not applicable: visually confirmed Hita showroom/store/display photo',
    }
}

function needsHumanReview(input: MediaClassificationInput): MediaClassification {
    return {
        origin: 'UNKNOWN',
        action: 'HUMAN_REVIEW',
        label: MEDIA_ACTION_LABELS.HUMAN_REVIEW,
        confidence: 'LOW',
        evidence: 'Visual role or provenance is genuinely unclear from the approved offline evidence.',
        visualCluster: `${input.sku.toLocaleLowerCase()}-unclear`,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_APPLICABLE',
        officialSourceRef: 'Manual visual review required; no remote fetch performed',
    }
}

function isConfirmedHitaShowroom(input: MediaClassificationInput): boolean {
    if (input.sku === 'SFV-900SX') return /^gallery:31087[1-9]$|^gallery:310880$/.test(input.sourceId)
    if (input.sku === 'CS326DT10#XW') return /^gallery:21580[1-8]$/.test(input.sourceId)
    if (input.sku === 'SFV-802S') return /^gallery:31097[45]$/.test(input.sourceId)
    return input.sku === 'WF-9089-CHROME' && input.sourceId === 'gallery:291927'
}

function isKnownUnverifiedNonShowroom(input: MediaClassificationInput): boolean {
    if (input.sku === 'SFV-900SX') return /^gallery:31088[5-9]$/.test(input.sourceId)
    if (input.sku === 'SFV-802S') return /^gallery:31097[6-9]$/.test(input.sourceId)
    if (input.sku === 'TX707AC') return input.sourceId !== 'main'
    return input.sku === 'INAX-20B/CRB-1' || input.sku === 'INAX-255/VIZ-1'
}

/**
 * Offline, visual-role-first policy for the PM timebox. Host alone never
 * removes an asset: only the explicit showroom/display clusters below do.
 */
export function classifyMediaAsset(input: MediaClassificationInput): MediaClassification {
    if (isConfirmedHitaShowroom(input)) {
        return removeHitaShowroom(input, 'Visual store/showroom/display-photo cluster confirmed as Hita; remove only this reference.', `${input.sku.toLocaleLowerCase()}-hita-showroom`)
    }

    if (input.host === 'External') return needsHumanReview(input)

    if (isKnownUnverifiedNonShowroom(input)) {
        return retained(input, 'KEEP_TEMPORARY', 'Non-showroom household, lifestyle, installation or unverified visual retained for this timebox with residual copyright risk.', `${input.sku.toLocaleLowerCase()}-non-showroom-risk`)
    }

    if (input.sku === 'SFV-900SX' && (input.sourceId === 'main' || /^gallery:31087[0]$|^gallery:31088[1-4]$/.test(input.sourceId))) {
        return retained(input, 'KEEP_PRODUCT', 'Product render, packshot or technical product asset matches the approved INAX SFV-900SX evidence.', 'sfv900sx-product-approved', 'OFFICIAL_MANUFACTURER')
    }

    if (input.kind === 'embedded') {
        return retained(input, 'KEEP_TECHNICAL', 'Existing embedded description asset is retained as a diagram, technical drawing or instruction reference; no new asset was added.', `${input.sku.toLocaleLowerCase()}-embedded-technical`, input.host === 'Hita' ? 'HITA_EXCLUSIVE' : 'UNKNOWN')
    }

    if (input.host === 'Hita') {
        return retained(input, 'KEEP_TEMPORARY', 'Existing Hita-hosted product reference is retained because it is not a confirmed showroom/display photo; residual copyright risk remains.', `${input.sku.toLocaleLowerCase()}-hita-product`, 'HITA_EXCLUSIVE')
    }

    return retained(input, 'KEEP_PRODUCT', 'Existing product packshot or render is retained; no official-image search or replacement was performed.', `${input.sku.toLocaleLowerCase()}-product`)
}

/** Apply the first-seen asset decision to every duplicate reference. */
export function classifyMediaReferences(inputs: MediaClassificationInput[]): MediaClassification[] {
    const byFingerprint = new Map<string, MediaClassification>()
    return inputs.map(input => {
        const existing = byFingerprint.get(input.fingerprint)
        if (existing) return existing
        const classification = classifyMediaAsset(input)
        assertValidMediaClassification(classification)
        byFingerprint.set(input.fingerprint, classification)
        return classification
    })
}

export function countMediaClassifications(classifications: MediaClassification[]): Record<MediaAction, number> {
    const counts = Object.fromEntries(MEDIA_ACTIONS.map(action => [action, 0])) as Record<MediaAction, number>
    for (const classification of classifications) counts[classification.action] += 1
    return counts
}

export function assertValidMediaClassification(classification: MediaClassification): void {
    if (!MEDIA_ORIGINS.includes(classification.origin) || !MEDIA_ACTIONS.includes(classification.action)) {
        throw new Error('Invalid media classification enum')
    }
    if (classification.label !== MEDIA_ACTION_LABELS[classification.action]) {
        throw new Error('Media classification label does not match action')
    }
    if (!classification.duplicateFingerprint || !classification.visualCluster || !classification.evidence) {
        throw new Error('Media classification evidence is incomplete')
    }
    if (classification.action === 'REMOVE_HITA_SHOWROOM' && classification.origin !== 'HITA_EXCLUSIVE') {
        throw new Error('Hita showroom removal requires HITA_EXCLUSIVE origin')
    }
    if (classification.action === 'HUMAN_REVIEW' && classification.confidence !== 'LOW') {
        throw new Error('CẦN XEM must remain low-confidence')
    }
}
