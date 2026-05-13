const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } });
  if (!brand) {
      console.log('No TOTO brand found');
      return;
  }
  const count = await prisma.products.count({ where: { brand_id: brand.id } });
  console.log('TOTO Brand ID:', brand.id);
  console.log('TOTO Product Count:', count);
}
run().finally(() => prisma.$disconnect());
