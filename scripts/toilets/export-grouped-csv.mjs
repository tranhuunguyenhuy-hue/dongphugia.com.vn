import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

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
        },
        orderBy: [
            { variant_group: 'asc' },
            { sku: 'asc' }
        ]
    })

    const csvRows = [
        ['Variant Group', 'ID', 'SKU', 'Product Name']
    ]
    
    let currentGroup = null;

    for (const t of toilets) {
        // Chèn 1 dòng trống nếu chuyển sang nhóm mới (trừ lần đầu tiên)
        if (currentGroup !== null && currentGroup !== t.variant_group) {
            csvRows.push(['', '', '', '']) // Dòng trống ngăn cách
        }
        currentGroup = t.variant_group

        csvRows.push([
            `"${t.variant_group || ''}"`,
            t.id,
            `"${t.sku}"`,
            `"${t.name.replace(/"/g, '""')}"`
        ])
    }

    // Xuất CSV
    const csvContent = csvRows.map(e => e.join(',')).join('\n')
    const csvPath = path.join(process.cwd(), 'scripts', 'toilets', 'toto-toilets-merged-groups-sorted.csv')
    fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8') // Thêm BOM để Excel đọc tiếng Việt không bị lỗi font
    console.log(`Đã xuất file đối chiếu CSV tại: ${csvPath}`)
}

main().finally(() => prisma.$disconnect())
