import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })

    if (!totoBrand) {
        console.log("Không tìm thấy TOTO")
        return
    }

    const toilets = await prisma.products.findMany({
        where: {
            brand_id: totoBrand.id,
            subcategory_id: 1 // Bồn Cầu
        },
        select: {
            id: true,
            sku: true,
            name: true,
            variant_group: true
        }
    })

    console.log(`Đã tìm thấy ${toilets.length} bồn cầu TOTO.`)

    // Ghi toàn bộ ra file log để dễ phân tích
    const logPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-toilets-log.json')
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.writeFileSync(logPath, JSON.stringify(toilets, null, 2))
    
    // In ra màn hình khoảng 30 mẫu để xem cấu trúc SKU và Name
    console.log("\n--- Sample 30 sản phẩm ---")
    const sample = toilets.slice(0, 30).map(t => ({sku: t.sku, name: t.name, group: t.variant_group}))
    console.table(sample)

    // Thực hiện thao tác Ungroup (Gỡ bỏ variant_group)
    const updates = []
    for (const t of toilets) {
        if (t.variant_group !== null) {
            updates.push(prisma.products.update({
                where: { id: t.id },
                data: { variant_group: null }
            }))
        }
    }

    console.log(`\nĐang tiến hành Ungroup (xóa variant_group) cho ${updates.length} sản phẩm...`)
    
    if (updates.length > 0) {
        // Thực thi transaction chia lô (batching) nếu số lượng lớn
        const BATCH_SIZE = 100
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE)
            await prisma.$transaction(batch)
        }
        console.log(`Ungroup thành công ${updates.length} bồn cầu TOTO!`)
    } else {
        console.log("Không có sản phẩm nào cần Ungroup.")
    }
}

main().finally(() => prisma.$disconnect())
