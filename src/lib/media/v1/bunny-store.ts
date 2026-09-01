import 'server-only'

import { createHash } from 'node:crypto'

import {
    MAX_MEDIA_BYTES,
    PROVIDER_TIMEOUT_MS,
    MediaContractError,
    assertGeneratedObjectKey,
    assertPublicDeliveryHostname,
} from './contract'
import {
    MediaObjectNotFoundError,
    MediaProviderError,
    type ImmutableMediaObjectStore,
    type ProviderObject,
} from './provider'
import type { ProcessedMediaObject } from './processor'

export type BunnyStorageArea = {
    storageZone: string
    storageHostname: string
    apiKey: string
}

export type BunnyMediaStoreConfig = {
    originals: BunnyStorageArea
    delivery: BunnyStorageArea & { cdnHostname: string }
}

function digest(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
}

function fallbackMimeType(key: string): string {
    if (key.endsWith('.pdf')) return 'application/pdf'
    if (key.endsWith('.webp')) return 'image/webp'
    if (key.endsWith('.jpg')) return 'image/jpeg'
    if (key.endsWith('.png')) return 'image/png'
    return 'application/octet-stream'
}

function responseMimeType(response: Response, key: string): string {
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    return !contentType || contentType === 'application/octet-stream'
        ? fallbackMimeType(key)
        : contentType
}

function safeZone(value: string): string {
    const zone = value.trim()
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(zone)) {
        throw new MediaContractError('MEDIA_STORAGE_ZONE_INVALID')
    }
    return zone
}

function safeHost(value: string): string {
    return assertPublicDeliveryHostname(value)
}

function pathSegment(value: string): string {
    return value.split('/').map(encodeURIComponent).join('/')
}

function endpoint(area: BunnyStorageArea, key: string): string {
    assertGeneratedObjectKey(key)
    return `https://${safeHost(area.storageHostname)}/${safeZone(area.storageZone)}/${pathSegment(key)}`
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Buffer> {
    const contentLength = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new MediaProviderError('MEDIA_PROVIDER_OBJECT_TOO_LARGE')
    }
    if (!response.body) {
        const bytes = Buffer.from(await response.arrayBuffer())
        if (bytes.byteLength > maxBytes) {
            throw new MediaProviderError('MEDIA_PROVIDER_OBJECT_TOO_LARGE')
        }
        return bytes
    }
    const reader = response.body.getReader()
    const chunks: Buffer[] = []
    let total = 0
    try {
        while (true) {
            const next = await reader.read()
            if (next.done) break
            const chunk = Buffer.from(next.value)
            total += chunk.byteLength
            if (total > maxBytes) throw new MediaProviderError('MEDIA_PROVIDER_OBJECT_TOO_LARGE')
            chunks.push(chunk)
        }
    } finally {
        await reader.cancel().catch(() => undefined)
    }
    return Buffer.concat(chunks, total)
}

export class BunnyMediaStore implements ImmutableMediaObjectStore {
    private readonly area: BunnyStorageArea

    constructor(area: BunnyStorageArea) {
        this.area = area
    }

    async put(object: Pick<ProcessedMediaObject, 'key' | 'bytes' | 'mimeType'>): Promise<void> {
        if (object.bytes.byteLength === 0 || object.bytes.byteLength > MAX_MEDIA_BYTES) {
            throw new MediaProviderError('MEDIA_PROVIDER_OBJECT_TOO_LARGE')
        }
        const response = await fetch(endpoint(this.area, object.key), {
            method: 'PUT',
            headers: {
                AccessKey: this.area.apiKey,
                'Content-Type': object.mimeType,
            },
            // Node's fetch accepts Buffer as a byte body; the DOM type omits
            // Node's Buffer specialization, so keep the runtime-safe cast local.
            body: object.bytes as unknown as BodyInit,
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        }).catch(() => null)
        if (!response?.ok) throw new MediaProviderError('MEDIA_PROVIDER_WRITE_FAILED')
        if (response.body) await response.body.cancel().catch(() => undefined)
    }

    async read(key: string, maxBytes = MAX_MEDIA_BYTES): Promise<ProviderObject> {
        const boundedMaxBytes = Number.isInteger(maxBytes) && maxBytes > 0
            ? Math.min(maxBytes, MAX_MEDIA_BYTES)
            : MAX_MEDIA_BYTES
        const response = await fetch(endpoint(this.area, key), {
            method: 'GET',
            headers: { AccessKey: this.area.apiKey },
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        }).catch(() => null)
        if (response?.status === 404) throw new MediaObjectNotFoundError()
        if (!response?.ok) throw new MediaProviderError('MEDIA_PROVIDER_READ_FAILED')
        const bytes = await readResponseBytes(response, boundedMaxBytes)
        return {
            key,
            bytes,
            sha256: digest(bytes),
            byteSize: bytes.byteLength,
            mimeType: responseMimeType(response, key),
        }
    }

    deliveryUrl(key: string, cdnHostname: string): string {
        if (!key.startsWith('public/')) {
            throw new MediaContractError('MEDIA_PUBLIC_KEY_REQUIRED')
        }
        return `https://${assertPublicDeliveryHostname(cdnHostname)}/${pathSegment(assertGeneratedObjectKey(key))}`
    }
}

export function createBunnyMediaStores(config: BunnyMediaStoreConfig) {
    return {
        originals: new BunnyMediaStore(config.originals),
        delivery: new BunnyMediaStore(config.delivery),
    }
}
