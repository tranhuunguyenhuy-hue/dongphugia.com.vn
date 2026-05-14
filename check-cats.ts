import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const cats = await prisma.categories.findMany({ select: { slug: true } })
  console.log(cats)
}
main()
