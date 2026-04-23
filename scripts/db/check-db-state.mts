import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  console.log('✅ Connected\n');

  // Check columns
  const cols = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name IN ('component_skus', 'display_name', 'product_type', 'product_sub_type')
    ORDER BY column_name
  `);
  console.log('📊 Columns on products table:');
  cols.rows.forEach(r => console.log(`  ${r.column_name.padEnd(20)} ${r.data_type} (default: ${r.column_default})`));

  // Check indexes
  const idxs = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'products'
    ORDER BY indexname
  `);
  console.log('\n📊 Indexes:');
  idxs.rows.forEach(r => console.log(`  ${r.indexname}`));

  // Check active connections (ẩn lock không?)
  const locks = await client.query(`
    SELECT count(*) as cnt, state
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
  `);
  console.log('\n📊 DB connections:');
  locks.rows.forEach(r => console.log(`  ${r.state || 'null'}: ${r.cnt} connections`));

  await client.end();
}
main().catch(e => console.error('❌', e.message));
