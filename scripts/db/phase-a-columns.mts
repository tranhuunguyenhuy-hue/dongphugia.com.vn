/**
 * Phase A — Add missing columns: component_skus + display_name
 * Indexes đã có từ đêm qua (do Supabase SQL editor)
 */
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  console.log('✅ Connected\n');

  // Set timeout cao hơn cho session này
  await client.query(`SET statement_timeout = '120000'`); // 2 phút
  await client.query(`SET lock_timeout = '60000'`);       // 1 phút

  // A2a: component_skus
  console.log('A2a: Adding component_skus TEXT[] column...');
  try {
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS component_skus TEXT[] DEFAULT '{}'
    `);
    console.log('   ✅ component_skus added');
  } catch (e: any) {
    console.log('   ❌', e.message.split('\n')[0]);
  }

  // A2b: display_name
  console.log('A2b: Adding display_name VARCHAR(500) column...');
  try {
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(500)
    `);
    console.log('   ✅ display_name added');
  } catch (e: any) {
    console.log('   ❌', e.message.split('\n')[0]);
  }

  // Verify
  const cols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name IN ('component_skus', 'display_name')
    ORDER BY column_name
  `);

  console.log('\n📊 Verification:');
  if (cols.rows.length === 0) {
    console.log('   ❌ Columns NOT created — check permissions');
  } else {
    cols.rows.forEach(r => console.log(`   ✅ ${r.column_name}: ${r.data_type}`));
  }

  await client.end();
  console.log('\n✅ Phase A columns complete');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
