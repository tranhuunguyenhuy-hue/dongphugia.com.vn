import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const prisma = new PrismaClient()
const manifestPath = process.argv.find((argument) => argument.endsWith('.json'))
const apply = process.argv.includes('--apply')
const force = process.argv.includes('--force')

type Manifest = {
    deleteAfter: string | null
    items: Array<{
        kind: string
        id: number
        url: string
        newUrl?: string
        status: string
    }>
}

function getBunnyConfig() {
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME
    const apiKey = process.env.BUNNY_STORAGE_API_KEY
    if (!storageZone || !apiKey) throw new Error('Thiếu cấu hình Bunny Storage')

    return {
        storageZone,
        apiKey,
        storageHost:
            process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com',
        cdnHost:
            process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn',
    }
}

async function countReferences(url: string) {
    const counts = await Promise.all([
        prisma.banners.count({ where: { image_url: url } }),
        prisma.products.count({ where: { image_main_url: url } }),
        prisma.product_images.count({ where: { image_url: url } }),
        prisma.blog_posts.count({
            where: { OR: [{ thumbnail_url: url }, { cover_image_url: url }] },
        }),
        prisma.categories.count({
            where: { OR: [{ thumbnail_url: url }, { banner_url: url }] },
        }),
        prisma.subcategories.count({
            where: {
                OR: [{ thumbnail_url: url }, { hero_image_url: url }],
            },
        }),
        prisma.projects.count({ where: { thumbnail_url: url } }),
        prisma.partners.count({ where: { logo_url: url } }),
    ])
    return counts.reduce((total, count) => total + count, 0)
}

async function main() {
    if (!manifestPath) throw new Error('Cần truyền đường dẫn manifest JSON')
    const manifest = JSON.parse(
        await readFile(manifestPath, 'utf8'),
    ) as Manifest
    if (
        !force &&
        manifest.deleteAfter &&
        Date.now() < new Date(manifest.deleteAfter).getTime()
    ) {
        throw new Error(
            `Chưa đến thời điểm cleanup ${manifest.deleteAfter}; dùng --force chỉ khi PM đã nghiệm thu`,
        )
    }

    const config = getBunnyConfig()
    const candidates = manifest.items.filter(
        (item) => item.status === 'updated' && item.newUrl,
    )
    console.info(`Kiểm tra ${candidates.length} ảnh gốc`)

    for (const item of candidates) {
        const oldUrl = new URL(item.url)
        if (oldUrl.hostname !== config.cdnHost) {
            console.info(`[skip external] ${item.url}`)
            continue
        }
        const references = await countReferences(item.url)
        if (references > 0) {
            console.info(`[skip referenced:${references}] ${item.url}`)
            continue
        }

        const newResponse = await fetch(item.newUrl!, {
            method: 'HEAD',
            cache: 'no-store',
        })
        if (!newResponse.ok) {
            console.info(`[skip replacement-unavailable] ${item.url}`)
            continue
        }
        console.info(`[ready] ${item.url}`)
        if (!apply) continue

        const filePath = oldUrl.pathname.replace(/^\/+/, '')
        const response = await fetch(
            `https://${config.storageHost}/${config.storageZone}/${filePath}`,
            {
                method: 'DELETE',
                headers: { AccessKey: config.apiKey },
            },
        )
        if (!response.ok) {
            throw new Error(`Xóa thất bại HTTP ${response.status}: ${item.url}`)
        }
        console.info(`[deleted] ${item.url}`)
    }

    if (!apply) console.info('Dry-run: thêm --apply để xóa các ảnh [ready]')
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
