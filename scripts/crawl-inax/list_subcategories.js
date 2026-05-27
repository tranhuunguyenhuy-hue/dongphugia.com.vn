const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subcats = await prisma.subcategories.findMany({
    select: { id: true, name: true, slug: true, category_id: true }
  });
  console.log('=== DANH SÁCH SUBCATEGORIES TRONG HỆ THỐNG ===');
  subcats.forEach(s => {
    console.log(`- [ID: ${s.id}] [Category_ID: ${s.category_id}] ${s.name} (${s.slug})`);
  });
}

main().finally(() => prisma.$disconnect());
