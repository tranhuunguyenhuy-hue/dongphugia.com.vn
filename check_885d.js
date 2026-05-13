const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.products.findMany({
    where: {
      sku: { contains: '885D', mode: 'insensitive' }
    },
    select: {
      sku: true,
      name: true,
      description: true,
      specs: true
    },
    take: 3
  });

  console.log(`Found ${products.length} products like 885D`);
  products.forEach(p => {
    console.log("-------------------");
    console.log(`SKU: ${p.sku}`);
    console.log(`DESC LENGTH: ${p.description ? p.description.length : 0}`);
    if (p.description) {
        console.log("DESC PREVIEW:", p.description.slice(0, 100) + '...');
    }
    console.log(`SPECS:`, JSON.stringify(p.specs, null, 2));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
