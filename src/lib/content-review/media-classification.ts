export const MEDIA_ORIGINS = [
    'OFFICIAL_MANUFACTURER',
    'HITA_EXCLUSIVE',
    'UNVERIFIED_THIRD_PARTY',
    'UNKNOWN',
] as const

export const MEDIA_ACTIONS = [
    'KEEP_VERIFIED',
    'REMOVE_CONFIRMED_HITA',
    'REMOVE_UNVERIFIED_THIRD_PARTY',
    'REPLACE_WITH_OFFICIAL',
    'HUMAN_REVIEW',
] as const

export type MediaOrigin = typeof MEDIA_ORIGINS[number]
export type MediaAction = typeof MEDIA_ACTIONS[number]
export type MediaConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type OfficialSourceVerification = 'VERIFIED' | 'NOT_VERIFIED' | 'NOT_APPLICABLE'
export type MediaHost = 'Bunny CDN' | 'Hita' | 'External'

export interface MediaClassification {
    origin: MediaOrigin
    action: MediaAction
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

function replacement(sku: string, input: MediaClassificationInput, reason: string, cluster: string): MediaClassification {
    return {
        origin: 'UNKNOWN',
        action: 'REPLACE_WITH_OFFICIAL',
        confidence: 'MEDIUM',
        evidence: reason,
        visualCluster: cluster,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_VERIFIED',
        officialSourceRef: `Manufacturer source required for ${sku}; exact URL redacted`,
    }
}

function verified(sku: string, input: MediaClassificationInput, reason: string, cluster: string): MediaClassification {
    const officialSourceRef = officialRefs[sku]
    if (!officialSourceRef) return replacement(sku, input, 'Visual asset may resemble a manufacturer asset, but no exact durable official-source match is encoded in the approved evidence set.', `${sku.toLocaleLowerCase()}-unverified`)
    return {
        origin: 'OFFICIAL_MANUFACTURER',
        action: 'KEEP_VERIFIED',
        confidence: 'HIGH',
        evidence: reason,
        visualCluster: cluster,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'VERIFIED',
        officialSourceRef,
    }
}

function removeHita(input: MediaClassificationInput, evidence: string, cluster: string): MediaClassification {
    return {
        origin: 'HITA_EXCLUSIVE',
        action: 'REMOVE_CONFIRMED_HITA',
        confidence: 'HIGH',
        evidence,
        visualCluster: cluster,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_APPLICABLE',
        officialSourceRef: 'Not applicable: confirmed Hita source/cluster',
    }
}

function removeThirdParty(input: MediaClassificationInput, evidence: string, cluster: string): MediaClassification {
    return {
        origin: 'UNVERIFIED_THIRD_PARTY',
        action: 'REMOVE_UNVERIFIED_THIRD_PARTY',
        confidence: 'HIGH',
        evidence,
        visualCluster: cluster,
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_VERIFIED',
        officialSourceRef: 'No rights evidence in approved pilot package',
    }
}

function replaceHitaMain(input: MediaClassificationInput): MediaClassification {
    return {
        origin: 'HITA_EXCLUSIVE',
        action: 'REPLACE_WITH_OFFICIAL',
        confidence: 'HIGH',
        evidence: 'Main reference is confirmed Hita-hosted; replace it with a verified official manufacturer asset so the product retains a valid main image.',
        visualCluster: 'hita-main-replacement',
        duplicateFingerprint: input.fingerprint,
        officialSourceVerification: 'NOT_VERIFIED',
        officialSourceRef: `Manufacturer source required for ${input.sku}; exact URL redacted`,
    }
}

/**
 * Asset-first, redacted pilot evidence map.  The exact source URL never enters
 * this map: duplicate fingerprints are computed from the existing normalized
 * manifest URL and the same result is propagated to every reference.
 */
export function classifyMediaAsset(input: MediaClassificationInput): MediaClassification {
    if (input.host === 'Hita') {
        if (input.kind === 'main') return replaceHitaMain(input)
        return removeHita(input, 'Exact stored Hita-hosted provenance; source is not auto-loaded in either dashboard.', 'hita-source')
    }

    if (input.sku === 'SFV-900SX') {
        const showroom = /^gallery:31087[1-9]$|^gallery:310880$/.test(input.sourceId)
        const household = /^gallery:31088[5-9]$/.test(input.sourceId)
        const official = input.sourceId === 'main' || /^gallery:31087[0]$|^gallery:31088[1-4]$/.test(input.sourceId)
        if (showroom) return removeHita(input, 'Visual showroom/display-photo cluster; PM golden case identifies these ten exact assets as Hita showroom photographs.', 'sfv900sx-hita-showroom')
        if (household) return removeThirdParty(input, 'Visual household/installation scene; no documented image rights in the pilot evidence.', 'sfv900sx-household-install')
        if (official) return verified('SFV-900SX', input, 'Visual product render, technical drawing or instruction asset matches the official INAX SFV-900SX source.', 'sfv900sx-official-packshot-tech')
    }

    if (input.sku === 'CS326DT10#XW' && /^gallery:21580[1-8]$/.test(input.sourceId)) {
        return removeHita(input, 'Visual showroom/display-photo cluster with TOTO product display context; no rights evidence for this stored reference.', 'cs326dt10-showroom')
    }

    if (input.sku === 'SFV-802S' && /^gallery:31097[4-9]$/.test(input.sourceId)) {
        const household = /^gallery:31097[6-9]$/.test(input.sourceId)
        return household
            ? removeThirdParty(input, 'Visual household/installation photo; no documented image rights in the pilot evidence.', 'sfv802s-household-install')
            : removeHita(input, 'Visual showroom display cluster; host is not used as the sole evidence.', 'sfv802s-showroom')
    }

    if (input.sku === 'INAX-20B/CRB-1' || input.sku === 'INAX-255/VIZ-1') {
        return replacement(input.sku, input, 'Visual product/lifestyle asset observed, but the exact manufacturer source or usage rights are not proven by this stored reference.', `${input.sku.toLocaleLowerCase()}-unverified`)
    }

    if (input.sku === 'TX707AC' && input.sourceId !== 'main') {
        return removeThirdParty(input, 'Visual accessory/household capture does not prove official ownership or rights for this product reference.', 'tx707ac-unverified-accessory')
    }

    if (input.sku === 'SFV-802S' && input.sourceId === 'main') {
        return replacement(input.sku, input, 'Main visual is a product packshot but the exact official-source match is not encoded in the approved evidence set.', 'sfv802s-main-replacement')
    }

    if (input.kind === 'main') {
        return replacement(input.sku, input, 'Main asset is retained only as a proposal for official replacement until the exact manufacturer source is verified.', `${input.sku.toLocaleLowerCase()}-main-replacement`)
    }

    return replacement(input.sku, input, 'Visual asset was observed, but exact manufacturer ownership and documented rights are not proven; use an official alternative.', `${input.sku.toLocaleLowerCase()}-unverified`)
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
    if (!classification.duplicateFingerprint || !classification.visualCluster || !classification.evidence) {
        throw new Error('Media classification evidence is incomplete')
    }
    if (classification.action === 'KEEP_VERIFIED'
        && (classification.origin !== 'OFFICIAL_MANUFACTURER'
            || classification.officialSourceVerification !== 'VERIFIED'
            || !/^INAX official SFV-900SX product page and technical files; URL redacted$/.test(classification.officialSourceRef))) {
        throw new Error('KEEP_VERIFIED requires official manufacturer verification')
    }
}
