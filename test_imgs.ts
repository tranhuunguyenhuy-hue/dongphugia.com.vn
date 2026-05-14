import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const p = await prisma.products.findFirst({
    where: { sku: { contains: 'CS302DW18' } },
    select: { sku: true, description: true }
  })
  if (p && p.description) {
    const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/g;
    let match;
    const images = [];
    while ((match = imgRegex.exec(p.description)) !== null) {
      images.push({
        fullTag: match[0],
        src: match[1]
      });
    }
    console.log("SKU:", p.sku);
    console.log(JSON.stringify(images, null, 2));
  } else {
    console.log("Not found")
  }
}
main()
