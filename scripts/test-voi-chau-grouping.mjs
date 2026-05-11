import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const brand = await prisma.brands.findFirst({
        where: { name: { contains: 'TOTO' } }
    })
    
    if (!brand) return;

    const products = await prisma.products.findMany({
        where: {
            brand_id: brand.id,
            subcategories: { slug: 'voi-chau' }
        },
        select: { sku: true, name: true }
    })
    
    const groups = {}

    products.forEach(item => {
        // Lấy phần đầu tiên của SKU trước dấu /
        let base = item.sku.split('/')[0].split('#')[0]
        if (!groups[base]) {
            groups[base] = []
        }
        groups[base].push({ sku: item.sku, name: item.name })
    })

    let countMulti = 0
    let totalInMulti = 0

    console.log(`Phân tích Vòi Chậu TOTO theo Vòi (Spout):`)
    for (const [base, items] of Object.entries(groups)) {
        if (items.length > 1) {
            console.log(`\n[Nhóm: ${base}] - ${items.length} sản phẩm`)
            items.forEach(i => console.log(`  - ${i.sku} | ${i.name}`))
            countMulti++
            totalInMulti += items.length
        }
    }

    console.log(`\n=> Tổng số nhóm có nhiều tuỳ chọn: ${countMulti}`)
    console.log(`=> Tổng số sản phẩm nằm trong các nhóm này: ${totalInMulti}`)
}

main().finally(() => prisma.$disconnect())
