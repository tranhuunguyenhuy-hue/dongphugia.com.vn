import { sha256 } from './hash'
import type {
    ReviewImage,
    ReviewImageDecision,
    ReviewImageKind,
    ReviewImagePolicy,
} from './types'

const TRACKING_PARAMS = new Set([
    'fbclid',
    'gclid',
    'mc_cid',
    'mc_eid',
    'utm_campaign',
    'utm_content',
    'utm_medium',
    'utm_source',
    'utm_term',
])

export function normalizeImageUrl(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return ''

    try {
        const url = new URL(trimmed)
        url.hash = ''
        url.hostname = url.hostname.toLowerCase()
        url.protocol = url.protocol.toLowerCase()
        for (const key of [...url.searchParams.keys()]) {
            if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
        }
        url.searchParams.sort()
        if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
            url.port = ''
        }
        return url.toString()
    } catch {
        return trimmed
    }
}

export function isBunnyAsset(value: string): boolean {
    try {
        const hostname = new URL(value).hostname.toLowerCase()
        return hostname === 'cdn.dongphugia.com.vn' || hostname.endsWith('.b-cdn.net')
    } catch {
        return false
    }
}

export function isHitaHostedAsset(value: string): boolean {
    try {
        const hostname = new URL(value).hostname.toLowerCase()
        return hostname === 'hita.com.vn' || hostname.endsWith('.hita.com.vn')
    } catch {
        return false
    }
}

export function classifyImagePolicy(value: string): ReviewImagePolicy {
    if (isBunnyAsset(value)) return 'KEEP_EXISTING_BUNNY'
    if (isHitaHostedAsset(value)) return 'HITA_HOSTED_REVIEW'
    return 'EXTERNAL_REVIEW'
}

function initialDecision(policy: ReviewImagePolicy): ReviewImageDecision {
    return policy === 'KEEP_EXISTING_BUNNY' ? 'KEEP' : 'HUMAN_REVIEW'
}

export function createReviewImage(
    kind: ReviewImageKind,
    sourceUrl: string,
    altText?: string | null,
): ReviewImage {
    const normalizedUrl = normalizeImageUrl(sourceUrl)
    const policy = classifyImagePolicy(normalizedUrl)
    return {
        kind,
        sourceUrl,
        normalizedUrl,
        fingerprint: sha256(normalizedUrl),
        policy,
        decision: initialDecision(policy),
        ...(altText ? { altText } : {}),
    }
}

export function dedupeReviewImages(images: ReviewImage[]): ReviewImage[] {
    const byKindAndFingerprint = new Map<string, ReviewImage>()
    for (const image of images) {
        const key = `${image.kind}:${image.fingerprint}`
        if (!byKindAndFingerprint.has(key)) byKindAndFingerprint.set(key, image)
    }
    return [...byKindAndFingerprint.values()]
}

export function validateImageDecision(
    image: ReviewImage,
    decision: ReviewImageDecision,
    replacementUrl?: string,
): void {
    if (decision === 'KEEP' && image.policy !== 'KEEP_EXISTING_BUNNY') {
        throw new Error('Only existing approved Bunny assets may be kept')
    }
    if (decision === 'REPLACE' && (!replacementUrl || !isBunnyAsset(replacementUrl))) {
        throw new Error('Replacement must reference an existing approved Bunny asset')
    }
}
