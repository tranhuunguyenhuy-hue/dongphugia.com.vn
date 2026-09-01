import type { ProductV1ProfileVersion } from './profile'

/**
 * Exact JSON vocabulary accepted by the LEO-565 SQL RPCs. Domain objects stay
 * camelCase in TypeScript; every RPC payload is produced through this shared
 * serializer contract so SQL never receives provider objects or extra fields.
 */
export type MediaObjectProof = Readonly<{
    key: string
    sha256: string
    byteSize: number
    mimeType: string
}>

export type RpcMediaObject = Readonly<{
    key: string
    sha256: string
    byte_size: number
    mime_type: string
}>

export type RpcVariantObject = Readonly<{
    delivery_object_key: string
    sha256: string
    byte_size: number
    mime_type: string
}>

export type MediaRegistrationVariantRpcInput = RpcVariantObject & Readonly<{
    target_width_px: number
    width_px: number
    height_px: number
    profile_version: ProductV1ProfileVersion
}>

type MediaRegistrationRpcCommon = Readonly<{
    original_object_key: string
    delivery_object_key: string
    sha256: string
    mime_type: string
    byte_size: number
    provenance: 'upload:bunny-v1'
}>

export type ImageMediaRegistrationRpcInput = MediaRegistrationRpcCommon & Readonly<{
    kind: 'IMAGE'
    profile_version: ProductV1ProfileVersion
    width_px: number
    height_px: number
    variants: ReadonlyArray<MediaRegistrationVariantRpcInput>
}>

export type DocumentMediaRegistrationRpcInput = MediaRegistrationRpcCommon & Readonly<{
    kind: 'DOCUMENT'
    profile_version: null
    mime_type: 'application/pdf'
    width_px: null
    height_px: null
    variants: readonly []
}>

export type MediaRegistrationRpcInput =
    | ImageMediaRegistrationRpcInput
    | DocumentMediaRegistrationRpcInput

export type ProviderVerificationRpcInput = Readonly<{
    provider: 'bunny'
    original: RpcMediaObject
    delivery: ReadonlyArray<RpcMediaObject>
}>

export type MediaRegistrationVariantInput = MediaObjectProof & Readonly<{
    targetWidthPx: number
    widthPx: number
    heightPx: number
    profileVersion: ProductV1ProfileVersion
}>

type MediaRegistrationImageInput = Readonly<{
    kind: 'IMAGE'
    original: MediaObjectProof
    primary: MediaObjectProof
    source: Readonly<{
        sha256: string
        mimeType: string
        byteSize: number
        widthPx: number
        heightPx: number
    }>
    profileVersion: ProductV1ProfileVersion
    variants: ReadonlyArray<MediaRegistrationVariantInput>
}>

type MediaRegistrationDocumentInput = Readonly<{
    kind: 'DOCUMENT'
    original: MediaObjectProof
    primary: MediaObjectProof
    source: Readonly<{
        sha256: string
        mimeType: 'application/pdf'
        byteSize: number
    }>
}>

export type MediaRegistrationInput =
    | MediaRegistrationImageInput
    | MediaRegistrationDocumentInput

export function serializeRpcMediaObject(
    object: MediaObjectProof,
    keyField: 'key',
): RpcMediaObject
export function serializeRpcMediaObject(
    object: MediaObjectProof,
    keyField: 'delivery_object_key',
): RpcVariantObject
export function serializeRpcMediaObject(
    object: MediaObjectProof,
    keyField: 'key' | 'delivery_object_key',
): RpcMediaObject | RpcVariantObject {
    const common = {
        sha256: object.sha256,
        byte_size: object.byteSize,
        mime_type: object.mimeType,
    }
    return keyField === 'key'
        ? { key: object.key, ...common }
        : { delivery_object_key: object.key, ...common }
}

function serializeMediaRegistrationVariant(
    variant: MediaRegistrationVariantInput,
): MediaRegistrationVariantRpcInput {
    return {
        target_width_px: variant.targetWidthPx,
        width_px: variant.widthPx,
        height_px: variant.heightPx,
        ...serializeRpcMediaObject(variant, 'delivery_object_key'),
        profile_version: variant.profileVersion,
    }
}

/**
 * The only serializer for the catalogue_media_register JSON input. The
 * domain-shaped input deliberately cannot contain SQL field names, which
 * keeps registration and provider verification from drifting independently.
 */
export function serializeMediaRegistrationInput(
    input: MediaRegistrationInput,
): MediaRegistrationRpcInput {
    const source = serializeRpcMediaObject({
        key: input.original.key,
        sha256: input.source.sha256,
        byteSize: input.source.byteSize,
        mimeType: input.source.mimeType,
    }, 'key')
    const common = {
        original_object_key: source.key,
        delivery_object_key: input.primary.key,
        sha256: source.sha256,
        mime_type: source.mime_type,
        byte_size: source.byte_size,
        provenance: 'upload:bunny-v1' as const,
    }

    if (input.kind === 'IMAGE') {
        return {
            kind: 'IMAGE',
            ...common,
            profile_version: input.profileVersion,
            width_px: input.source.widthPx,
            height_px: input.source.heightPx,
            variants: input.variants.map(serializeMediaRegistrationVariant),
        }
    }

    return {
        kind: 'DOCUMENT',
        ...common,
        mime_type: 'application/pdf',
        profile_version: null,
        width_px: null,
        height_px: null,
        variants: [],
    }
}

/**
 * The only serializer for catalogue_media_mark_ready's provider proof.
 * Object keys are intentionally the exact allow-listed SQL vocabulary.
 */
export function serializeProviderVerificationInput(input: {
    provider: 'bunny'
    original: MediaObjectProof
    delivery: ReadonlyArray<MediaObjectProof>
}): ProviderVerificationRpcInput {
    return {
        provider: input.provider,
        original: serializeRpcMediaObject(input.original, 'key'),
        delivery: input.delivery.map((object) => serializeRpcMediaObject(object, 'key')),
    }
}
