import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // 1. Sub-category distribution in thiet-bi-ve-sinh
  const subCounts = await p.products.groupBy({
    by: ['subcategory_id'],
    where: { is_active: true, categories: { slug: 'thiet-bi-ve-sinh' } },
    _count: true,
    orderBy: { subcategory_id: 'asc' }
  });
  const subs = await p.subcategories.findMany({
    where: { id: { in: subCounts.map(s => s.subcategory_id).filter(Boolean) as number[] } },
    select: { id: true, name: true }
  });
  const subMap = Object.fromEntries(subs.map(s => [s.id, s.name]));
  console.log('=== PHÂN BỔ SUB (thiet-bi-ve-sinh) ===');
  subCounts.forEach(s => {
    const name = (subMap[s.subcategory_id!] || 'N/A').padEnd(32);
    console.log(`  sub=${String(s.subcategory_id).padEnd(4)} ${name} ${s._count} sp`);
  });

  // 2. Name samples from sub=1 (Bồn Cầu)
  const bonCauSamples = await p.products.findMany({
    where: { subcategory_id: 1, is_active: true },
    select: { id: true, name: true, sku: true, product_type: true },
    orderBy: { id: 'asc' },
    take: 10
  });
  console.log('\n=== MẪU TÊN (sub=1 Bồn Cầu) ===');
  bonCauSamples.forEach(s => console.log(`  [${(s.product_type || 'NO_TYPE').padEnd(20)}] ${s.name.substring(0, 70)}`));

  // 3. Naming anomalies
  const hasParenthesis = await p.products.count({ where: { subcategory_id: 1, name: { contains: '(' } } });
  const hasXW = await p.products.count({ where: { subcategory_id: 1, name: { contains: '#XW' } } });
  const noType = await p.products.count({ where: { subcategory_id: 1, product_type: null } });
  console.log('\n=== NAMING ANOMALIES (sub=1) ===');
  console.log(`  Tên vẫn có dấu ():   ${hasParenthesis} sp  (cần review)`);
  console.log(`  Tên vẫn còn #XW:     ${hasXW} sp  (naming chưa sạch nếu > 0)`);
  console.log(`  Không có product_type: ${noType} sp`);

  // 4. Lid linkage
  const lidTypes = await p.products.groupBy({
    by: ['product_sub_type'],
    where: { subcategory_id: 9 },
    _count: true
  });
  console.log('\n=== NẮP BỒN CẦU (sub=9) - Phân loại ===');
  lidTypes.forEach(l => console.log(`  ${(l.product_sub_type || 'NULL').padEnd(20)} ${l._count} sp`));

  // 5. Sample mismatches: bồn cầu names still containing "Nắp" keywords
  const misclassified = await p.products.findMany({
    where: {
      subcategory_id: 1,
      OR: [
        { name: { startsWith: 'Nắp' } },
        { name: { startsWith: 'nắp' } },
        { name: { startsWith: 'Phụ kiện' } },
        { name: { startsWith: 'Bổ sung' } },
      ]
    },
    select: { id: true, name: true },
    take: 10
  });
  console.log(`\n=== SP NGHI VẤN SAI CHỖ trong sub=1 (${misclassified.length} sp) ===`);
  misclassified.forEach(s => console.log(`  ID:${s.id} ${s.name.substring(0, 70)}`));

  // 6. Cross-check: bồn cầu liên kết nắp có hoạt động không (brand match)
  const toyotoBonCau = await p.products.findFirst({
    where: { subcategory_id: 1, brands: { name: { contains: 'TOTO' } } },
    select: { id: true, name: true, brand_id: true }
  });
  if (toyotoBonCau) {
    const matchingLids = await p.products.count({
      where: { subcategory_id: 9, brand_id: toyotoBonCau.brand_id }
    });
    console.log(`\n=== TEST LIÊN KẾT NẮP BỒN CẦU ===`);
    console.log(`  Bồn cầu mẫu: ${toyotoBonCau.name.substring(0, 60)}`);
    console.log(`  → Số nắp TOTO tương thích trong sub=9: ${matchingLids} nắp`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
