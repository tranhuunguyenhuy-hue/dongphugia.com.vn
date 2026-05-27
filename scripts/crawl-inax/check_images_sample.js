const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.products.findFirst({
        where: { brands: { slug: 'inax' } },
        select: { image_main_url: true }
    });
    console.log("Main image sample:", p?.image_main_url);

    const g = await prisma.product_images.findFirst({
        where: { products: { brands: { slug: 'inax' } } },
        select: { image_url: true }
    });
    console.log("Gallery image sample:", g?.image_url);
}

main().finally(() => prisma.$disconnect());
