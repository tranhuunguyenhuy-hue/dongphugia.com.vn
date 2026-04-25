/**
 * Phase 1E.2 + 1E.3: Apply Rename & Generate Redirect Map
 *
 * Reads the PM-approved CSV and:
 *  1. Updates product name, slug, display_name in database
 *  2. Generates a 301 redirect map (old_slug → new_slug) for deployment
 *
 * Usage:
 *   npx tsx scripts/variant-pipeline/phase1-apply-rename.ts --dry-run
 *   npx tsx scripts/variant-pipeline/phase1-apply-rename.ts --execute
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--execute');

const CSV_PATH = path.join(__dirname, 'output/phase1-bon-cau-rename-preview.csv');
const OUTPUT_DIR = path.join(__dirname, 'output');

interface RenameRow {
  id: number;
  sku: string;
  brand: string;
  variant_group: string;
  old_name: string;
  new_name: string;
  old_slug: string;
  new_slug: string;
  changed: string;
}

// ──────────────────────────────────────────
// CSV Parser (handles quoted fields)
// ──────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function loadCSV(): RenameRow[] {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const rows: RenameRow[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 9) continue;

    rows.push({
      id: parseInt(fields[0], 10),
      sku: fields[1],
      brand: fields[2],
      variant_group: fields[3],
      old_name: fields[4],
      new_name: fields[5],
      old_slug: fields[6],
      new_slug: fields[7],
      changed: fields[8],
    });
  }

  return rows;
}

// ──────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 1E: APPLY RENAME — ${DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Load CSV
  const rows = loadCSV();
  console.log(`Loaded ${rows.length} entries from CSV`);

  const changedRows = rows.filter(r => r.changed === 'YES');
  const unchangedRows = rows.filter(r => r.changed !== 'YES');

  console.log(`  Changed: ${changedRows.length}`);
  console.log(`  Unchanged: ${unchangedRows.length}`);

  // ──────────────────────────────────────────
  // STEP 1: Apply renames to database
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  STEP 1: Apply renames to database`);
  console.log(`${'─'.repeat(50)}`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const redirectMap: { old_slug: string; new_slug: string; sku: string }[] = [];

  for (const row of changedRows) {
    try {
      // Verify the product still exists and name hasn't been manually changed
      const product = await prisma.products.findUnique({
        where: { id: row.id },
        select: { id: true, name: true, slug: true },
      });

      if (!product) {
        console.log(`  ⚠️ Product ID ${row.id} not found, skipping`);
        skipped++;
        continue;
      }

      // Safety check: only update if current name matches old_name
      if (product.name !== row.old_name) {
        console.log(`  ⚠️ Name mismatch for ${row.sku} (ID: ${row.id})`);
        console.log(`    Expected: "${row.old_name}"`);
        console.log(`    Current:  "${product.name}"`);
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        await prisma.products.update({
          where: { id: row.id },
          data: {
            name: row.new_name,
            slug: row.new_slug,
            display_name: row.new_name,
          },
        });
      }

      updated++;

      // Track slug changes for redirect map
      if (row.old_slug !== row.new_slug) {
        redirectMap.push({
          old_slug: row.old_slug,
          new_slug: row.new_slug,
          sku: row.sku,
        });
      }

      if (updated <= 5) {
        console.log(`  ✅ ${row.sku}: "${row.old_name.substring(0, 50)}..." → "${row.new_name.substring(0, 50)}..."`);
      }
    } catch (e: any) {
      console.error(`  ❌ Error updating ${row.sku} (ID: ${row.id}):`, e.message);
      errors++;
    }
  }

  console.log(`\n  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // ──────────────────────────────────────────
  // STEP 2: Generate 301 redirect map
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  STEP 2: Generate 301 redirect map`);
  console.log(`${'─'.repeat(50)}`);

  console.log(`  Slug changes: ${redirectMap.length}`);

  // JSON format (for Next.js redirects in next.config.ts)
  const redirectJson = redirectMap.map(r => ({
    source: `/san-pham/${r.old_slug}`,
    destination: `/san-pham/${r.new_slug}`,
    permanent: true,
  }));

  const jsonPath = path.join(OUTPUT_DIR, 'phase1-bon-cau-redirects.json');
  fs.writeFileSync(jsonPath, JSON.stringify(redirectJson, null, 2), 'utf-8');
  console.log(`  📄 JSON redirects: ${jsonPath}`);

  // CSV format (for Vercel _redirects or middleware)
  const redirectCsvHeader = 'old_slug,new_slug,old_url,new_url,sku\n';
  const redirectCsvRows = redirectMap.map(r =>
    `"${r.old_slug}","${r.new_slug}","/san-pham/${r.old_slug}","/san-pham/${r.new_slug}","${r.sku}"`
  ).join('\n');
  const csvPath = path.join(OUTPUT_DIR, 'phase1-bon-cau-redirects.csv');
  fs.writeFileSync(csvPath, redirectCsvHeader + redirectCsvRows, 'utf-8');
  console.log(`  📄 CSV redirects: ${csvPath}`);

  // Show sample
  console.log(`\n  === SAMPLE REDIRECTS (first 5) ===`);
  for (const r of redirectMap.slice(0, 5)) {
    console.log(`  /san-pham/${r.old_slug.substring(0, 50)}...`);
    console.log(`    → /san-pham/${r.new_slug.substring(0, 50)}...`);
  }

  // ──────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 1E SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Products renamed:        ${updated}/${changedRows.length}`);
  console.log(`  Slug redirects created:  ${redirectMap.length}`);
  console.log(`  Errors:                  ${errors}`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — No changes made. Run with --execute to apply.`);
  } else {
    console.log(`\n✅ Phase 1E EXECUTED successfully!`);
    console.log(`\n📋 NEXT STEPS:`);
    console.log(`  1. Add redirects to next.config.ts from: ${jsonPath}`);
    console.log(`  2. Deploy to apply redirect rules`);
    console.log(`  3. Proceed to Phase 2 (Sen Tắm)`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
