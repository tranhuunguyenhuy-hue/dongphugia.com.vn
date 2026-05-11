import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const totoBrand = await prisma.brands.findFirst({
        where: { slug: 'toto' }
    })
    
    if (totoBrand) {
        const unmapped = await prisma.products.findMany({
            where: { brand_id: totoBrand.id, color_id: null },
            select: { sku: true, name: true },
            take: 20
        })
        console.log("20 Sản phẩm TOTO chưa map màu:")
        console.table(unmapped)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
