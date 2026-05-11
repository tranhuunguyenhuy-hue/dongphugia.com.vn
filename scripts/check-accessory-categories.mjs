import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const subcats = await prisma.subcategories.findMany({
        where: { name: { contains: 'phụ kiện', mode: 'insensitive' } },
        select: { id: true, name: true, slug: true, category_id: true }
    })
    console.log('Subcategories:', subcats)

    const productTypes = await prisma.products.findMany({
        where: { product_type: { contains: 'phu-kien', mode: 'insensitive' } },
        distinct: ['product_type'],
        select: { product_type: true }
    })
    console.log('Product Types:', productTypes)
}

main().finally(() => prisma.$disconnect())
