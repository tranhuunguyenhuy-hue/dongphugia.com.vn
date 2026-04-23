import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const types = await p.$queryRaw<{product_type: string, cnt: bigint}[]>`
    SELECT product_type, COUNT(*) as cnt FROM products 
    WHERE product_type IS NOT NULL AND is_active = true 
    GROUP BY product_type ORDER BY cnt DESC LIMIT 25
  `;
  console.log('=== product_type coverage ===');
  types.forEach(t => console.log(`  ${t.product_type}: ${t.cnt}`));

  const rel = await p.$queryRaw<{relationship_type: string, cnt: bigint}[]>`
    SELECT relationship_type, COUNT(*) as cnt FROM product_relationships GROUP BY relationship_type
  `;
  console.log('\n=== product_relationships ===');
  rel.forEach(r => console.log(`  ${r.relationship_type}: ${r.cnt}`));

  // Summary per subcategory
  const subs = await p.$queryRaw<{sub_id: number, sub_name: string, total: bigint, with_type: bigint}[]>`
    SELECT s.id as sub_id, s.name as sub_name,
      COUNT(pr.id) as total,
      COUNT(CASE WHEN pr.product_type IS NOT NULL THEN 1 END) as with_type
    FROM subcategories s
    LEFT JOIN products pr ON pr.subcategory_id = s.id AND pr.is_active = true
    WHERE s.category_id = 1 AND s.is_active = true
    GROUP BY s.id, s.name
    ORDER BY s.sort_order
  `;
  console.log('\n=== product_type per subcategory ===');
  subs.forEach(s => {
    const pct = Number(s.total) > 0 ? Math.round(Number(s.with_type)/Number(s.total)*100) : 0;
    console.log(`  [sub=${s.sub_id}] ${s.sub_name.padEnd(25)} ${s.with_type}/${s.total} (${pct}%)`);
  });
}
main().catch(console.error).finally(() => p.$disconnect());
