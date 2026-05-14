import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.products.findMany({
    where: { 
      description: {
        contains: 'width="654"'
      }
    },
    select: { sku: true, description: true }
  })

  console.log(`Tìm thấy ${products.length} sản phẩm chứa width="654"`);
  
  if (products.length > 0) {
    for (let i = 0; i < Math.min(5, products.length); i++) {
      const p = products[i];
      console.log(`\nSKU: ${p.sku}`);
      const imgRegex = /<img([^>]+)>/g;
      let match;
      while ((match = imgRegex.exec(p.description!)) !== null) {
        if (match[1].includes('654')) {
          console.log(`  IMG: ${match[1].trim()}`);
        }
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
