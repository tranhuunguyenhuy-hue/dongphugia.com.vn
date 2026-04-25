/**
 * PHASE 2: SEN TẮM — Variant Pipeline
 *
 * Processes ~179 shower combos across all brands:
 *  - Batch 2A: 51 plus combos (MOEN, ATMOR, Caesar) — existing rels
 *  - Batch 2B: 100 TOTO slash combos
 *  - Batch 2C: 6 Caesar slash combos
 *  - Batch 2D: 22 American Standard EasySet color variants
 *
 * Usage:
 *   npx tsx scripts/variant-pipeline/phase2-sen-tam.ts --dry-run
 *   npx tsx scripts/variant-pipeline/phase2-sen-tam.ts --execute
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseComboSKU,
  generateStandardName,
  extractProductType,
  generateSlug,
  TOTO_SHOWER_PREFIX_MAP,
  type ParsedCombo,
  type ParsedComponent,
  type ComponentType,
} from './utils';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--execute');
const OUTPUT_DIR = path.join(__dirname, 'output');

// ──────────────────────────────────────────
// TOTO Sen Tắm component type from prefix
// ──────────────────────────────────────────
function detectTotoShowerType(sku: string): ComponentType {
  const clean = sku.replace(/#.*$/, '');
  // Sort prefixes by length descending for longest match first
  const sortedPrefixes = Object.keys(TOTO_SHOWER_PREFIX_MAP)
    .sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (clean.startsWith(prefix)) {
      return TOTO_SHOWER_PREFIX_MAP[prefix];
    }
  }
  return 'component';
}

// ──────────────────────────────────────────
// TOTO Sen Tắm component label
// ──────────────────────────────────────────
const TOTO_SHOWER_LABEL_MAP: Record<ComponentType, string> = {
  body: 'cây sen',
  mixer: 'vòi sen',
  valve: 'van',
  shower_head: 'bát sen',
  rail: 'thanh trượt',
  lid: 'nắp',
  basin: 'chậu',
  pedestal: 'chân',
  cabinet: 'tủ',
  frame: 'khung',
  flush_plate: 'nút xả',
  tank: 'bồn chứa',
  faucet: 'vòi',
  holder: 'giá đỡ',
  hose: 'dây sen',
  drain: 'bộ xả',
  component: '',
};

// ──────────────────────────────────────────
// MOEN Sen Tắm component type detection
// ──────────────────────────────────────────
function detectMoenComponentType(sku: string, index: number, totalParts: number): ComponentType {
  // MOEN combos are harder to classify by SKU prefix
  // First component is typically the valve/body, last is often accessories
  if (index === 0) return 'valve';
  if (index === 1) return 'mixer';
  return 'component';
}

// ──────────────────────────────────────────
// Parse TOTO slash combo for Sen Tắm
// ──────────────────────────────────────────
function parseTotoShowerCombo(sku: string, productName: string): ParsedCombo {
  const parts = sku.split('/').map(p => p.replace(/#.*$/, '').trim()).filter(Boolean);

  const components: ParsedComponent[] = parts.map(part => {
    const type = detectTotoShowerType(part);
    const typeLabel = TOTO_SHOWER_LABEL_MAP[type] || '';
    return {
      sku: part,
      type,
      label: typeLabel ? `${typeLabel} ${part}` : part,
    };
  });

  // Determine variant group:
  // For shower combos, the "body" (cây sen DM*) or mixer is the primary identifier
  const bodyComp = components.find(c => c.type === 'body');
  const mixerComp = components.find(c => c.type === 'mixer');
  const variantGroup = bodyComp?.sku || mixerComp?.sku || components[0]?.sku || null;

  return {
    isCombo: true,
    variantGroup,
    components,
    comboType: 'slash',
  };
}

// ──────────────────────────────────────────
// Generate Sen Tắm standard name
// ──────────────────────────────────────────
function generateSenTamName(
  productName: string,
  brandName: string,
  parsed: ParsedCombo,
): string {
  let productType = extractProductType(productName);

  // Strip brand name from productType to avoid duplication
  // e.g., "Tay sen Caesar" → "Tay sen" (brand will be re-added)
  const brandPattern = new RegExp(`\\s+${brandName}$`, 'i');
  productType = productType.replace(brandPattern, '').trim();

  // Primary model = variant group component
  const primaryModel = parsed.variantGroup || '';

  // Accessories = everything except the primary component
  const accessories = parsed.components.filter(c => c.sku !== primaryModel);

  if (accessories.length === 0) {
    return `${productType} ${brandName} ${primaryModel}`;
  }

  // Build accessory description
  const accessoryDesc = accessories
    .map(c => c.label || c.sku)
    .join(', ');

  return `${productType} ${brandName} ${primaryModel} kèm ${accessoryDesc}`;
}

// ──────────────────────────────────────────
// EasySet variant group extraction
// ──────────────────────────────────────────
function getEasySetGroup(sku: string): string {
  // "EasySet - Matte Black" → "EasySet"
  // "EasySet Essential - Matte Black 1" → "EasySet Essential"
  // "EasySet Experience - Polished Cool Sunrise" → "EasySet Experience"
  const match = sku.match(/^(EasySet(?:\s+\w+)?)\s*-/);
  return match ? match[1].trim() : 'EasySet';
}

// ──────────────────────────────────────────
// Rename generation helpers
// ──────────────────────────────────────────
interface RenameEntry {
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

function generateRename(
  product: { id: number; sku: string; name: string; slug: string },
  brandName: string,
  parsed: ParsedCombo,
): RenameEntry {
  const newName = generateSenTamName(product.name, brandName, parsed);
  const newSlug = generateSlug(newName);

  return {
    id: product.id,
    sku: product.sku,
    brand: brandName,
    variant_group: parsed.variantGroup || '',
    old_name: product.name,
    new_name: newName,
    old_slug: product.slug,
    new_slug: newSlug,
    changed: product.name !== newName ? 'YES' : 'NO',
  };
}

// ──────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 2: SEN TẮM — ${DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const renames: RenameEntry[] = [];
  let totalCombo = 0;
  let totalRels = 0;
  let existingRelsUpdated = 0;

  // ═══════════════════════════════════════════
  // BATCH 2A: 51 Plus combos (existing rels)
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 2A: Plus combos (MOEN, ATMOR, Caesar)`);
  console.log(`${'─'.repeat(50)}`);

  const plusCombos = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'sen-tam' },
      is_active: true,
      sku: { contains: '+' },
    },
    include: {
      brands: { select: { slug: true, name: true } },
      parent_relationships: true,
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  Found ${plusCombos.length} plus combos`);

  for (const product of plusCombos) {
    const brandSlug = product.brands?.slug || '';
    const brandName = product.brands?.name || '';

    const parsed = parseComboSKU(product.sku, brandSlug, 'sen-tam');

    if (!parsed.isCombo) continue;

    totalCombo++;

    // Set is_combo + variant_group
    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: {
          is_combo: true,
          variant_group: parsed.variantGroup,
        },
      });
    }

    // Update existing relationships with component_type
    for (const rel of product.parent_relationships) {
      const matchComp = parsed.components.find(c => c.sku === rel.child_sku);
      if (matchComp && rel.component_type !== matchComp.type) {
        existingRelsUpdated++;
        if (!DRY_RUN) {
          await prisma.product_relationships.update({
            where: { id: rel.id },
            data: { component_type: matchComp.type },
          });
        }
      }
    }

    renames.push(generateRename(
      { id: product.id, sku: product.sku, name: product.name, slug: product.slug },
      brandName,
      parsed,
    ));
  }

  console.log(`  Combos processed: ${totalCombo}`);
  console.log(`  Existing rels updated: ${existingRelsUpdated}`);

  // ═══════════════════════════════════════════
  // BATCH 2B: 100 TOTO slash combos
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 2B: TOTO slash combos`);
  console.log(`${'─'.repeat(50)}`);

  const totoSlash = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'sen-tam' },
      is_active: true,
      brands: { slug: 'toto' },
      sku: { contains: '/' },
    },
    include: {
      brands: { select: { slug: true, name: true } },
      parent_relationships: true,
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  Found ${totoSlash.length} TOTO slash combos`);

  let newRelsCreated = 0;

  for (const product of totoSlash) {
    const parsed = parseTotoShowerCombo(product.sku, product.name);
    totalCombo++;

    // Set is_combo + variant_group
    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: {
          is_combo: true,
          variant_group: parsed.variantGroup,
        },
      });
    }

    // Create relationships if they don't exist
    const existingChildSkus = new Set(product.parent_relationships.map(r => r.child_sku));

    for (const comp of parsed.components) {
      if (!existingChildSkus.has(comp.sku)) {
        newRelsCreated++;
        if (!DRY_RUN) {
          await prisma.product_relationships.create({
            data: {
              parent_id: product.id,
              child_sku: comp.sku,
              component_type: comp.type,
              relationship_type: 'combo_component',
            },
          });
        }
      }
    }

    renames.push(generateRename(
      { id: product.id, sku: product.sku, name: product.name, slug: product.slug },
      'TOTO',
      parsed,
    ));
  }

  console.log(`  New rels created: ${newRelsCreated}`);
  totalRels += newRelsCreated;

  // ═══════════════════════════════════════════
  // BATCH 2C: 6 Caesar slash combos
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 2C: Caesar slash combos`);
  console.log(`${'─'.repeat(50)}`);

  const caesarSlash = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'sen-tam' },
      is_active: true,
      brands: { slug: 'caesar' },
      sku: { contains: '/' },
    },
    include: {
      brands: { select: { slug: true, name: true } },
      parent_relationships: true,
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  Found ${caesarSlash.length} Caesar slash combos`);

  let caesarRels = 0;
  for (const product of caesarSlash) {
    const parts = product.sku.split('/').map(p => p.trim());
    const components: ParsedComponent[] = parts.map((part, i) => ({
      sku: part,
      type: (i === 0 ? 'shower_head' : 'hose') as ComponentType,
      label: i === 0 ? `tay sen ${part}` : `dây sen ${part}`,
    }));

    const parsed: ParsedCombo = {
      isCombo: true,
      variantGroup: parts[0],
      components,
      comboType: 'slash',
    };

    totalCombo++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: {
          is_combo: true,
          variant_group: parsed.variantGroup,
        },
      });
    }

    // Create rels
    const existingChildSkus = new Set(product.parent_relationships.map(r => r.child_sku));
    for (const comp of parsed.components) {
      if (!existingChildSkus.has(comp.sku)) {
        caesarRels++;
        if (!DRY_RUN) {
          await prisma.product_relationships.create({
            data: {
              parent_id: product.id,
              child_sku: comp.sku,
              component_type: comp.type,
              relationship_type: 'combo_component',
            },
          });
        }
      }
    }

    renames.push(generateRename(
      { id: product.id, sku: product.sku, name: product.name, slug: product.slug },
      'Caesar',
      parsed,
    ));
  }

  console.log(`  New rels created: ${caesarRels}`);
  totalRels += caesarRels;

  // ═══════════════════════════════════════════
  // BATCH 2D: 22 American Standard EasySet
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 2D: American Standard EasySet (color variants)`);
  console.log(`${'─'.repeat(50)}`);

  const easySets = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'sen-tam' },
      is_active: true,
      sku: { startsWith: 'EasySet' },
    },
    include: {
      brands: { select: { slug: true, name: true } },
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  Found ${easySets.length} EasySet variants`);

  for (const product of easySets) {
    const group = getEasySetGroup(product.sku);

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: {
          is_combo: false, // NOT a combo — color variant
          variant_group: group,
        },
      });
    }

    // EasySet names are already good — no rename needed
    renames.push({
      id: product.id,
      sku: product.sku,
      brand: product.brands?.name || 'American Standard',
      variant_group: group,
      old_name: product.name,
      new_name: product.name,  // Keep as-is
      old_slug: product.slug,
      new_slug: product.slug,
      changed: 'NO',
    });
  }

  // ═══════════════════════════════════════════
  // EXPORT CSV
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  EXPORT RENAME PREVIEW CSV`);
  console.log(`${'─'.repeat(50)}`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const csvHeader = 'id,sku,brand,variant_group,old_name,new_name,old_slug,new_slug,changed\n';
  const csvRows = renames.map(r => [
    r.id,
    `"${r.sku}"`,
    `"${r.brand}"`,
    `"${r.variant_group}"`,
    `"${r.old_name}"`,
    `"${r.new_name}"`,
    `"${r.old_slug}"`,
    `"${r.new_slug}"`,
    r.changed,
  ].join(',')).join('\n');

  const csvPath = path.join(OUTPUT_DIR, 'phase2-sen-tam-rename-preview.csv');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');
  console.log(`  📄 Written: ${csvPath}`);

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  const changedCount = renames.filter(r => r.changed === 'YES').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 2 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Products flagged is_combo:    ${totalCombo}`);
  console.log(`  EasySet variant_group set:    ${easySets.length}`);
  console.log(`  Existing rels updated:        ${existingRelsUpdated}`);
  console.log(`  New rels created:             ${totalRels}`);
  console.log(`  Renames generated:            ${renames.length}`);
  console.log(`  Renames with changes:         ${changedCount}`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — No changes made. Run with --execute to apply.`);
  } else {
    console.log(`\n✅ Phase 2 EXECUTED successfully!`);
    console.log(`\n📋 NEXT STEPS:`);
    console.log(`  1. Review CSV: ${csvPath}`);
    console.log(`  2. Run phase1-apply-rename.ts pattern for Phase 2`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
