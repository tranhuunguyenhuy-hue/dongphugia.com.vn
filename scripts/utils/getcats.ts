import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const cats = await prisma.product_categories.findMany({ 
    orderBy: { sort_order: 'asc' } 
  });
  console.log(JSON.stringify(cats, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect())
