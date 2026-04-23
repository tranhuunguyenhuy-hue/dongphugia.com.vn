import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const totalSub1 = await p.products.count({ where: { subcategory_id: 1, is_active: true } });
  const withSortOrder = await p.products.count({ where: { subcategory_id: 1, is_active: true, sort_order: { gt: 0 } } });
  const featuredCount = await p.products.count({ where: { subcategory_id: 1, is_active: true, is_featured: true } });
  const bestsellerCount = await p.products.count({ where: { subcategory_id: 1, is_active: true, is_bestseller: true } });
  const isNewCount = await p.products.count({ where: { subcategory_id: 1, is_active: true, is_new: true } });
  const noImage = await p.products.count({ where: { subcategory_id: 1, is_active: true, image_main_url: null } });
  const noPrice = await p.products.count({ where: { subcategory_id: 1, is_active: true, price: null } });

  console.log('=== DATA QUALITY SUB=1 BỒNCẦU ===');
  console.log(`Total:             ${totalSub1}`);
  console.log(`sort_order > 0:    ${withSortOrder} (${Math.round(withSortOrder/totalSub1*100)}%)`);
  console.log(`is_featured:       ${featuredCount} (${Math.round(featuredCount/totalSub1*100)}%)`);
  console.log(`is_bestseller:     ${bestsellerCount} (${Math.round(bestsellerCount/totalSub1*100)}%)`);
  console.log(`is_new:            ${isNewCount} (${Math.round(isNewCount/totalSub1*100)}%)`);
  console.log(`NO image_main_url: ${noImage} (${Math.round(noImage/totalSub1*100)}%)`);
  console.log(`NO price:          ${noPrice} (${Math.round(noPrice/totalSub1*100)}%)`);

  // Sample default sort (what user sees first on listing page)
  const defaultSort = await p.products.findMany({
    where: { subcategory_id: 1, is_active: true },
    select: { id: true, name: true, sort_order: true, created_at: true, is_bestseller: true },
    orderBy: { sort_order: 'asc' },
    take: 8
  });
  console.log('\n=== ĐẦU TRANG LISTING (sort_order asc) ===');
  defaultSort.forEach(s =>
    console.log(`  so=${s.sort_order} best=${s.is_bestseller?'Y':'N'} | ${s.name.substring(0,60)}`)
  );

  // What about sort by created_at desc (newest first)?
  const newestSort = await p.products.findMany({
    where: { subcategory_id: 1, is_active: true },
    select: { id: true, name: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log('\n=== MỚI NHẬP (created_at desc) ===');
  newestSort.forEach(s =>
    console.log(`  ${s.created_at?.toISOString().split('T')[0]} | ${s.name.substring(0,60)}`)
  );

  // Check brand distribution
  const brands = await p.products.groupBy({
    by: ['brand_id'],
    where: { subcategory_id: 1, is_active: true },
    _count: true,
    orderBy: { _count: { brand_id: 'desc' } },
    take: 8
  });
  const brandNames = await p.brands.findMany({
    where: { id: { in: brands.map(b => b.brand_id).filter(Boolean) as number[] } },
    select: { id: true, name: true }
  });
  const bMap = Object.fromEntries(brandNames.map(b => [b.id, b.name]));
  console.log('\n=== PHÂN BỔ BRAND SUB=1 ===');
  brands.forEach(b => console.log(`  ${(bMap[b.brand_id!]||'?').padEnd(22)} ${b._count} sp`));

  // Product_type distribution
  const types = await p.products.groupBy({
    by: ['product_type'],
    where: { subcategory_id: 1, is_active: true },
    _count: true,
    orderBy: { _count: { product_type: 'desc' } }
  });
  console.log('\n=== PHÂN BỔ product_type SUB=1 ===');
  types.forEach(t => console.log(`  ${(t.product_type||'NULL').padEnd(25)} ${t._count} sp`));
}
main().catch(console.error).finally(() => p.$disconnect());
