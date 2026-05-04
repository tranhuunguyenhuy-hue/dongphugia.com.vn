const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const relationships = await prisma.product_relationships.findMany({
    where: { relationship_type: 'component', child_id: null },
    include: { parent: { select: { sku: true, name: true } } }
  });

  const skus = [...new Set(relationships.map(r => r.child_sku).filter(Boolean))];
  console.log(`Unique child SKUs with NULL child_id: ${skus.length}`);

  const existingProducts = await prisma.products.findMany({
    where: { sku: { in: skus } },
    select: { sku: true, id: true }
  });

  const existingSkus = new Set(existingProducts.map(p => p.sku));
  const missingSkus = skus.filter(sku => !existingSkus.has(sku));

  console.log(`Of these SKUs, ${missingSkus.length} DO NOT exist in the products table.`);
  
  if (missingSkus.length > 0) {
    console.log(`Top 10 missing SKUs (No separate page/product exists):`, missingSkus.slice(0, 10));
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
