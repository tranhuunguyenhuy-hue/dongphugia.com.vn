import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const p = await prisma.products.findFirst({
    where: { sku: { contains: 'TCW1211A' } },
    select: { sku: true, description: true }
  })
  if (p) {
    console.log(p.sku)
    console.log(p.description?.substring(0, 1000))
  } else {
    console.log("Not found")
  }
}
main()
