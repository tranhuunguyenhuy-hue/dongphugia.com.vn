import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })

    if (!totoBrand) return

    // Lấy Nắp Bồn Cầu
    const lids = await prisma.products.findMany({
        where: {
            brand_id: totoBrand.id,
            subcategory_id: 9 // Nắp Bồn Cầu
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    console.log(`Đã tìm thấy ${lids.length} nắp bồn cầu TOTO.`)

    // Ghi log
    const logPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-lids-log.json')
    fs.writeFileSync(logPath, JSON.stringify(lids, null, 2))
    
    // In ra màn hình khoảng 30 mẫu để phân tích
    console.log("\n--- Sample 30 sản phẩm Nắp Bồn Cầu ---")
    const sample = lids.slice(0, 30).map(t => ({sku: t.sku, name: t.name, group: t.variant_group}))
    console.table(sample)

}

main().finally(() => prisma.$disconnect())
