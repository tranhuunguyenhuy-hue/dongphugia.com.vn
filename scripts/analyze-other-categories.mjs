import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const brand = await prisma.brands.findFirst({
        where: { name: { contains: 'TOTO' } }
    })
    
    if (!brand) return;

    const dumpCategory = async (slug) => {
        console.log(`\n--- Phân tích danh mục: ${slug} ---`)
        const products = await prisma.products.findMany({
            where: {
                brand_id: brand.id,
                subcategories: { slug: slug }
            },
            select: { sku: true, name: true, variant_group: true }
        })
        
        const grouped = products.filter(p => p.variant_group && p.variant_group !== p.sku)
        console.log(`Tổng: ${products.length} sản phẩm. Đã group: ${grouped.length} sản phẩm.`)
        
        console.log(`Sample 5 products:`)
        products.slice(0, 5).forEach(p => console.log(` - ${p.sku} | ${p.name} | Group: ${p.variant_group}`))
    }

    await dumpCategory('voi-chau')
    await dumpCategory('lavabo')
    await dumpCategory('bon-tam')
    await dumpCategory('bon-tieu')
}

main().finally(() => prisma.$disconnect())
