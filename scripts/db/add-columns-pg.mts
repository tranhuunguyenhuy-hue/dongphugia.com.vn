// Use native pg client to bypass Prisma/PgBouncer statement_timeout
import pg from 'pg';

const { Client } = pg;

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('❌ DIRECT_URL not set');
  process.exit(1);
}

const client = new Client({
  connectionString: directUrl,
  // Disable statement timeout at client level
  connectionTimeoutMillis: 60000,
  query_timeout: 120000,
});

async function main() {
  console.log('🔌 Connecting to Supabase (direct)...');
  await client.connect();

  try {
    // Disable timeout for this session
    await client.query('SET statement_timeout = 0');
    console.log('✅ statement_timeout set to 0');

    await client.query(`
      ALTER TABLE public.products
        ADD COLUMN IF NOT EXISTS product_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS product_sub_type VARCHAR(50);
    `);
    console.log('✅ Columns product_type & product_sub_type added successfully!');

    // Verify
    const res = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'products'
        AND column_name IN ('product_type', 'product_sub_type')
      ORDER BY column_name;
    `);
    console.log('\n📋 Verification:');
    console.table(res.rows);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected.');
  }
}

main();
