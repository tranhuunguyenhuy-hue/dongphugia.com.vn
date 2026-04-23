/**
 * Phase A: DB changes via pg driver trực tiếp (không qua Prisma transaction)
 * Bypass Supabase statement timeout bằng cách set timeout cao hơn
 */
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  console.log('✅ Connected via pg driver directly\n');

  // Set statement timeout cao hơn cho session này (5 phút)
  await client.query(`SET statement_timeout = '300000'`);
  await client.query(`SET lock_timeout = '30000'`);

  // A2: Add columns
  console.log('A2: Adding component_skus column...');
  try {
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS component_skus TEXT[] DEFAULT '{}'
    `);
    console.log('   ✅ component_skus added');
  } catch (e: any) {
    console.log('   ℹ️ ', e.message.split('\n')[0]);
  }

  console.log('A2b: Adding display_name column...');
  try {
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(500)
    `);
    console.log('   ✅ display_name added');
  } catch (e: any) {
    console.log('   ℹ️ ', e.message.split('\n')[0]);
  }

  // A1: Indexes — CONCURRENTLY requires no transaction
  console.log('\nA1: Creating composite index...');
  try {
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sub_type_active
      ON products(subcategory_id, product_type)
      WHERE is_active = true
    `);
    console.log('   ✅ idx_products_sub_type_active created');
  } catch (e: any) {
    console.log('   ℹ️ ', e.message.split('\n')[0]);
  }

  console.log('A1b: Creating product_type partial index...');
  try {
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_product_type
      ON products(product_type)
      WHERE is_active = true AND product_type IS NOT NULL
    `);
    console.log('   ✅ idx_products_product_type created');
  } catch (e: any) {
    console.log('   ℹ️ ', e.message.split('\n')[0]);
  }

  // Verify 
  console.log('\n📊 Verification:');
  const idxResult = await client.query(`
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'products' AND indexname LIKE 'idx_products%'
    ORDER BY indexname
  `);
  idxResult.rows.forEach(r => console.log('   Index:', r.indexname));

  const colResult = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name IN ('component_skus', 'display_name')
    ORDER BY column_name
  `);
  colResult.rows.forEach(r => console.log(`   Column: ${r.column_name} (${r.data_type})`));

  await client.end();
  console.log('\n✅ Phase A DB changes complete');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
