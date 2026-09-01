import { createHash } from 'node:crypto'

import sharp, { type Metadata } from 'sharp'

export const PRODUCT_V1_PROFILE = Object.freeze({
    version: 'product-v1',
    format: 'webp',
    widths: Object.freeze([320, 640, 1280]),
    quality: 82,
    withoutEnlargement: true,
})

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000
export const MAX_VARIANTS = 3
export const MAX_PROVIDER_ATTEMPTS = 2
export const PROVIDER_TIMEOUT_MS = 10_000

export type MediaKind = 'IMAGE' | 'DOCUMENT'
export type MediaState = 'PENDING' | 'READY' | 'TOMBSTONED'
export type ProductMediaRole = 'PRIMARY' | 'GALLERY'
export type ProductDocumentType =
    | 'TECHNICAL_SHEET'
    | 'INSTALLATION_GUIDE'
    | 'WARRANTY'
    | 'CERTIFICATE'
    | 'OTHER'

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export type ValidatedImage = {
    kind: 'IMAGE'
    bytes: Buffer
    sha256: string
    byteSize: number
    mimeType: ImageMime
    extension: 'jpg' | 'png' | 'webp'
    widthPx: number
    heightPx: number
}

export type ValidatedPdf = {
    kind: 'DOCUMENT'
    bytes: Buffer
    sha256: string
    byteSize: number
    mimeType: 'application/pdf'
    extension: 'pdf'
}

export type ValidatedMedia = ValidatedImage | ValidatedPdf

export class MediaContractError extends Error {
    readonly code: string

    constructor(code: string) {
        super(code)
        this.name = 'MediaContractError'
        this.code = code
    }
}

function hashBytes(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
}

function normalizedMime(value: string): string {
    return value.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
    return prefix.every((value, index) => bytes[index] === value)
}

function isWebpSignature(bytes: Uint8Array): boolean {
    return hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
        && bytes[8] === 0x57
        && bytes[9] === 0x45
        && bytes[10] === 0x42
        && bytes[11] === 0x50
}

function detectImageMime(bytes: Uint8Array): ImageMime | null {
    if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
    if (hasPrefix(bytes, [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])) return 'image/png'
    if (isWebpSignature(bytes)) return 'image/webp'
    return null
}

function imageExtension(mimeType: ImageMime): ValidatedImage['extension'] {
    if (mimeType === 'image/jpeg') return 'jpg'
    if (mimeType === 'image/png') return 'png'
    return 'webp'
}

function orientedDimensions(
    width: number,
    height: number,
    orientation: number | undefined,
) {
    if (orientation && [5, 6, 7, 8].includes(orientation)) {
        return { widthPx: height, heightPx: width }
    }
    return { widthPx: width, heightPx: height }
}

export async function validateImageSource(
    input: Uint8Array,
    declaredMime: string,
): Promise<ValidatedImage> {
    const bytes = Buffer.from(input)
    const mimeType = normalizedMime(declaredMime)
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
        throw new MediaContractError('MEDIA_BYTES_OUT_OF_BOUNDS')
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        throw new MediaContractError('MEDIA_MIME_UNSUPPORTED')
    }
    const signatureMime = detectImageMime(bytes)
    if (signatureMime !== mimeType) {
        throw new MediaContractError('MEDIA_SIGNATURE_MISMATCH')
    }

    let metadata: Metadata
    try {
        metadata = await sharp(bytes, {
            failOn: 'error',
            limitInputPixels: MAX_IMAGE_PIXELS,
        }).metadata()
    } catch {
        throw new MediaContractError('MEDIA_DECODE_FAILED')
    }
    const decodedFormat = metadata.format
    const expectedFormat = mimeType === 'image/jpeg'
        ? 'jpeg'
        : mimeType.slice('image/'.length)
    if (decodedFormat !== expectedFormat) {
        throw new MediaContractError('MEDIA_FORMAT_MISMATCH')
    }
    if (metadata.pages && metadata.pages > 1) {
        throw new MediaContractError('MEDIA_ANIMATION_UNSUPPORTED')
    }
    if (!metadata.width || !metadata.height) {
        throw new MediaContractError('MEDIA_DIMENSIONS_MISSING')
    }
    const dimensions = orientedDimensions(
        metadata.width,
        metadata.height,
        metadata.orientation,
    )
    if (
        dimensions.widthPx <= 0
        || dimensions.heightPx <= 0
        || dimensions.widthPx * dimensions.heightPx > MAX_IMAGE_PIXELS
    ) {
        throw new MediaContractError('MEDIA_PIXELS_OUT_OF_BOUNDS')
    }

    return {
        kind: 'IMAGE',
        bytes,
        sha256: hashBytes(bytes),
        byteSize: bytes.byteLength,
        mimeType: mimeType as ImageMime,
        extension: imageExtension(mimeType as ImageMime),
        ...dimensions,
    }
}

