import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
    const p = await prisma.products.findFirst({ where: { sku: 'MS636CDRW12#XW' } });
    console.log('Description length:', p?.description?.length);
    console.log('Description preview:', p?.description?.substring(0, 100));
    await prisma.$disconnect();
})();
