/**
 * Audit product_type coverage across ALL categories
 * Kiểm tra toàn bộ danh mục xem có product_type không
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Get all categories with their subcategories and product_type coverage
  const categories = await p.categories.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      subcategories: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: { where: { is_active: true } } } }
        },
        orderBy: { id: 'asc' }
      }
    },
    orderBy: { id: 'asc' }
  });

  for (const cat of categories) {
    const totalInCat = cat.subcategories.reduce((sum, sub) => sum + sub._count.products, 0);
    if (totalInCat === 0) continue;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📁 [${cat.slug}] ${cat.name} — ${totalInCat} sp tổng`);
    console.log('─'.repeat(60));

    for (const sub of cat.subcategories) {
      if (sub._count.products === 0) continue;

      // Count products with/without product_type in this sub
      const withType = await p.products.count({
        where: {
          subcategory_id: sub.id,
          is_active: true,
          product_type: { not: null }
        }
      });
      const total = sub._count.products;
      const pct = total > 0 ? Math.round((withType / total) * 100) : 0;
      const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

      const status = pct === 0 ? '❌' : pct < 50 ? '⚠️ ' : pct < 100 ? '🔶' : '✅';
      console.log(`  ${status} sub=${sub.id.toString().padEnd(3)} [${bar}] ${pct.toString().padStart(3)}% — ${sub.name.padEnd(28)} ${withType}/${total} sp có product_type`);
    }
  }

  // Summary table
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 TỔNG HỢP TOÀN HỆ THỐNG`);
  console.log('─'.repeat(60));

  const totalProducts = await p.products.count({ where: { is_active: true } });
  const withType = await p.products.count({ where: { is_active: true, product_type: { not: null } } });
  const nullType = await p.products.count({ where: { is_active: true, product_type: null } });

  console.log(`  Tổng active products: ${totalProducts}`);
  console.log(`  Có product_type:      ${withType} (${Math.round(withType/totalProducts*100)}%)`);
  console.log(`  Không có (NULL):      ${nullType} (${Math.round(nullType/totalProducts*100)}%)`);

  // Top subcategories với nhiều NULL nhất
  const subNulls = await p.products.groupBy({
    by: ['subcategory_id'],
    where: { is_active: true, product_type: null, subcategory_id: { not: null } },
    _count: true,
    orderBy: { _count: { subcategory_id: 'desc' } },
    take: 10
  });
  const subNames = await p.subcategories.findMany({
    where: { id: { in: subNulls.map(s => s.subcategory_id!).filter(Boolean) } },
    select: { id: true, name: true }
  });
  const nameMap = Object.fromEntries(subNames.map(s => [s.id, s.name]));

  console.log(`\n🔴 Top sub có nhiều NULL product_type nhất:`);
  subNulls.forEach(s =>
    console.log(`   sub=${s.subcategory_id?.toString().padEnd(4)} ${(nameMap[s.subcategory_id!] || '?').padEnd(30)} ${s._count} sp NULL`)
  );

  await p.$disconnect();
}
main().catch(console.error);
