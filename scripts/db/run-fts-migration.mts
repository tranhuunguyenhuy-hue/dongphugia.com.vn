/**
 * FTS Migration runner using Prisma
 * Run: npx tsx --env-file=.env.local scripts/db/run-fts-migration.mts
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const db = new PrismaClient()

async function step(name: string, sql: Prisma.Sql) {
    process.stdout.write(`  ⏳ ${name}... `)
    try {
        await db.$executeRaw(sql)
        console.log('✅')
    } catch (err: any) {
        const msg = err?.message ?? String(err)
        if (msg.includes('already exists') || msg.includes('does not exist') || msg.includes('IF NOT EXISTS')) {
            console.log('⚠️  (already ok)')
        } else {
            console.log(`❌ ${msg.slice(0, 100)}`)
        }
    }
}

async function runMigration() {
    console.log('🚀 Starting Full-Text Search migration...\n')

    // Step 1: Add column
    await step('Add search_vector column',
        Prisma.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector`
    )

    // Step 2: Create trigger function
    await step('Create trigger function',
        Prisma.sql`
            CREATE OR REPLACE FUNCTION products_search_vector_update()
            RETURNS trigger AS $$
            BEGIN
                NEW.search_vector := to_tsvector(
                    'simple',
                    coalesce(NEW.name, '') || ' ' ||
                    coalesce(NEW.sku, '') || ' ' ||
                    coalesce(substring(NEW.description from 1 for 300), '')
                );
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `
    )

    // Step 3: Drop old trigger
    await step('Drop old trigger',
        Prisma.sql`DROP TRIGGER IF EXISTS products_search_vector_trigger ON products`
    )

    // Step 4: Create trigger
    await step('Create trigger',
        Prisma.sql`
            CREATE TRIGGER products_search_vector_trigger
                BEFORE INSERT OR UPDATE ON products
                FOR EACH ROW EXECUTE FUNCTION products_search_vector_update()
        `
    )

    // Step 5: GIN index
    await step('Create GIN index',
        Prisma.sql`CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN(search_vector)`
    )

    // Step 6: Backfill in batches (UPDATE triggers the trigger, populating search_vector)
    await step('Backfill batch 1 (id 1–2000)',
        Prisma.sql`UPDATE products SET name = name WHERE id BETWEEN 1 AND 2000`
    )
    await step('Backfill batch 2 (id 2001–4000)',
        Prisma.sql`UPDATE products SET name = name WHERE id BETWEEN 2001 AND 4000`
    )
    await step('Backfill batch 3 (id 4001+)',
        Prisma.sql`UPDATE products SET name = name WHERE id > 4000`
    )

    // Verification
    console.log('\n📊 Verification:')
    const result = await db.$queryRaw<[{ total: bigint; indexed: bigint }]>`
        SELECT COUNT(*) as total, COUNT(search_vector) as indexed FROM products
    `
    const row = result[0]
    console.log(`  Total products:    ${row.total}`)
    console.log(`  Indexed with FTS:  ${row.indexed}`)
    console.log(`  Coverage:          ${Math.round(Number(row.indexed) / Number(row.total) * 100)}%`)

    // Test
    console.log('\n🔍 Test search "TOTO":')
    const test = await db.$queryRaw<Array<{ name: string; sku: string }>>`
        SELECT name, sku
        FROM products
        WHERE search_vector @@ to_tsquery('simple', 'TOTO:*')
        LIMIT 3
    `
    if (test.length === 0) {
        console.log('  (No results — try other keyword)')
    } else {
        test.forEach(r => console.log(`  - ${r.name} (${r.sku})`))
    }

    await db.$disconnect()
    console.log('\n✅ Migration complete!')
}

runMigration().catch(async err => {
    console.error('Fatal error:', err.message ?? err)
    await db.$disconnect()
    process.exit(1)
})
