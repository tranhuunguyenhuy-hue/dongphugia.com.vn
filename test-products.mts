import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const products = await prisma.products.findMany({
        where: {
            is_active: true,
            is_featured: true,
            categories: { slug: 'thiet-bi-ve-sinh' },
            brands: { slug: 'toto' },
        },
    })
    console.log("Count:", products.length)
}
main()
