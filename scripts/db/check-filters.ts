import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- SIZES ---");
    const sizes = await prisma.sizes.findMany({ select: { name: true, slug: true, label: true } });
    console.log(sizes);

    console.log("\n--- COLORS ---");
    const colors = await prisma.colors.findMany({ select: { name: true, slug: true } });
    console.log(colors);

    console.log("\n--- TBVS SUBTYPES ---");
    const subtypes = await prisma.tbvs_subtypes.findMany({ 
        include: { _count: { select: { tbvs_products: true } } } 
    });
    console.log(subtypes.filter(s => s._count.tbvs_products === 0).map(s => s.name));
    
    console.log("\n--- TBVS BRANDS ---");
    const brands = await prisma.tbvs_brands.findMany({ 
        include: { _count: { select: { tbvs_products: true } } } 
    });
    console.log(brands.filter(b => b._count.tbvs_products === 0).map(b => b.name));

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
