import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const p = await prisma.products.findFirst({
    where: { sku: 'CS302DW18#W' },
    select: { sku: true, description: true }
  })

  if (p) {
    const imgRegex = /<img[^>]+>/g;
    let match;
    while ((match = imgRegex.exec(p.description!)) !== null) {
      console.log(match[0]);
    }
  }
}
main().finally(() => prisma.$disconnect());
