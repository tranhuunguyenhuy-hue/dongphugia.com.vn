import { createHash } from 'node:crypto'

import {
    MAX_MEDIA_BYTES,
    MAX_PROVIDER_ATTEMPTS,
    assertGeneratedObjectKey,
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

export function mediaRegistrationInput(bundle: ProductV1MediaBundle) {
    return {
        kind: bundle.kind,
        original_object_key: bundle.original.key,
        delivery_object_key: bundle.primaryVariant.key,
        profile_version: bundle.profileVersion,
        sha256: bundle.source.sha256,
        mime_type: bundle.source.mimeType,
        byte_size: bundle.source.byteSize,
        width_px: bundle.kind === 'IMAGE' ? bundle.source.widthPx : null,
        height_px: bundle.kind === 'IMAGE' ? bundle.source.heightPx : null,
        provenance: 'upload:bunny-v1',
        variants: bundle.variants.map((variant) => ({
            target_width_px: variant.targetWidthPx,
            width_px: variant.widthPx,
            height_px: variant.heightPx,
            delivery_object_key: variant.key,
            sha256: variant.sha256,
            byte_size: variant.byteSize,
            mime_type: variant.mimeType,
        })),
    }
}

export function providerVerificationInput(
    verification: BundleProviderVerification,
) {
    return {
        provider: verification.provider,
        original: verification.original,
        delivery: verification.delivery,
    }
}
