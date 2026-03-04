import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const gach = await prisma.pattern_types.findMany();
  console.log("Gạch (pattern_types):", JSON.stringify(gach, null, 2));

  const cats = await prisma.product_categories.findMany();
  console.log("Categories:", JSON.stringify(cats, null, 2));

  const collections = await prisma.collections.findMany({ take: 5 });
  console.log("Collections:", JSON.stringify(collections, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect())
