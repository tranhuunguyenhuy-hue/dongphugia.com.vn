/**
 * Phase 1: BỒN CẦU — Populate variant data for ~185 combo products
 *
 * Batches:
 *  1A: Update 102 combos that ALREADY HAVE relationships
 *  1B: Populate 57 TOTO hash-only (hidden combos)
 *  1C: Populate 22 TOTO slash (treo tường)
 *  1D: Populate 4 Viglacera space
 *  1E: Generate rename preview CSV
 *
 * Usage:
 *   npx tsx scripts/variant-pipeline/phase1-bon-cau.ts --dry-run
 *   npx tsx scripts/variant-pipeline/phase1-bon-cau.ts --execute
 */

import { PrismaClient } from '@prisma/client';
import { parseComboSKU, extractProductType, generateStandardName, generateSlug } from './utils';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--execute');
const SUBCATEGORY_SLUG = 'bon-cau';

interface ProductWithBrand {
  id: number;
  sku: string;
  name: string;
  slug: string;
  display_name: string | null;
  brands: { slug: string; name: string } | null;
  parent_relationships: {
    id: number;
    child_sku: string;
    child_id: number | null;
    relationship_type: string;
    component_type: string;
  }[];
}

interface RenameEntry {
  id: number;
  sku: string;
  old_name: string;
  new_name: string;
  old_slug: string;
  new_slug: string;
  variant_group: string | null;
  brand: string;
}

