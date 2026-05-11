import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const toto = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (!toto) {
        console.log('TOTO brand not found!')
        return
    }

    // Reset all
    await prisma.products.updateMany({
        data: { sort_order: 0 }
    })

    // Set 50 for TOTO
    const res50 = await prisma.products.updateMany({
        where: { brand_id: toto.id },
        data: { sort_order: 50 }
    })

    // Set 100 for TOTO with variant_group
    const res100 = await prisma.products.updateMany({
        where: { 
            brand_id: toto.id,
            variant_group: { not: null }
        },
        data: { sort_order: 100 }
    })

    console.log(`Reset all to 0.`)
    console.log(`Updated ${res50.count} TOTO products to 50.`)
    console.log(`Promoted ${res100.count} TOTO products with variants to 100.`)
}

main().finally(() => prisma.$disconnect())
