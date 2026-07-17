import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const prisma = new PrismaClient()
const manifestPath = process.argv.find((argument) => argument.endsWith('.json'))
const apply = process.argv.includes('--apply')

type ManifestItem = {
    kind: 'banner' | 'product' | 'blog-thumbnail'
    id: number
    url: string
    newUrl?: string
    status: string
}

async function restore(item: ManifestItem) {
    if (!item.newUrl || item.status !== 'updated') return

    if (item.kind === 'banner') {
        await prisma.banners.updateMany({
            where: { id: item.id, image_url: item.newUrl },
            data: { image_url: item.url },
        })
        return
    }
    if (item.kind === 'product') {
        await prisma.products.updateMany({
            where: { id: item.id, image_main_url: item.newUrl },
            data: { image_main_url: item.url },
        })
        return
    }
    await prisma.blog_posts.updateMany({
        where: { id: item.id, thumbnail_url: item.newUrl },
        data: { thumbnail_url: item.url },
    })
}

async function main() {
    if (!manifestPath) {
        throw new Error('Cần truyền đường dẫn manifest JSON')
    }
    const manifest = JSON.parse(
        await readFile(manifestPath, 'utf8'),
    ) as { items: ManifestItem[] }
    const changed = manifest.items.filter(
        (item) => item.status === 'updated' && item.newUrl,
    )

    console.info(`Sẽ khôi phục ${changed.length} bản ghi`)
    if (!apply) {
        console.info('Dry-run: thêm --apply để thực hiện rollback')
        return
    }

    for (const item of changed) {
        await restore(item)
        console.info(`[restored] ${item.kind}#${item.id}`)
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
