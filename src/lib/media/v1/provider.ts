import { createHash } from 'node:crypto'

import {
    MAX_MEDIA_BYTES,
    MAX_PROVIDER_ATTEMPTS,
    assertGeneratedObjectKey,
    assertObjectKeyMatchesSha256,
} from './contract'
import type { ProductV1MediaBundle, ProcessedMediaObject } from './processor'

export type ProviderObject = {
    key: string
    bytes: Buffer
    sha256: string
    byteSize: number
    mimeType: string
}

export interface ImmutableMediaObjectStore {
    put(object: Pick<ProcessedMediaObject, 'key' | 'bytes' | 'mimeType'>): Promise<void>
    read(key: string, maxBytes?: number): Promise<ProviderObject>
}

export class MediaObjectNotFoundError extends Error {
    constructor() {
        super('MEDIA_PROVIDER_OBJECT_NOT_FOUND')
        this.name = 'MediaObjectNotFoundError'
    }
}

export class MediaProviderError extends Error {
    readonly code: string

    constructor(code: string) {
        super(code)
        this.name = 'MediaProviderError'
        this.code = code
    }
}

export type ProviderVerification = {
    provider: 'bunny'
    key: string
    sha256: string
    byteSize: number
    mimeType: string
}

type RpcMediaObjectBase = Readonly<{
    sha256: string
    byte_size: number
    mime_type: string
}>

type RpcMediaObject = RpcMediaObjectBase & Readonly<{
    key: string
}>

type RpcVariantObject = RpcMediaObjectBase & Readonly<{
    delivery_object_key: string
}>

type MediaRegistrationRpcCommon = Readonly<{
    original_object_key: string
    delivery_object_key: string
    sha256: string
    mime_type: string
    byte_size: number
    provenance: 'upload:bunny-v1'
}>

type MediaRegistrationVariantRpcInput = RpcVariantObject & Readonly<{
    target_width_px: number
    width_px: number
    height_px: number
    profile_version: 'product-v1'
}>

export type MediaRegistrationRpcInput = MediaRegistrationRpcCommon & (
    Readonly<{
        kind: 'IMAGE'
        profile_version: 'product-v1'
        width_px: number
        height_px: number
        variants: ReadonlyArray<MediaRegistrationVariantRpcInput>
    }>
    | Readonly<{
        kind: 'DOCUMENT'
        profile_version: null
        width_px: null
        height_px: null
        variants: readonly []
    }>
)

export type ProviderVerificationRpcInput = Readonly<{
    provider: 'bunny'
    original: RpcMediaObject
    delivery: ReadonlyArray<RpcMediaObject>
}>

type RpcObjectKeyField = 'key' | 'delivery_object_key'
type MediaObjectProof = Pick<ProviderVerification, 'key' | 'sha256' | 'byteSize' | 'mimeType'>

function serializeMediaObject(
    object: MediaObjectProof,
    keyField: 'key',
): RpcMediaObject
function serializeMediaObject(
    object: MediaObjectProof,
    keyField: 'delivery_object_key',
): RpcVariantObject
function serializeMediaObject(
    object: MediaObjectProof,
    keyField: RpcObjectKeyField,
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
    variant: ProcessedMediaObject,
): MediaRegistrationVariantRpcInput {
    if (
        !variant.targetWidthPx
        || variant.widthPx === null
        || variant.heightPx === null
    ) {
        throw new MediaProviderError('MEDIA_VARIANT_TARGET_MISSING')
    }
    return {
        target_width_px: variant.targetWidthPx,
        width_px: variant.widthPx,
        height_px: variant.heightPx,
        ...serializeMediaObject(variant, 'delivery_object_key'),
        profile_version: 'product-v1',
    }
}

function digest(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
}

function isNotFound(error: unknown): boolean {
    return error instanceof MediaObjectNotFoundError
}

function sameObject(
    expected: Pick<ProcessedMediaObject, 'key' | 'sha256' | 'byteSize' | 'mimeType'>,
    actual: ProviderObject,
): boolean {
    return actual.key === expected.key
        && actual.sha256 === expected.sha256
        && actual.byteSize === expected.byteSize
        && actual.mimeType.toLowerCase().split(';', 1)[0] === expected.mimeType
}

