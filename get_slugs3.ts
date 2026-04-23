import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cats = await prisma.subcategories.findMany();
  console.log('--- ALL ---');
  console.log(cats.map(c => `[ID=${c.category_id}] SLUG="${c.slug}" NAME="${c.name}"`).join('\n'));
}
main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
