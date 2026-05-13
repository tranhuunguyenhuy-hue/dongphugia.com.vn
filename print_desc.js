const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.products.findFirst({
    where: { sku: 'MS885DT8#XW' },
    select: { description: true }
  });

  console.log(product.description);
}

main().catch(console.error).finally(() => prisma.$disconnect());
