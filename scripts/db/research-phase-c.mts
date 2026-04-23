/**
 * Phase C Research: Sen Tắm + Lavabo data state
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // 1. Danh sách subcategories cần fill product_type
  const subs = await p.subcategories.findMany({
    where: { category_id: 1, is_active: true },
    select: {
      id: true, name: true, slug: true,
      _count: { select: { products: { where: { is_active: true } } } }
    },
    orderBy: { sort_order: 'asc' }
  });
  console.log('=== SUBCATEGORIES (cat=1 TBVS) ===');
  for (const s of subs) {
    const withType = await p.products.count({
      where: { is_active: true, subcategory_id: s.id, product_type: { not: null } }
    });
    const pct = Math.round(withType / s._count.products * 100);
    console.log(`  [sub=${s.id}] ${s.name.padEnd(25)} | ${s._count.products} sp | product_type: ${withType}/${s._count.products} (${pct}%)`);
  }

  // 2. Sample specs keys của Sen Tắm (cần biết để map product_type)
  const senTam = await p.subcategories.findFirst({ where: { slug: 'sen-tam' } });
  const lavabo = await p.subcategories.findFirst({ where: { slug: { contains: 'lavabo' } } });

  if (senTam) {
    const samples = await p.products.findMany({
      where: { is_active: true, subcategory_id: senTam.id, NOT: { specs: { equals: {} } } },
      select: { id: true, name: true, specs: true },
      take: 3
    });
    console.log(`\n=== SAMPLE SPECS Sen Tắm (sub=${senTam.id}) ===`);
    samples.forEach(s => {
      console.log(`\n  ID:${s.id} ${s.name.substring(0, 60)}`);
      const specs = s.specs as any;
      Object.keys(specs).slice(0, 8).forEach(k => console.log(`    ${k}: ${String(specs[k]).substring(0, 50)}`));
    });

    // All spec keys freq
    const all = await p.products.findMany({ where: { is_active: true, subcategory_id: senTam.id }, select: { specs: true } });
    const keyFreq: Record<string, number> = {};
    all.forEach(p => { const sp = p.specs as any; if (sp) Object.keys(sp).forEach(k => { keyFreq[k] = (keyFreq[k] || 0) + 1; }); });
    const sorted = Object.entries(keyFreq).sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`\n=== SPECS KEYS Sen Tắm (${all.length} sp) ===`);
    sorted.forEach(([k, v]) => console.log(`  [${v}/${all.length}] "${k}"`));

    // Sen Tắm name patterns — để map product_type
    const namePatterns = await p.products.findMany({
      where: { is_active: true, subcategory_id: senTam.id },
      select: { name: true },
      take: 20
    });
    console.log('\n=== NAME PATTERNS Sen Tắm (20 samples) ===');
    namePatterns.forEach(p => console.log(`  ${p.name.substring(0, 70)}`));
  }

  if (lavabo) {
    const all = await p.products.findMany({ where: { is_active: true, subcategory_id: lavabo.id }, select: { specs: true } });
    const keyFreq: Record<string, number> = {};
    all.forEach(p => { const sp = p.specs as any; if (sp) Object.keys(sp).forEach(k => { keyFreq[k] = (keyFreq[k] || 0) + 1; }); });
    const sorted = Object.entries(keyFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`\n=== SPECS KEYS Lavabo (sub=${lavabo.id}, ${all.length} sp) ===`);
    sorted.forEach(([k, v]) => console.log(`  [${v}/${all.length}] "${k}"`));
  }

  // 3. Component SKUs đã parse — kiểm tra đủ dữ liệu cho product_relationships
  const withComps = await p.$queryRaw<{cnt: bigint}[]>`
    SELECT COUNT(*) as cnt FROM products WHERE component_skus != '{}' AND is_active = true
  `;
  console.log(`\n=== COMPONENT SKUS filled: ${withComps[0].cnt} sp ===`);

  // 4. Unique product_types đã có
  const types = await p.$queryRaw<{product_type: string, cnt: bigint}[]>`
    SELECT product_type, COUNT(*) as cnt FROM products 
    WHERE product_type IS NOT NULL AND is_active = true 
    GROUP BY product_type ORDER BY cnt DESC
  `;
  console.log('\n=== EXISTING product_type values ===');
  types.forEach(t => console.log(`  ${t.product_type}: ${t.cnt} sp`));
}
main().catch(console.error).finally(() => p.$disconnect());
