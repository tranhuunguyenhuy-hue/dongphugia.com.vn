import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } });
    const combos = await prisma.products.findMany({
        where: { 
            brand_id: brand.id,
            source_url: null,
            is_active: true
        },
        select: { id: true, sku: true, name: true, is_combo: true },
        take: 15
    });
    console.table(combos);
    await prisma.$disconnect();
}
main();