export function validatePdfSource(
    input: Uint8Array,
    declaredMime: string,
): ValidatedPdf {
    const bytes = Buffer.from(input)
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
        throw new MediaContractError('MEDIA_BYTES_OUT_OF_BOUNDS')
    }
    if (normalizedMime(declaredMime) !== 'application/pdf') {
        throw new MediaContractError('MEDIA_MIME_UNSUPPORTED')
    }
    const header = bytes.subarray(0, 5).toString('ascii')
    const trailer = bytes.subarray(Math.max(0, bytes.byteLength - 1024)).toString('ascii')
    if (header !== '%PDF-' || !trailer.includes('%%EOF')) {
        throw new MediaContractError('PDF_SIGNATURE_INVALID')
    }
    return {
        kind: 'DOCUMENT',
        bytes,
        sha256: hashBytes(bytes),
        byteSize: bytes.byteLength,
        mimeType: 'application/pdf',
        extension: 'pdf',
    }
}

export async function validateMediaSource(
    input: Uint8Array,
    kind: MediaKind,
    declaredMime: string,
): Promise<ValidatedMedia> {
    return kind === 'IMAGE'
        ? validateImageSource(input, declaredMime)
        : validatePdfSource(input, declaredMime)
}

export function imageVariantTargets(sourceWidthPx: number): number[] {
    const eligible = PRODUCT_V1_PROFILE.widths.filter(
        (width) => width <= sourceWidthPx,
    )
    return eligible.length > 0
        ? [...eligible]
        : [PRODUCT_V1_PROFILE.widths[0]]
}

export function privateOriginalObjectKey(media: ValidatedMedia): string {
    return `private/originals/v1/${media.sha256.slice(0, 2)}/${media.sha256}/source.${media.extension}`
}

export function publicImageObjectKey(
    sourceSha256: string,
    targetWidthPx: number,
    outputSha256: string,
): string {
    assertSha256(sourceSha256)
    assertSha256(outputSha256)
    if (!PRODUCT_V1_PROFILE.widths.includes(targetWidthPx as never)) {
        throw new MediaContractError('MEDIA_PROFILE_WIDTH_UNSUPPORTED')
    }
    return `public/images/${PRODUCT_V1_PROFILE.version}/${sourceSha256}/w${targetWidthPx}-${outputSha256}.webp`
}

export function publicPdfObjectKey(sha256: string): string {
    assertSha256(sha256)
    return `public/documents/v1/${sha256}/document.pdf`
}

export function assertSha256(value: string): asserts value is string {
    if (!/^[a-f0-9]{64}$/.test(value)) {
        throw new MediaContractError('MEDIA_SHA256_INVALID')
    }
}

export function assertGeneratedObjectKey(value: string): string {
    if (
        !value
        || value.length > 512
        || value.startsWith('/')
        || value.includes('..')
        || value.includes('\\')
        || value.includes('://')
        || !/^[a-z0-9][a-z0-9._/-]*$/.test(value)
    ) {
        throw new MediaContractError('MEDIA_OBJECT_KEY_INVALID')
    }
    const privateMatch = value.match(
        /^private\/originals\/v1\/([a-f0-9]{2})\/([a-f0-9]{64})\/source\.(jpg|png|webp|pdf)$/,
    )
    const publicImageMatch = value.match(
        /^public\/images\/product-v1\/([a-f0-9]{64})\/w(320|640|1280)-([a-f0-9]{64})\.webp$/,
    )
    const publicPdfMatch = value.match(
        /^public\/documents\/v1\/([a-f0-9]{64})\/document\.pdf$/,
    )
    if (
        (privateMatch && privateMatch[1] !== privateMatch[2]?.slice(0, 2))
        || (!privateMatch && !publicImageMatch && !publicPdfMatch)
    ) {
        throw new MediaContractError('MEDIA_OBJECT_KEY_INVALID')
    }
    return value
}

export function assertObjectKeyMatchesSha256(
    key: string,
    sha256: string,
): string {
    assertGeneratedObjectKey(key)
    assertSha256(sha256)
    const privateMatch = key.match(
        /^private\/originals\/v1\/[a-f0-9]{2}\/([a-f0-9]{64})\/source\.(jpg|png|webp|pdf)$/,
    )
    const publicImageMatch = key.match(
        /^public\/images\/product-v1\/[a-f0-9]{64}\/w(?:320|640|1280)-([a-f0-9]{64})\.webp$/,
    )
    const publicPdfMatch = key.match(
        /^public\/documents\/v1\/([a-f0-9]{64})\/document\.pdf$/,
    )
    const embeddedSha256 = privateMatch?.[1] ?? publicImageMatch?.[1] ?? publicPdfMatch?.[1]
    if (embeddedSha256 !== sha256) {
        throw new MediaContractError('MEDIA_OBJECT_KEY_SHA256_MISMATCH')
    }
    return key
}

export function assertPublicDeliveryHostname(value: string): string {
    const hostname = value.trim().toLowerCase()
    if (
        !hostname
        || hostname.length > 253
        || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname)
        || hostname.includes('..')
    ) {
        throw new MediaContractError('MEDIA_DELIVERY_HOST_INVALID')
    }
    return hostname
}
