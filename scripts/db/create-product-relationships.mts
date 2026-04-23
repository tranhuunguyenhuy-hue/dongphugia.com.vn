/**
 * C2: Tạo bảng product_relationships và fill data từ component_skus
 * Quan hệ: parent (combo product) → child (component products)
 * 
 * Relationship types:
 * - 'component'  : linh kiện trong bộ (bowl + lid + frame + button)
 * - 'compatible' : sản phẩm tương thích (có thể thay nắp khác cho cùng thân)
 * - 'variant'    : biến thể cùng model nhưng khác màu/size
 */
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  await client.query(`SET statement_timeout = '120000'`);
  console.log('✅ Connected\n');

  // C2a: Tạo bảng product_relationships
  console.log('C2a: Creating product_relationships table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS product_relationships (
      id              SERIAL PRIMARY KEY,
      parent_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      child_sku       VARCHAR(200) NOT NULL,
      child_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
      relationship_type VARCHAR(50) NOT NULL DEFAULT 'component',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      CONSTRAINT uq_product_rel UNIQUE (parent_id, child_sku)
    )
  `);
  console.log('   ✅ product_relationships table created');

  // Indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_prel_parent ON product_relationships(parent_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_prel_child ON product_relationships(child_id) WHERE child_id IS NOT NULL;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_prel_child_sku ON product_relationships(child_sku);
  `);
  console.log('   ✅ Indexes created');

  // Verify
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'product_relationships'
  `);
  console.log(`\n📊 Table product_relationships: ${tables.rows.length > 0 ? 'EXISTS ✅' : 'NOT FOUND ❌'}`);

  await client.end();
  console.log('\n✅ C2 table creation complete');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
