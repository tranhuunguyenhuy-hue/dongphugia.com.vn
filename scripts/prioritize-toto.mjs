import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const toto = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (toto) {
        const res = await prisma.products.updateMany({
            where: { brand_id: toto.id },
            data: { sort_order: 100 }
        })
        console.log(`Updated ${res.count} TOTO products to have sort_order = 100`)
    } else {
        console.log('TOTO brand not found!')
    }
}

main().finally(() => prisma.$disconnect())
