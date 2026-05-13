const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.products.findFirst({
    where: { sku: 'MS885DT8#XW' },
  });

  const rels = await prisma.product_relationships.findMany({
    where: { parent_id: p.id },
    include: { child: { select: { sku: true, name: true } } }
  });

  console.log(`Components for MS885DT8#XW:`);
  console.log(JSON.stringify(rels, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
