import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.products.findMany({
    where: { sku: { in: ['CS986GW18#XW', 'CS326DE4#XW', 'CS302DE2#W'] } },
    select: { sku: true, description: true }
  })

  for (const p of products) {
    console.log(`\nSKU: ${p.sku}`);
    if (p.description) {
      const imgRegex = /<img([^>]+)>/g;
      let match;
      while ((match = imgRegex.exec(p.description)) !== null) {
        const attributes = match[1];
        console.log(`  IMG: ${attributes.trim()}`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
