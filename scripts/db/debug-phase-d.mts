import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Verify subcategory slugs vs IDs
  const subs = await p.subcategories.findMany({ where: { category_id: 1, is_active: true }, select: { id: true, slug: true, name: true } });
  console.log('=== Subcategory slugs ===');
  subs.forEach(s => console.log(`  id=${s.id} slug="${s.slug}" name="${s.name}"`));

  // Check filter_definitions for sub 2 and 3
  const defs = await p.filter_definitions.findMany({ where: { subcategory_id: { in: [2, 3] }, is_active: true }, select: { subcategory_id: true, filter_key: true, filter_label: true, options: true } });
  console.log('\n=== filter_definitions for sub 2,3 ===');
  defs.forEach(d => {
    const opts = d.options as any;
    console.log(`  [sub=${d.subcategory_id}] "${d.filter_key}" → source=${opts?.source}, ${opts?.values?.length} values`);
  });

  // Check product_relationships for INAX combos (parent = INAX combo product)
  const rels = await p.product_relationships.findMany({ take: 5, include: { parent: { select: { id: true, name: true } } } });
  console.log('\n=== product_relationships sample ===');
  rels.forEach(r => console.log(`  parent=${r.parent_id} (${r.parent.name.substring(0, 40)}) → child_sku=${r.child_sku} child_id=${r.child_id || 'NULL'}`));

  const total = await p.product_relationships.count();
  console.log(`\n📊 Total product_relationships: ${total}`);
}
main().catch(console.error).finally(() => p.$disconnect());
