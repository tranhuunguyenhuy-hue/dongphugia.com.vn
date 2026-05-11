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
        select: { id: true, sku: true, variant_group: true }
    })

    console.log(`Bắt đầu cập nhật variant_group cho ${products.length} Vòi chậu TOTO...`)

    let updatedCount = 0

    for (const item of products) {
        let base = item.sku.split('/')[0].split('#')[0]
        
        if (item.variant_group !== base) {
            await prisma.products.update({
                where: { id: item.id },
                data: { variant_group: base }
            })
            updatedCount++
            console.log(`[UPDATE] ${item.sku} -> Group: ${base}`)
        }
    }

    console.log(`Đã cập nhật xong ${updatedCount} Vòi chậu!`)
}

main().finally(() => prisma.$disconnect())
