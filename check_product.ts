import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const p = await prisma.products.findFirst()
  console.log("First product ID:", p?.id);
}
main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
