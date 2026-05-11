import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const subs = await prisma.subcategories.findMany({
        where: { categories: { slug: 'thiet-bi-bep' } },
        select: { name: true, slug: true }
    })
    console.log('Bếp Subcats:', subs)
}

main().finally(() => prisma.$disconnect())
