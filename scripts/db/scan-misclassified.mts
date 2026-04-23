import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Find all suspicious products in sub=1
  const issues = await p.products.findMany({
    where: {
      subcategory_id: 1,
      OR: [
        { name: { startsWith: 'Nắp' } },
        { name: { startsWith: 'Núm' } },
        { name: { startsWith: 'Van' } },
        { name: { startsWith: 'Kết nước' } },
        { name: { contains: '#XW' } },
      ]
    },
    select: { id: true, name: true, sku: true }
  });
  console.log(`SP nghi vấn sai sub=1 (${issues.length}):`);
  issues.forEach(s => console.log(`  ID:${s.id} | ${s.name.substring(0, 70)}`));

  // What does the category page query look like?
  const total = await p.products.count({ where: { subcategory_id: 1, is_active: true } });
  const byType = await p.products.groupBy({
    by: ['product_type'],
    where: { subcategory_id: 1, is_active: true },
    _count: true,
    orderBy: { _count: { product_type: 'desc' } }
  });
  console.log(`\nTổng sub=1: ${total} sp\nPhân loại product_type:`);
  byType.forEach(r => console.log(`  ${(r.product_type || 'NULL').padEnd(25)} ${r._count} sp`));

  await p.$disconnect();
}
main().catch(console.error);
