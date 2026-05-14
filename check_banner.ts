import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const p = await prisma.products.findFirst({
    where: { 
      description: {
        contains: 'TCF23710AAA'
      }
    },
    select: { sku: true, description: true }
  })

  if (p) {
    console.log("SKU:", p.sku);
    // Lấy thẻ img nào chứa TCF23710AAA hoặc in toàn bộ img tags ra
    const imgRegex = /<img[^>]+>/g;
    let match;
    while ((match = imgRegex.exec(p.description!)) !== null) {
      if (match[0].includes('cdn.dongphugia.com.vn')) {
        console.log(match[0]);
      }
    }
  } else {
    console.log("Không tìm thấy sản phẩm nào chứa text TCF23710AAA");
  }
}
main().finally(() => prisma.$disconnect());
