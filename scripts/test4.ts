import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
    const p = await prisma.products.findFirst({ where: { sku: 'MS636CDRW12#XW' } });
    // Print only the anchor tags from description
    const desc = p?.description || '';
    const anchors = [...desc.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)];
    for (const a of anchors) {
        console.log(`href: ${a[1]}\ntext: ${a[2]}\n`);
    }
    await prisma.$disconnect();
})();
