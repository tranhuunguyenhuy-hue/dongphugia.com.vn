/**
 * Phase B Research: Hiểu cấu trúc filter_definitions, product_features, và specs của Bồn Cầu
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // 1. filter_definitions cho sub=1 (Bồn Cầu)
  const filterDefs = await p.filter_definitions.findMany({
    where: { subcategory_id: 1 },
    orderBy: { sort_order: 'asc' }
  });
  console.log('=== FILTER DEFINITIONS (sub=1 Bồn Cầu) ===');
  filterDefs.forEach(f => console.log(`  [${f.id}] key="${f.filter_key}" label="${f.filter_label}" type="${f.filter_type}" options=${JSON.stringify(f.options)?.substring(0,80)}`));

  // 2. product_features hiện có
  const features = await p.product_features.findMany({ orderBy: { id: 'asc' } });
  console.log('\n=== PRODUCT FEATURES ===');
  features.forEach(f => console.log(`  [${f.id}] slug="${f.slug}" name="${f.name}"`));

  // 3. Sample specs từ Bồn Cầu products
  const bonCauSamples = await p.products.findMany({
    where: { is_active: true, subcategory_id: 1, NOT: { specs: { equals: {} } } },
    select: { id: true, name: true, sku: true, specs: true },
    take: 10
  });
  console.log('\n=== SAMPLE SPECS (Bồn Cầu sub=1) ===');
  bonCauSamples.forEach(p => {
    const specs = p.specs as any;
    const keys = Object.keys(specs);
    if (keys.length > 0) {
      console.log(`\n  ID:${p.id} ${p.name.substring(0, 50)}`);
      keys.forEach(k => console.log(`    ${k}: ${String(specs[k]).substring(0, 60)}`));
    }
  });

  // 4. Tổng hợp tất cả keys có trong specs của Bồn Cầu
  const allBonCau = await p.products.findMany({
    where: { is_active: true, subcategory_id: 1 },
    select: { specs: true }
  });
  const keyFreq: Record<string, number> = {};
  allBonCau.forEach(p => {
    const specs = p.specs as any;
    if (specs && typeof specs === 'object') {
      Object.keys(specs).forEach(k => { keyFreq[k] = (keyFreq[k] || 0) + 1; });
    }
  });
  const sorted = Object.entries(keyFreq).sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ALL SPECS KEYS IN Bồn Cầu (${allBonCau.length} sp) ===`);
  sorted.forEach(([k, v]) => console.log(`  [${v}/${allBonCau.length}] "${k}"`));

  // 5. Sample values cho các keys phổ biến
  const topKeys = sorted.slice(0,5).map(([k]) => k);
  console.log('\n=== UNIQUE VALUES per TOP KEY ===');
  for (const key of topKeys) {
    const vals = new Set<string>();
    allBonCau.forEach(p => {
      const specs = p.specs as any;
      if (specs?.[key]) vals.add(String(specs[key]));
    });
    console.log(`  "${key}": [${[...vals].slice(0,10).join('", "')}]`);
  }
}
main().catch(console.error).finally(() => p.$disconnect());
