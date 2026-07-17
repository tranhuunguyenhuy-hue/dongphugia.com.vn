export const MEDIA_PROFILES = {
    product: {
        widths: [320, 640],
        quality: 80,
    },
    editorial: {
        widths: [640, 960],
        quality: 80,
    },
    hero: {
        widths: [720, 1280, 1600],
        quality: 82,
    },
} as const

export type MediaProfile = keyof typeof MEDIA_PROFILES

export type MediaVariant = {
    url: string
    width: number
    height: number
    bytes: number
    format: 'webp'
}

export type MediaUploadResult = {
    url: string
    width: number
    height: number
    profile: MediaProfile
    variants: MediaVariant[]
}

const OPTIMIZED_MEDIA_PATTERN =
    /^(.*)\.(product|editorial|hero)\.w(\d+)\.webp([?#].*)?$/i

export function isMediaProfile(value: string | null): value is MediaProfile {
    return value !== null && Object.hasOwn(MEDIA_PROFILES, value)
}

export function getMediaProfileFromUrl(url: string): MediaProfile | null {
    const match = url.match(OPTIMIZED_MEDIA_PATTERN)
    return match && isMediaProfile(match[2]) ? match[2] : null
}

export function createMediaFileName(
    id: string,
    profile: MediaProfile,
    width: number,
): string {
    return `${id}.${profile}.w${width}.webp`
}

export function createResponsiveMediaUrl(url: string, width: number): string {
    const match = url.match(OPTIMIZED_MEDIA_PATTERN)
    if (!match) return url

    return `${match[1]}.${match[2]}.w${width}.webp${match[4] ?? ''}`
}

export function createResponsiveSrcSet(
    url: string,
    requestedProfile?: MediaProfile,
): string | undefined {
    const urlProfile = getMediaProfileFromUrl(url)
    if (!urlProfile) return undefined

    const profile = requestedProfile ?? urlProfile
    if (profile !== urlProfile) return undefined

    return MEDIA_PROFILES[profile].widths
        .map((width) => `${createResponsiveMediaUrl(url, width)} ${width}w`)
        .join(', ')
}
