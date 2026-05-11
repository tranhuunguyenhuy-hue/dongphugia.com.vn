import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const brand = await prisma.brands.findFirst({
        where: { name: { contains: 'TOTO' } }
    })
    
    if (!brand) return;

    // Lấy tất cả sản phẩm TOTO và group by subcategory_id
    const products = await prisma.products.findMany({
        where: { brand_id: brand.id },
        select: {
            subcategory_id: true,
            subcategories: {
                select: { name: true, slug: true }
            }
        }
    })

    const counts = {}
    products.forEach(p => {
        if (!p.subcategories) return
        const key = p.subcategories.name + ' (' + p.subcategories.slug + ')'
        counts[key] = (counts[key] || 0) + 1
    })

    console.log('Tổng quan danh mục sản phẩm TOTO:')
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    sorted.forEach(([cat, count]) => {
        console.log(`- ${cat}: ${count} sản phẩm`)
    })
}

main().finally(() => prisma.$disconnect())
