import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const p = await prisma.products.findFirst({
    where: { 
      slug: 'bon-cau-toto-cs302de2-2-khoi-nap-rua-co-tcw07s'
    },
    select: { sku: true, description: true }
  })

  if (p && p.description) {
    console.log("SKU:", p.sku);
    const imgRegex = /<img[^>]+>/g;
    let match;
    const imgs = [];
    while ((match = imgRegex.exec(p.description)) !== null) {
      imgs.push(match[0]);
    }
    console.log(`Tìm thấy ${imgs.length} thẻ img:`);
    console.log(imgs.join('\n'));
  } else {
    console.log("Không tìm thấy sản phẩm");
  }
}
main().finally(() => prisma.$disconnect());
