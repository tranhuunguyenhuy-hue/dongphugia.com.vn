import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'
import type { MediaProfile } from '../../src/lib/media/media-profiles'

const mediaProfilesModule = await import(
    '../../src/lib/media/media-profiles.ts'
)
const mediaProfiles = (
    'default' in mediaProfilesModule
        ? mediaProfilesModule.default
        : mediaProfilesModule
) as typeof import('../../src/lib/media/media-profiles')
const processImageModule = await import('../../src/lib/media/process-image.ts')
const imageProcessor = (
    'default' in processImageModule
        ? processImageModule.default
        : processImageModule
) as typeof import('../../src/lib/media/process-image')
const {
    MEDIA_PROFILES,
    createMediaFileName,
    getMediaProfileFromUrl,
} = mediaProfiles
const { processImage } = imageProcessor

loadEnv({ path: '.env.local' })
loadEnv()

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const requestedKind = process.argv
    .find((argument) => argument.startsWith('--kind='))
    ?.split('=')[1]
const OUTPUT_DIR = path.resolve('scripts/output/media')
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024

type MediaRecord = {
    kind: 'banner' | 'product' | 'blog-thumbnail'
    id: number
    url: string
    profile: MediaProfile
}

type ManifestItem = MediaRecord & {
    status: 'planned' | 'skipped' | 'updated' | 'failed'
    newUrl?: string
    uploadedPaths?: string[]
    reason?: string
}

function getBunnyConfig() {
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME
    const apiKey = process.env.BUNNY_STORAGE_API_KEY
    if (!storageZone || !apiKey) {
        throw new Error('Thiếu BUNNY_STORAGE_ZONE_NAME hoặc BUNNY_STORAGE_API_KEY')
    }

    return {
        storageZone,
        apiKey,
        storageHost:
            process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com',
        cdnHost:
            process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn',
    }
}

async function collectHomepageMedia(): Promise<MediaRecord[]> {
    const [banners, products, posts] = await Promise.all([
        prisma.banners.findMany({
            where: { is_active: true },
            select: { id: true, image_url: true },
        }),
        prisma.products.findMany({
            where: {
                is_active: true,
                is_home_featured: true,
                image_main_url: { not: null },
            },
            select: { id: true, image_main_url: true },
        }),
        prisma.blog_posts.findMany({
            where: {
                status: 'published',
                thumbnail_url: { not: null },
            },
            orderBy: { created_at: 'desc' },
            take: 4,
            select: { id: true, thumbnail_url: true },
        }),
    ])

    return [
        ...banners.map((item) => ({
            kind: 'banner' as const,
            id: item.id,
            url: item.image_url,
            profile: 'hero' as const,
        })),
        ...products.flatMap((item) =>
            item.image_main_url
                ? [{
                    kind: 'product' as const,
                    id: item.id,
                    url: item.image_main_url,
                    profile: 'product' as const,
                }]
                : [],
        ),
        ...posts.flatMap((item) =>
            item.thumbnail_url
                ? [{
                    kind: 'blog-thumbnail' as const,
                    id: item.id,
                    url: item.thumbnail_url,
                    profile: 'editorial' as const,
                }]
                : [],
        ),
    ]
}

async function uploadVariant(
    filePath: string,
    body: Buffer,
    config: ReturnType<typeof getBunnyConfig>,
) {
    const response = await fetch(
        `https://${config.storageHost}/${config.storageZone}/${filePath}`,
        {
            method: 'PUT',
            headers: {
                AccessKey: config.apiKey,
                'Content-Type': 'image/webp',
            },
            body: new Uint8Array(body),
        },
    )
    if (!response.ok) {
        throw new Error(`Upload ${filePath} thất bại: HTTP ${response.status}`)
    }
}

async function verifyVariant(url: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store',
        })
        if (
            response.ok &&
            response.headers.get('content-type')?.includes('image/webp')
        ) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
    throw new Error(`Không xác minh được ảnh CDN: ${url}`)
}

