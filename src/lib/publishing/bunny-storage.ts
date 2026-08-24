import type { PublishingEnvironment } from './auth'
import { PublishingApiError } from './errors'
import { getCanonicalPublishingCdnHostname } from './media-url'
import type {
    PublishingMediaPurpose,
    PublishingProcessedImage,
} from './media'

type PublishingBunnyConfig = {
    storageZone: string
    apiKey: string
    storageHost: string
    cdnHost: string
}

export type StoredPublishingVariant = {
    url: string
    width: number
    height: number
    bytes: number
    format: 'webp'
}

function requiredValue(name: string): string {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new PublishingApiError(
            503,
            'MEDIA_STORAGE_NOT_CONFIGURED',
            'Managed Media storage is unavailable',
            [{ field: name, code: 'CONFIG_REQUIRED' }],
            60,
        )
    }
    return value
}

function exactHostname(name: string): string {
    const value = requiredValue(name).toLowerCase()
    if (!/^[a-z0-9.-]+$/.test(value)) {
        throw new PublishingApiError(
            503,
            'MEDIA_STORAGE_NOT_CONFIGURED',
            'Managed Media storage is unavailable',
            [{ field: name, code: 'CONFIG_INVALID' }],
            60,
        )
    }
    return value
}

function getConfig(environment: PublishingEnvironment): PublishingBunnyConfig {
    if (requiredValue('PUBLISHING_BUNNY_STORAGE_ENVIRONMENT') !== environment) {
        throw new PublishingApiError(
            503,
            'MEDIA_STORAGE_ENVIRONMENT_MISMATCH',
            'Managed Media storage does not match the Publishing environment',
            undefined,
            60,
        )
    }
    return {
        storageZone: requiredValue('PUBLISHING_BUNNY_STORAGE_ZONE_NAME'),
        apiKey: requiredValue('PUBLISHING_BUNNY_STORAGE_API_KEY'),
        storageHost: exactHostname('PUBLISHING_BUNNY_STORAGE_HOSTNAME'),
        cdnHost: getCanonicalPublishingCdnHostname(
            exactHostname('PUBLISHING_BUNNY_CDN_HOSTNAME'),
        ),
    }
}

async function deleteObject(config: PublishingBunnyConfig, path: string) {
    await fetch(
        `https://${config.storageHost}/${config.storageZone}/${path}`,
        {
            method: 'DELETE',
            headers: { AccessKey: config.apiKey },
            signal: AbortSignal.timeout(10_000),
        },
    ).catch(() => undefined)
}

export async function storePublishingImage(
    input: {
        environment: PublishingEnvironment
        identityId: string
        assetId: string
        purpose: PublishingMediaPurpose
        processed: PublishingProcessedImage
    },
): Promise<{
    storagePath: string
    primaryUrl: string
    variants: StoredPublishingVariant[]
}> {
    const config = getConfig(input.environment)
    const storagePath =
        `publishing/${input.identityId}/${input.assetId}`
    const uploadedPaths: string[] = []

    try {
        const variants: StoredPublishingVariant[] = []
        for (const variant of input.processed.variants) {
            const filePath =
                `${storagePath}/${input.purpose}.w${variant.targetWidth}.webp`
            const response = await fetch(
                `https://${config.storageHost}/${config.storageZone}/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        AccessKey: config.apiKey,
                        'Content-Type': 'image/webp',
                    },
                    body: new Uint8Array(variant.buffer),
                    signal: AbortSignal.timeout(10_000),
                },
            )
            if (!response.ok) {
                await response.body?.cancel()
                throw new Error('storage upload failed')
            }
            await response.body?.cancel()
            uploadedPaths.push(filePath)
            variants.push({
                url: `https://${config.cdnHost}/${filePath}`,
                width: variant.width,
                height: variant.height,
                bytes: variant.bytes,
                format: 'webp',
            })
        }

        const primary = variants.at(-1)
        if (!primary) throw new Error('storage produced no variants')
        return { storagePath, primaryUrl: primary.url, variants }
    } catch {
        await Promise.all(
            uploadedPaths.map((path) => deleteObject(config, path)),
        )
        throw new PublishingApiError(
            502,
            'MEDIA_STORAGE_FAILED',
            'Managed Media storage failed',
            undefined,
            5,
        )
    }
}
