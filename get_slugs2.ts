import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cats = await prisma.subcategories.findMany();
  console.log(cats.filter(c => c.category_id === 2 || c.category_id === 8).map(c => `SLUG="${c.slug}" NAME="${c.name}"`).join('\n'));
}
main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
