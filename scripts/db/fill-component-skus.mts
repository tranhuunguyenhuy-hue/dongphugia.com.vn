/**
 * C2c: Fill component_skus array từ SKU parse (column vừa được thêm Phase A)
 * 
 * Pattern: SKU chứa dấu '+' → split thành array component_skus
 * VD: sku = "AC-959A+CW-S15VN/BW1" → component_skus = ['AC-959A', 'CW-S15VN/BW1']
 */
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  console.log('✅ Connected\n');

  // Update trực tiếp bằng SQL — hiệu quả nhất
  const result = await pool.query(`
    UPDATE products
    SET component_skus = string_to_array(sku, '+')
    WHERE sku LIKE '%+%'
      AND is_active = true
      AND (component_skus IS NULL OR component_skus = '{}')
    RETURNING id
  `);
  console.log(`✅ Filled component_skus for ${result.rowCount} combo products`);

  // Verify
  const check = await pool.query(`
    SELECT COUNT(*) as cnt FROM products WHERE component_skus != '{}' AND is_active = true
  `);
  console.log(`📊 Total products with component_skus: ${check.rows[0].cnt}`);

  // Sample
  const samples = await pool.query(`
    SELECT id, sku, component_skus FROM products
    WHERE component_skus != '{}'
    ORDER BY id LIMIT 5
  `);
  console.log('\n📝 Sample:');
  samples.rows.forEach((r: any) => console.log(`  [${r.id}] sku="${r.sku}" → components=${JSON.stringify(r.component_skus)}`));

  await pool.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
