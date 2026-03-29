import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const cats = await prisma.tbvs_categories.findMany();
  console.log('Categories:');
  cats.forEach(c => console.log(`[${c.id}] ${c.name} (${c.slug})`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