async function updateRecord(record: MediaRecord, newUrl: string) {
    if (record.kind === 'banner') {
        await prisma.banners.update({
            where: { id: record.id },
            data: { image_url: newUrl },
        })
        return
    }
    if (record.kind === 'product') {
        await prisma.products.update({
            where: { id: record.id },
            data: { image_main_url: newUrl },
        })
        return
    }
    await prisma.blog_posts.update({
        where: { id: record.id },
        data: { thumbnail_url: newUrl },
    })
}

async function optimizeRecord(
    record: MediaRecord,
    config: ReturnType<typeof getBunnyConfig>,
): Promise<ManifestItem> {
    if (getMediaProfileFromUrl(record.url)) {
        return { ...record, status: 'skipped', reason: 'already-optimized' }
    }
    if (!apply) return { ...record, status: 'planned' }

    try {
        const response = await fetch(record.url)
        if (!response.ok) {
            throw new Error(`Không tải được ảnh gốc: HTTP ${response.status}`)
        }
        const declaredBytes = Number(response.headers.get('content-length') || 0)
        if (declaredBytes > MAX_DOWNLOAD_BYTES) {
            throw new Error('Ảnh gốc vượt giới hạn 25MB')
        }
        const source = Buffer.from(await response.arrayBuffer())
        if (source.byteLength > MAX_DOWNLOAD_BYTES) {
            throw new Error('Ảnh gốc vượt giới hạn 25MB')
        }

        const optimized = await processImage(source, record.profile)
        const hash = createHash('sha256').update(record.url).digest('hex').slice(0, 8)
        const id = `home-${record.kind}-${record.id}-${hash}`
        const targetWidths = MEDIA_PROFILES[record.profile].widths
        const uploadedPaths: string[] = []
        let newUrl = ''

        for (let index = 0; index < optimized.variants.length; index += 1) {
            const fileName = createMediaFileName(
                id,
                record.profile,
                targetWidths[index],
            )
            const filePath = `optimized-home/${fileName}`
            await uploadVariant(
                filePath,
                optimized.variants[index].buffer,
                config,
            )
            uploadedPaths.push(filePath)
            newUrl = `https://${config.cdnHost}/${filePath}`
        }

        await Promise.all(
            uploadedPaths.map((filePath) =>
                verifyVariant(`https://${config.cdnHost}/${filePath}`),
            ),
        )
        await updateRecord(record, newUrl)

        return {
            ...record,
            status: 'updated',
            newUrl,
            uploadedPaths,
        }
    } catch (error) {
        return {
            ...record,
            status: 'failed',
            reason: error instanceof Error ? error.message : String(error),
        }
    }
}

async function main() {
    const allRecords = await collectHomepageMedia()
    const records = requestedKind
        ? allRecords.filter((record) => record.kind === requestedKind)
        : allRecords
    const config = getBunnyConfig()
    const items: ManifestItem[] = []

    for (const record of records) {
        const result = await optimizeRecord(record, config)
        items.push(result)
        console.info(
            `[${result.status}] ${record.kind}#${record.id} ${result.reason ?? ''}`,
        )
    }

    await mkdir(OUTPUT_DIR, { recursive: true })
    const timestamp = new Date().toISOString().replaceAll(':', '-')
    const manifestPath = path.join(
        OUTPUT_DIR,
        `homepage-media-${apply ? 'apply' : 'dry-run'}-${timestamp}.json`,
    )
    await writeFile(
        manifestPath,
        JSON.stringify(
            {
                createdAt: new Date().toISOString(),
                mode: apply ? 'apply' : 'dry-run',
                deleteAfter: apply
                    ? new Date(Date.now() + 14 * 86_400_000).toISOString()
                    : null,
                items,
            },
            null,
            2,
        ),
    )
    console.info(`Manifest: ${manifestPath}`)

    if (items.some((item) => item.status === 'failed')) {
        process.exitCode = 1
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
