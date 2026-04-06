/**
 * LEO-366: Execute SQL migration via Prisma
 * Handles PL/pgSQL $$ blocks correctly
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

/**
 * Split SQL into executable statements, respecting $$ blocks
 */
function splitStatements(sql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    const lines = sql.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip pure comment lines outside of $$ blocks
        if (!inDollarQuote && (trimmed.startsWith('--') || trimmed.length === 0)) {
            continue;
        }

        // Track $$ blocks
        const dollarCount = (line.match(/\$\$/g) || []).length;
        if (dollarCount % 2 === 1) {
            inDollarQuote = !inDollarQuote;
        }

        current += line + '\n';

        // Statement ends at ; when NOT inside $$ block
        if (!inDollarQuote && trimmed.endsWith(';')) {
            const stmt = current.trim();
            if (stmt.length > 0) {
                // Filter out comment-only blocks
                const meaningfulLines = stmt.split('\n')
                    .filter(l => !l.trim().startsWith('--') && !l.trim().startsWith('//') && l.trim().length > 0);
                if (meaningfulLines.length > 0) {
                    statements.push(stmt);
                }
            }
            current = '';
        }
    }

    // Handle any remaining content
    if (current.trim().length > 0) {
        const meaningfulLines = current.trim().split('\n')
            .filter(l => !l.trim().startsWith('--') && l.trim().length > 0);
        if (meaningfulLines.length > 0) {
            statements.push(current.trim());
        }
    }

    return statements;
}

async function main() {
    console.log('🚀 LEO-366: Running V2 Database Migration');
    console.log('═══════════════════════════════════════════\n');

    // Pre-migration state
    const preCount = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    console.log(`📊 Pre-migration: ${preCount[0].count} tables\n`);

    // Read and parse SQL
    const sqlPath = join(__dirname, 'migration-v2-schema.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');
    const statements = splitStatements(sqlContent);
    console.log(`📝 Parsed ${statements.length} SQL statements\n`);

    let success = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt
            .split('\n')
            .filter(l => !l.trim().startsWith('--') && l.trim().length > 0)[0]
            ?.trim()
            ?.substring(0, 70) || '...';
        
        try {
            await prisma.$executeRawUnsafe(stmt);
            console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}`);
            success++;
        } catch (error) {
            const msg = error.message?.split('\n')[0]?.substring(0, 100) || 'Unknown error';
            console.log(`  ⚠️  [${i + 1}/${statements.length}] ${preview}`);
            console.log(`      → ${msg}`);
            errors.push({ index: i + 1, preview, error: msg });
            failed++;
        }
    }

    // Post-migration verification
    console.log('\n═══════════════════════════════════════════');
    console.log(`📊 Results: ${success} succeeded, ${failed} failed\n`);

    const postCount = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    console.log(`📋 Post-migration: ${postCount[0].count} tables`);

    // Verify categories
    try {
        const cats = await prisma.$queryRaw`SELECT id, name, slug FROM categories ORDER BY sort_order`;
        console.log(`\n🏷️  Categories (${cats.length}):`);
        cats.forEach(c => console.log(`  ${c.id}. ${c.name} → /${c.slug}`));
    } catch {
        console.log('⚠️ Categories not found');
    }

    // List all tables
    const tables = await prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
        ORDER BY table_name
    `;
    console.log(`\n📋 All tables (${tables.length}):`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    if (errors.length > 0) {
        console.log(`\n⚠️  ${errors.length} failed statements (review above)`);
    }

    console.log('\n✅ Done! Next: npx prisma db pull && npx prisma generate');
}

main()
    .catch(e => { console.error('Fatal:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
