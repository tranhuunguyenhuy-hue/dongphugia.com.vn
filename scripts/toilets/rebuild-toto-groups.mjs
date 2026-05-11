import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Hàm lấy tên Dòng sản phẩm (Series) - ví dụ: MS889, CS769
function getSeriesName(fullSku) {
    let sku = fullSku.split('/')[0].split('#')[0].trim()
    const match = sku.match(/^([A-Z]+\d+)/i)
    if (match) {
        return match[1].toUpperCase()
    }
    // Fallback
    return sku.substring(0, 5).toUpperCase()
}

async function main() {
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })

    if (!totoBrand) return

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

    const updates = []
    const csvRows = [
        ['ID', 'SKU', 'Product Name', 'Old Variant Group', 'New Variant Group']
    ]
    
    for (const t of toilets) {
        const series = getSeriesName(t.sku)
        
        // Thêm vào CSV log
        csvRows.push([
            t.id,
            `"${t.sku}"`,
            `"${t.name.replace(/"/g, '""')}"`,
            `"${t.variant_group || ''}"`,
            `"${series}"`
        ])

        // Chuẩn bị update
        if (t.variant_group !== series) {
            updates.push(
                prisma.products.update({
                    where: { id: t.id },
                    data: { variant_group: series }
                })
            )
        }
    }

    console.log(`Đang cấu trúc lại variant_group cho ${updates.length} bồn cầu TOTO...`)

    if (updates.length > 0) {
        const BATCH_SIZE = 100
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE)
            await prisma.$transaction(batch)
        }
        console.log(`Đã gộp thành công ${updates.length} sản phẩm theo Model Series.`)
    } else {
        console.log("Dữ liệu đã được gộp từ trước, không có thay đổi.")
    }

    // Xuất CSV
    const csvContent = csvRows.map(e => e.join(',')).join('\n')
    const csvPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-toilets-merged-groups.csv')
    fs.writeFileSync(csvPath, csvContent, 'utf8')
    console.log(`Đã xuất file đối chiếu CSV tại: ${csvPath}`)
}

main().finally(() => prisma.$disconnect())
