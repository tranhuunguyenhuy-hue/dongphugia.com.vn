const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nullProducts = await prisma.products.findMany({
    where: {
      brands: { slug: 'inax' },
      product_type: null
    },
    take: 20,
    select: {
      id: true,
      name: true,
      subcategory_id: true,
      subcategories: { select: { name: true, slug: true } },
      source_url: true
    }
  });

  console.log('=== PHÂN TÍCH 20 SẢN PHẨM INAX CÓ PRODUCT_TYPE = NULL ===');
  nullProducts.forEach((p, i) => {
    console.log(`${i+1}. [ID: ${p.id}] ${p.name}`);
    console.log(`   - Subcategory_id: ${p.subcategory_id}`);
    console.log(`   - Subcategory: ${p.subcategories?.name || 'NULL'} (${p.subcategories?.slug || 'NULL'})`);
    console.log(`   - Source URL: ${p.source_url}`);
  });
}

main().finally(() => prisma.$disconnect());
