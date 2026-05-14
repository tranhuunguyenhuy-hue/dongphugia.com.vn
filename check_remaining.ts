import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.products.count({
    where: { 
      description: {
        contains: 'Thumbnail Youtube'
      }
    }
  });

  const products2 = await prisma.products.count({
    where: { 
      description: {
        contains: 'preview-intro-video'
      }
    }
  });

  console.log(`Số sản phẩm còn chứa Thumbnail Youtube: ${products}`);
  console.log(`Số sản phẩm còn chứa preview-intro-video: ${products2}`);
}

main().finally(() => prisma.$disconnect());
