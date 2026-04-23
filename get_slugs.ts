import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cats = await prisma.subcategories.findMany();
  console.log(cats.map(c => `${c.slug} : ${c.name}`).join('\n'));
}
main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