// ──────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 1: BỒN CẦU — ${DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Fetch all Bồn Cầu products with relationships
  const products = await prisma.products.findMany({
    where: {
      subcategories: { slug: SUBCATEGORY_SLUG },
      is_active: true,
    },
    include: {
      brands: { select: { slug: true, name: true } },
      parent_relationships: {
        select: {
          id: true,
          child_sku: true,
          child_id: true,
          relationship_type: true,
          component_type: true,
        },
      },
    },
    orderBy: { sku: 'asc' },
  }) as unknown as ProductWithBrand[];

  console.log(`Total Bồn Cầu products: ${products.length}`);

  // Parse all products
  const comboProducts: Array<ProductWithBrand & { parsed: ReturnType<typeof parseComboSKU> }> = [];
  const nonComboProducts: ProductWithBrand[] = [];

  for (const p of products) {
    const brandSlug = p.brands?.slug || 'unknown';
    const parsed = parseComboSKU(p.sku, brandSlug, p.name, SUBCATEGORY_SLUG);

    if (parsed.isCombo || parsed.comboType === 'color') {
      comboProducts.push({ ...p, parsed });
    } else {
      nonComboProducts.push(p);
    }
  }

  console.log(`Combos detected: ${comboProducts.length}`);
  console.log(`Non-combo: ${nonComboProducts.length}`);

  // Separate batches
  const batch1A = comboProducts.filter(p => p.parent_relationships.length > 0 && p.parsed.comboType !== 'hash');
  const batch1B = comboProducts.filter(p => p.parsed.comboType === 'hash');
  const batch1C = comboProducts.filter(p => p.parsed.comboType === 'slash');
  const batch1D = comboProducts.filter(p => p.parsed.comboType === 'space');

  console.log(`\nBatch 1A (existing rels): ${batch1A.length}`);
  console.log(`Batch 1B (TOTO hash): ${batch1B.length}`);
  console.log(`Batch 1C (TOTO slash): ${batch1C.length}`);
  console.log(`Batch 1D (Viglacera space): ${batch1D.length}`);

  const allRenames: RenameEntry[] = [];
  let totalUpdated = 0;
  let totalRelsCreated = 0;
  let totalRelsUpdated = 0;

  // ──────────────────────────────────────────
  // BATCH 1A: Update existing relationships
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 1A: Update ${batch1A.length} combos with existing rels`);
  console.log(`${'─'.repeat(50)}`);

  for (const p of batch1A) {
    const brandSlug = p.brands?.slug || 'unknown';

    // 1. Set is_combo + variant_group
    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: p.id },
        data: {
          is_combo: true,
          variant_group: p.parsed.variantGroup,
        },
      });
    }
    totalUpdated++;

    // 2. Update component_type on existing relationships
    for (const rel of p.parent_relationships) {
      const matchedComponent = p.parsed.components.find(c => {
        // Match by SKU — clean both for comparison
        const cleanRelSku = rel.child_sku.replace(/\/[A-Z0-9]+$/, '').trim();
        return cleanRelSku === c.sku || rel.child_sku.startsWith(c.sku);
      });

      const componentType = matchedComponent?.type || detectComponentTypeFromSku(rel.child_sku, brandSlug);

      if (rel.component_type === 'component' && componentType !== 'component') {
        if (!DRY_RUN) {
          await prisma.product_relationships.update({
            where: { id: rel.id },
            data: { component_type: componentType },
          });
        }
        totalRelsUpdated++;
      }
    }

    // 3. Generate rename
    const rename = generateRename(p);
    if (rename) allRenames.push(rename);
  }

  console.log(`  ✅ Updated: ${totalUpdated} products`);
  console.log(`  ✅ Rels updated: ${totalRelsUpdated} component_types`);

  // ──────────────────────────────────────────
  // BATCH 1B: TOTO hash-only (hidden combos)
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 1B: Populate ${batch1B.length} TOTO hash combos`);
  console.log(`${'─'.repeat(50)}`);

  for (const p of batch1B) {
    // 1. Set is_combo + variant_group
    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: p.id },
        data: {
          is_combo: true,
          variant_group: p.parsed.variantGroup,
        },
      });
    }
    totalUpdated++;

    // 2. Create relationships for each component
    for (const comp of p.parsed.components) {
      // Skip creating rel for body (it's the parent itself)
      // But we do create it so the relationship table is complete
      const existingRel = p.parent_relationships.find(r =>
        r.child_sku === comp.sku || r.child_sku.startsWith(comp.sku)
      );

      if (!existingRel) {
        if (!DRY_RUN) {
          try {
            await prisma.product_relationships.create({
              data: {
                parent_id: p.id,
                child_sku: comp.sku,
                relationship_type: 'component',
                component_type: comp.type,
                sort_order: comp.type === 'body' ? 0 : 1,
              },
            });
            totalRelsCreated++;
          } catch (e: any) {
            if (e.code === 'P2002') {
              // Duplicate — already exists
              console.log(`  ⚠️ Rel already exists: ${p.sku} → ${comp.sku}`);
            } else {
              throw e;
            }
          }
        } else {
          totalRelsCreated++;
        }
      }
    }

    // 3. Generate rename
    const rename = generateRename(p);
    if (rename) allRenames.push(rename);
  }

  console.log(`  ✅ Products updated: ${batch1B.length}`);
  console.log(`  ✅ New rels created: ${totalRelsCreated}`);

  // ──────────────────────────────────────────
  // BATCH 1C: TOTO slash (treo tường)
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 1C: Populate ${batch1C.length} TOTO slash combos`);
  console.log(`${'─'.repeat(50)}`);

  let slashRelsCreated = 0;

  for (const p of batch1C) {
    // 1. Set is_combo + variant_group
    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: p.id },
        data: {
          is_combo: true,
          variant_group: p.parsed.variantGroup,
        },
      });
    }

    // 2. Create relationships for each component
    for (let i = 0; i < p.parsed.components.length; i++) {
      const comp = p.parsed.components[i];

      const existingRel = p.parent_relationships.find(r =>
        r.child_sku === comp.sku || r.child_sku.startsWith(comp.sku)
      );

      if (!existingRel) {
        if (!DRY_RUN) {
          try {
            await prisma.product_relationships.create({
              data: {
                parent_id: p.id,
                child_sku: comp.sku,
                relationship_type: 'component',
                component_type: comp.type,
                sort_order: i,
              },
            });
            slashRelsCreated++;
          } catch (e: any) {
            if (e.code !== 'P2002') throw e;
          }
        } else {
          slashRelsCreated++;
        }
      }
    }

    // 3. Generate rename
    const rename = generateRename(p);
    if (rename) allRenames.push(rename);
  }

  console.log(`  ✅ Products updated: ${batch1C.length}`);
  console.log(`  ✅ New rels created: ${slashRelsCreated}`);
  totalRelsCreated += slashRelsCreated;

  // ──────────────────────────────────────────
  // BATCH 1D: Viglacera space
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 1D: Populate ${batch1D.length} Viglacera space combos`);
  console.log(`${'─'.repeat(50)}`);

  let vigRelsCreated = 0;

  for (const p of batch1D) {
    // 1. Set is_combo + variant_group
    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: p.id },
        data: {
          is_combo: true,
          variant_group: p.parsed.variantGroup,
        },
      });
    }

    // 2. Create relationships
    for (let i = 0; i < p.parsed.components.length; i++) {
      const comp = p.parsed.components[i];
      const existingRel = p.parent_relationships.find(r => r.child_sku === comp.sku);

      if (!existingRel) {
        if (!DRY_RUN) {
          try {
            await prisma.product_relationships.create({
              data: {
                parent_id: p.id,
                child_sku: comp.sku,
                relationship_type: 'component',
                component_type: comp.type,
                sort_order: i,
              },
            });
            vigRelsCreated++;
          } catch (e: any) {
            if (e.code !== 'P2002') throw e;
          }
        } else {
          vigRelsCreated++;
        }
      }
    }

    // 3. Generate rename
    const rename = generateRename(p);
    if (rename) allRenames.push(rename);
  }

  console.log(`  ✅ Products updated: ${batch1D.length}`);
  console.log(`  ✅ New rels created: ${vigRelsCreated}`);
  totalRelsCreated += vigRelsCreated;

  // ──────────────────────────────────────────
  // BATCH 1E: Export Rename Preview CSV
  // ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 1E: Rename Preview`);
  console.log(`${'─'.repeat(50)}`);

  const changedRenames = allRenames.filter(r => r.old_name !== r.new_name);
  const unchangedRenames = allRenames.filter(r => r.old_name === r.new_name);

  console.log(`  Total renames: ${allRenames.length}`);
  console.log(`  Changed: ${changedRenames.length}`);
  console.log(`  Unchanged: ${unchangedRenames.length}`);

  // Export CSV
  const csvDir = path.join(__dirname, '../../scripts/variant-pipeline/output');
  fs.mkdirSync(csvDir, { recursive: true });
  const csvPath = path.join(csvDir, 'phase1-bon-cau-rename-preview.csv');

  const csvHeader = 'id,sku,brand,variant_group,old_name,new_name,old_slug,new_slug,changed\n';
  const csvRows = allRenames.map(r => {
    const changed = r.old_name !== r.new_name ? 'YES' : 'NO';
    return `${r.id},"${r.sku}","${r.brand}","${r.variant_group}","${escapeCsv(r.old_name)}","${escapeCsv(r.new_name)}","${r.old_slug}","${r.new_slug}",${changed}`;
  }).join('\n');

  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');
  console.log(`  📄 CSV exported: ${csvPath}`);

  // Show sample renames
  console.log(`\n  === SAMPLE RENAMES (first 10 changed) ===`);
  for (const r of changedRenames.slice(0, 10)) {
    console.log(`  ${r.sku}:`);
    console.log(`    OLD: ${r.old_name}`);
    console.log(`    NEW: ${r.new_name}`);
  }

  // ──────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 1 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Products flagged is_combo:    ${comboProducts.length}`);
  console.log(`  variant_group populated:      ${comboProducts.filter(p => p.parsed.variantGroup).length}`);
  console.log(`  Existing rels updated:        ${totalRelsUpdated}`);
  console.log(`  New rels created:             ${totalRelsCreated}`);
  console.log(`  Renames generated:            ${allRenames.length}`);
  console.log(`  Renames with changes:         ${changedRenames.length}`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — No changes made. Run with --execute to apply.`);
  } else {
    console.log(`\n✅ Phase 1 EXECUTED successfully!`);
  }

  await prisma.$disconnect();
}

// ──────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────

function generateRename(p: ProductWithBrand & { parsed: ReturnType<typeof parseComboSKU> }): RenameEntry | null {
  const brandName = p.brands?.name || 'Unknown';
  const productType = extractProductType(p.name);
  const newName = generateStandardName(productType, brandName, p.parsed.components, p.parsed.displayModel);
  const newSlug = generateSlug(newName);

  return {
    id: p.id,
    sku: p.sku,
    old_name: p.name,
    new_name: newName,
    old_slug: p.slug,
    new_slug: newSlug,
    variant_group: p.parsed.variantGroup,
    brand: brandName,
  };
}

function detectComponentTypeFromSku(sku: string, brandSlug: string): string {
  // Fallback detection when parsed components don't match
  if (/^CW-?S?\d/i.test(sku)) return 'lid';      // INAX lid
  if (/^TAF|^SB-/i.test(sku)) return 'lid';       // Caesar lid
  if (/^TC\d|^TCW|^TCF/i.test(sku)) return 'lid'; // TOTO lid
  if (/^WH\d|^WD\d/i.test(sku)) return 'frame';   // Duravit frame
  if (/^00\d{4}/i.test(sku)) return 'flush_plate'; // Duravit flush plate
  if (/^MB\d/i.test(sku)) return 'flush_plate';    // TOTO flush plate
  if (/^AC-|^CD\d|^C\d{3,4}|^MS\d|^CS\d/i.test(sku)) return 'body';
  return 'component';
}

function escapeCsv(str: string): string {
  return str.replace(/"/g, '""');
}

// Run
main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
