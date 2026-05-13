const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const keyword = "Nguyên hộp bao gồm";
  const keyword2 = "HF90590U";
  
  // check description, features, specs
  const products = await prisma.products.findMany({
    where: {
      OR: [
        { description: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword2, mode: 'insensitive' } },
        // Check if specs JSON string contains it
      ]
    },
    select: {
      sku: true,
      name: true,
      description: true,
      specs: true
    },
    take: 5
  });

  console.log(`Found ${products.length} products in description.`);
  if (products.length > 0) {
    console.log(products[0].sku, products[0].name);
  }

  // Check specs specifically since it's JSON
  // Prisma raw query for JSON search
  const specsResult = await prisma.$queryRaw`
    SELECT sku, name, specs::text 
    FROM products 
    WHERE specs::text LIKE '%HF90590U%' OR specs::text LIKE '%Nguyên hộp bao gồm%'
    LIMIT 5
  `;
  console.log(`Found ${specsResult.length} products in specs.`);
  if (specsResult.length > 0) {
    console.log(specsResult[0].sku, specsResult[0].name);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