async function verifyExisting(
    store: ImmutableMediaObjectStore,
    expected: ProcessedMediaObject,
): Promise<ProviderVerification | null> {
    try {
        assertObjectKeyMatchesSha256(expected.key, expected.sha256)
        const actual = await store.read(expected.key, Math.max(expected.byteSize, MAX_MEDIA_BYTES))
        if (!sameObject(expected, actual)) {
            throw new MediaProviderError('MEDIA_STORAGE_CONFLICT')
        }
        return {
            provider: 'bunny',
            key: expected.key,
            sha256: actual.sha256,
            byteSize: actual.byteSize,
            mimeType: actual.mimeType.toLowerCase().split(';', 1)[0] ?? actual.mimeType,
        }
    } catch (error) {
        if (isNotFound(error)) return null
        if (error instanceof MediaProviderError) throw error
        throw new MediaProviderError('MEDIA_PROVIDER_READ_FAILED')
    }
}

/**
 * Bunny does not provide a create-only primitive in this adapter. A bounded
 * read-before-write and read-after-write reconciliation makes a retry safe:
 * an identical object is accepted, while a different object is a conflict.
 * There is intentionally no delete or prefix operation here.
 */
export async function ensureImmutableObject(
    store: ImmutableMediaObjectStore,
    expected: ProcessedMediaObject,
): Promise<ProviderVerification> {
    assertGeneratedObjectKey(expected.key)
    assertObjectKeyMatchesSha256(expected.key, expected.sha256)
    if (
        expected.byteSize !== expected.bytes.byteLength
        || expected.byteSize <= 0
        || expected.byteSize > MAX_MEDIA_BYTES
        || digest(expected.bytes) !== expected.sha256
    ) {
        throw new MediaProviderError('MEDIA_PROVIDER_OBJECT_INVALID')
    }
    for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
        const existing = await verifyExisting(store, expected)
        if (existing) return existing

        let putError: unknown
        try {
            await store.put(expected)
        } catch (error) {
            putError = error
        }

        const reconciled = await verifyExisting(store, expected)
        if (reconciled) return reconciled
        if (attempt === MAX_PROVIDER_ATTEMPTS - 1) {
            if (putError) throw new MediaProviderError('MEDIA_PROVIDER_WRITE_AMBIGUOUS')
            throw new MediaProviderError('MEDIA_PROVIDER_VERIFICATION_FAILED')
        }
    }
    throw new MediaProviderError('MEDIA_PROVIDER_VERIFICATION_FAILED')
}

export type BundleProviderVerification = {
    provider: 'bunny'
    original: ProviderVerification
    delivery: ProviderVerification[]
}

export async function storeAndVerifyProductV1Bundle(
    bundle: ProductV1MediaBundle,
    stores: { originals: ImmutableMediaObjectStore; delivery: ImmutableMediaObjectStore },
): Promise<BundleProviderVerification> {
    const original = await ensureImmutableObject(stores.originals, bundle.original)
    const deliveryObjects = bundle.kind === 'IMAGE'
        ? bundle.variants
        : [bundle.primaryVariant]
    const delivery: ProviderVerification[] = []
    for (const object of deliveryObjects) {
        delivery.push(await ensureImmutableObject(stores.delivery, object))
    }
    if (delivery.length === 0) {
        throw new MediaProviderError('MEDIA_PROVIDER_DELIVERY_EMPTY')
    }
    return { provider: 'bunny', original, delivery }
}

export function mediaRegistrationInput(bundle: ProductV1MediaBundle): MediaRegistrationRpcInput {
    const common: MediaRegistrationRpcCommon = {
        original_object_key: bundle.original.key,
        delivery_object_key: bundle.primaryVariant.key,
        sha256: bundle.source.sha256,
        mime_type: bundle.source.mimeType,
        byte_size: bundle.source.byteSize,
        provenance: 'upload:bunny-v1',
    }
    if (bundle.kind === 'IMAGE') {
        return {
            kind: 'IMAGE',
            ...common,
            profile_version: bundle.profileVersion,
            width_px: bundle.source.widthPx,
            height_px: bundle.source.heightPx,
            variants: bundle.variants.map(serializeMediaRegistrationVariant),
        }
    }
    return {
        kind: 'DOCUMENT',
        ...common,
        profile_version: null,
        width_px: null,
        height_px: null,
        variants: [],
    }
}

export function providerVerificationInput(
    verification: BundleProviderVerification,
): ProviderVerificationRpcInput {
    return {
        provider: verification.provider,
        original: serializeMediaObject(verification.original, 'key'),
        delivery: verification.delivery.map((object) => serializeMediaObject(object, 'key')),
    }
}
