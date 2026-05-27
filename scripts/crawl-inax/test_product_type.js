const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.products.findMany({
    where: { brands: { slug: 'inax' } },
    select: {
      id: true,
      name: true,
      product_type: true,
      product_sub_type: true,
      categories: { select: { name: true } },
      subcategories: { select: { name: true } }
    }
  });

  const report = {};
  let totalWithProductType = 0;
  let totalWithSubType = 0;

  products.forEach(p => {
    if (p.product_type) totalWithProductType++;
    if (p.product_sub_type) totalWithSubType++;

    const key = p.product_type || 'NULL';
    if (!report[key]) report[key] = 0;
    report[key]++;
  });

  console.log('=== THỐNG KÊ PRODUCT_TYPE VÀ PRODUCT_SUB_TYPE ===');
  console.log(`Tổng số sản phẩm INAX: ${products.length}`);
  console.log(`Số sản phẩm có product_type khác null: ${totalWithProductType}`);
  console.log(`Số sản phẩm có product_sub_type khác null: ${totalWithSubType}`);
  console.log('\n--- PHÂN PHỐI THEO PRODUCT_TYPE ---');
  Object.entries(report).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`- ${type}: ${count} sản phẩm`);
  });
}

main().finally(() => prisma.$disconnect());
