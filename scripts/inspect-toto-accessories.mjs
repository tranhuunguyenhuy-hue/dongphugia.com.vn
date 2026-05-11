import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. TOTO Brand ID
    const toto = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    console.log('TOTO Brand ID:', toto?.id)

    // 2. Check standalone accessories in Sen tắm or Vòi chậu
    const accessories = await prisma.products.findMany({
        where: {
            is_master: true,
            OR: [
                { name: { contains: 'phụ kiện', mode: 'insensitive' } },
                { name: { contains: 'van', mode: 'insensitive' } },
                { name: { contains: 'ống', mode: 'insensitive' } },
                { name: { contains: 'bộ xả', mode: 'insensitive' } },
            ],
            categories: { slug: { in: ['sen-tam', 'thiet-bi-ve-sinh'] } }
        },
        select: { id: true, sku: true, name: true, category_id: true, subcategory_id: true, product_type: true },
        take: 10
    })

    console.log('Sample accessories on listing pages:')
    console.dir(accessories, { depth: null })
}

main().finally(() => prisma.$disconnect())
