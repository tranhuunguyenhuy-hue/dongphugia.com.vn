import sharp, { type OutputInfo } from 'sharp'

import {
    MAX_IMAGE_PIXELS,
    MAX_MEDIA_BYTES,
    MediaContractError,
    PRODUCT_V1_PROFILE,
    type ValidatedImage,
    type ValidatedMedia,
    type ValidatedPdf,
    imageVariantTargets,
    privateOriginalObjectKey,
    publicImageObjectKey,
    publicPdfObjectKey,
    validateImageSource,
    validatePdfSource,
} from './contract'

export type ProcessedMediaObject = {
    key: string
    bytes: Buffer
    sha256: string
    byteSize: number
    mimeType: 'image/webp' | 'application/pdf' | 'image/jpeg' | 'image/png'
    widthPx: number | null
    heightPx: number | null
    targetWidthPx?: number
}

export type ProductV1ImageBundle = {
    kind: 'IMAGE'
    source: ValidatedImage
    original: ProcessedMediaObject
    variants: ProcessedMediaObject[]
    primaryVariant: ProcessedMediaObject
    profileVersion: typeof PRODUCT_V1_PROFILE.version
}

export type ProductV1PdfBundle = {
    kind: 'DOCUMENT'
    source: ValidatedPdf
    original: ProcessedMediaObject
    variants: []
    primaryVariant: ProcessedMediaObject
    profileVersion: null
}

export type ProductV1MediaBundle = ProductV1ImageBundle | ProductV1PdfBundle

function sourceObject(media: ValidatedMedia): ProcessedMediaObject {
    return {
        key: privateOriginalObjectKey(media),
        bytes: media.bytes,
        sha256: media.sha256,
        byteSize: media.byteSize,
        mimeType: media.mimeType,
        widthPx: media.kind === 'IMAGE' ? media.widthPx : null,
        heightPx: media.kind === 'IMAGE' ? media.heightPx : null,
    }
}

async function makeImageVariant(
    source: ValidatedImage,
    targetWidthPx: number,
): Promise<ProcessedMediaObject> {
    let output: { data: Buffer; info: OutputInfo }
    try {
        output = await sharp(source.bytes, {
            failOn: 'error',
            limitInputPixels: MAX_IMAGE_PIXELS,
        })
            .rotate()
            .resize({
                width: targetWidthPx,
                fit: 'inside',
                withoutEnlargement: PRODUCT_V1_PROFILE.withoutEnlargement,
            })
            .webp({
                quality: PRODUCT_V1_PROFILE.quality,
                effort: 4,
                smartSubsample: true,
            })
            .toBuffer({ resolveWithObject: true })
    } catch {
        throw new MediaContractError('MEDIA_TRANSFORM_FAILED')
    }

    if (
        output.info.format !== 'webp'
        || !output.info.width
        || !output.info.height
        || output.info.width > source.widthPx
        || output.info.height > source.heightPx
        || output.info.width > targetWidthPx
        || output.data.byteLength === 0
        || output.data.byteLength > MAX_MEDIA_BYTES
    ) {
        throw new MediaContractError('MEDIA_TRANSFORM_CONTRACT_FAILED')
    }

    const validated = await validateImageSource(output.data, 'image/webp')
    if (
        validated.widthPx !== output.info.width
        || validated.heightPx !== output.info.height
    ) {
        throw new MediaContractError('MEDIA_TRANSFORM_DIMENSIONS_MISMATCH')
    }

    return {
        key: publicImageObjectKey(source.sha256, targetWidthPx),
        bytes: output.data,
        sha256: validated.sha256,
        byteSize: output.data.byteLength,
        mimeType: 'image/webp',
        widthPx: validated.widthPx,
        heightPx: validated.heightPx,
        targetWidthPx,
    }
}

export async function processProductV1Image(
    input: Uint8Array,
    declaredMime: string,
): Promise<ProductV1ImageBundle> {
    const source = await validateImageSource(input, declaredMime)
    const targets = imageVariantTargets(source.widthPx)
    if (targets.length > 3) {
        throw new MediaContractError('MEDIA_VARIANT_COUNT_OUT_OF_BOUNDS')
    }
    const variants = await Promise.all(
        targets.map((targetWidthPx) => makeImageVariant(source, targetWidthPx)),
    )
    const primaryVariant = variants.at(-1)
    if (!primaryVariant) throw new MediaContractError('MEDIA_VARIANTS_EMPTY')
    return {
        kind: 'IMAGE',
        source,
        original: sourceObject(source),
        variants,
        primaryVariant,
        profileVersion: PRODUCT_V1_PROFILE.version,
    }
}

export function processProductV1Pdf(
    input: Uint8Array,
    declaredMime: string,
): ProductV1PdfBundle {
    const source = validatePdfSource(input, declaredMime)
    const object: ProcessedMediaObject = {
        key: publicPdfObjectKey(source.sha256),
        bytes: source.bytes,
        sha256: source.sha256,
        byteSize: source.byteSize,
        mimeType: source.mimeType,
        widthPx: null,
        heightPx: null,
    }
    return {
        kind: 'DOCUMENT',
        source,
        original: sourceObject(source),
        variants: [],
        primaryVariant: object,
        profileVersion: null,
    }
}

export async function processProductV1Media(
    input: Uint8Array,
    kind: 'IMAGE',
    declaredMime: string,
): Promise<ProductV1ImageBundle>
export function processProductV1Media(
    input: Uint8Array,
    kind: 'DOCUMENT',
    declaredMime: string,
): Promise<ProductV1PdfBundle>
export function processProductV1Media(
    input: Uint8Array,
    kind: 'IMAGE' | 'DOCUMENT',
    declaredMime: string,
): Promise<ProductV1MediaBundle>
export async function processProductV1Media(
    input: Uint8Array,
    kind: 'IMAGE' | 'DOCUMENT',
    declaredMime: string,
): Promise<ProductV1MediaBundle> {
    return kind === 'IMAGE'
        ? processProductV1Image(input, declaredMime)
        : processProductV1Pdf(input, declaredMime)
}
