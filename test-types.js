const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const types = await prisma.products.findMany({
    select: { subcategory_id: true, product_type: true, product_sub_type: true },
    distinct: ['subcategory_id', 'product_type', 'product_sub_type'],
  });
  console.log(JSON.stringify(types, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
