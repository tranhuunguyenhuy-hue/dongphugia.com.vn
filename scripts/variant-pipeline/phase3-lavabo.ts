/**
 * PHASE 3: LAVABO — Variant Pipeline
 *
 * Processes ~50 lavabo combos + 54 INAX color variants:
 *  - Batch 3A: 36 plus combos (Caesar 29, Viglacera 7) — existing rels
 *  - Batch 3B: 14 TOTO slash combos
 *  - Batch 3C: 54 INAX /BW1 color code — NOT combos
 *
 * Usage:
 *   npx tsx scripts/variant-pipeline/phase3-lavabo.ts --dry-run
 *   npx tsx scripts/variant-pipeline/phase3-lavabo.ts --execute
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseComboSKU,
  extractProductType,
  generateSlug,
  type ParsedCombo,
  type ParsedComponent,
  type ComponentType,
} from './utils';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--execute');
const OUTPUT_DIR = path.join(__dirname, 'output');

// ──────────────────────────────────────────
// TOTO Lavabo component type detection
// ──────────────────────────────────────────
const TOTO_LAVABO_PREFIX_MAP: Record<string, ComponentType> = {
  'LW':  'basin',     // Chậu
  'TL':  'faucet',    // Vòi chậu
  'TX':  'faucet',    // Vòi chậu
  'T':   'drain',     // Bộ xả / phụ kiện
  'F':   'pedestal',  // Chân chậu
};

const TOTO_LAVABO_LABEL_MAP: Record<ComponentType, string> = {
  basin: 'chậu',
  faucet: 'vòi',
  pedestal: 'chân chậu',
  drain: 'bộ xả',
  component: '',
  body: '', mixer: '', valve: '', shower_head: '', rail: '',
  lid: '', cabinet: '', frame: '', flush_plate: '', tank: '',
  holder: '', hose: '',
};

function detectTotoLavaboType(sku: string): ComponentType {
  const clean = sku.replace(/#.*$/, '');
  // Special case: "F" alone or "F#W" = pedestal (chân chậu)
  if (clean === 'F' || clean.startsWith('F') && clean.length <= 3) return 'pedestal';

  const sortedPrefixes = Object.keys(TOTO_LAVABO_PREFIX_MAP)
    .sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (clean.startsWith(prefix)) {
      return TOTO_LAVABO_PREFIX_MAP[prefix];
    }
  }
  return 'component';
}

// ──────────────────────────────────────────
// Caesar Lavabo component type detection
// ──────────────────────────────────────────
function detectCaesarLavaboType(sku: string): ComponentType {
  if (sku.startsWith('P')) return 'pedestal';   // P2443, P2445 = chân chậu
  if (sku.startsWith('EH')) return 'cabinet';   // EH05022 = tủ chậu
  if (sku.startsWith('L')) return 'basin';      // L2140 = chậu
  return 'component';
}

const CAESAR_LAVABO_LABEL_MAP: Record<ComponentType, string> = {
  basin: 'chậu',
  pedestal: 'chân chậu',
  cabinet: 'tủ',
  component: '',
  body: '', mixer: '', valve: '', shower_head: '', rail: '',
  lid: '', faucet: '', frame: '', flush_plate: '', tank: '',
  holder: '', hose: '', drain: '',
};

// ──────────────────────────────────────────
// Rename generation
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

function generateLavaboName(
  productName: string,
  brandName: string,
  parsed: ParsedCombo,
  labelMap: Record<ComponentType, string>,
): string {
  let productType = extractProductType(productName);

  // Strip brand from productType to avoid duplication
  const brandPattern = new RegExp(`\\s+${brandName}$`, 'i');
  productType = productType.replace(brandPattern, '').trim();

  const primaryModel = parsed.variantGroup || '';
  const accessories = parsed.components.filter(c => c.sku !== primaryModel);

  if (accessories.length === 0) {
    return `${productType} ${brandName} ${primaryModel}`;
  }

  const accessoryDesc = accessories
    .map(c => {
      const typeLabel = labelMap[c.type] || '';
      return typeLabel ? `${typeLabel} ${c.sku}` : c.sku;
    })
    .join(', ');

  return `${productType} ${brandName} ${primaryModel} kèm ${accessoryDesc}`;
}

function generateRename(
  product: { id: number; sku: string; name: string; slug: string },
  brandName: string,
  parsed: ParsedCombo,
  labelMap: Record<ComponentType, string>,
): RenameEntry {
  const newName = generateLavaboName(product.name, brandName, parsed, labelMap);
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
  console.log(`  PHASE 3: LAVABO — ${DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const renames: RenameEntry[] = [];
  let totalCombo = 0;
  let totalRels = 0;
  let existingRelsUpdated = 0;

  // ═══════════════════════════════════════════
  // BATCH 3A: 36 Plus combos (Caesar, Viglacera)
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 3A: Plus combos (Caesar, Viglacera)`);
  console.log(`${'─'.repeat(50)}`);

  const plusCombos = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'lavabo' },
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
    const parsed = parseComboSKU(product.sku, brandSlug, 'lavabo');

    if (!parsed.isCombo) continue;
    totalCombo++;

    // Enrich component types based on brand
    for (const comp of parsed.components) {
      if (brandSlug === 'caesar') {
        comp.type = detectCaesarLavaboType(comp.sku);
      }
    }

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

    const labelMap = brandSlug === 'caesar' ? CAESAR_LAVABO_LABEL_MAP : CAESAR_LAVABO_LABEL_MAP;
    renames.push(generateRename(
      { id: product.id, sku: product.sku, name: product.name, slug: product.slug },
      brandName,
      parsed,
      labelMap,
    ));
  }

  console.log(`  Combos processed: ${totalCombo}`);
  console.log(`  Existing rels updated: ${existingRelsUpdated}`);

  // ═══════════════════════════════════════════
  // BATCH 3B: 14 TOTO slash combos
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 3B: TOTO slash combos`);
  console.log(`${'─'.repeat(50)}`);

  const totoSlash = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'lavabo' },
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
    const parts = product.sku.split('/').map(p => p.trim()).filter(Boolean);

    const components: ParsedComponent[] = parts.map(part => {
      const cleanSku = part.replace(/#.*$/, '');
      const type = detectTotoLavaboType(part);
      return { sku: cleanSku, type, label: '' };
    });

    // Primary = basin (LW*)
    const basinComp = components.find(c => c.type === 'basin');
    const variantGroup = basinComp?.sku || components[0]?.sku || null;

    const parsed: ParsedCombo = {
      isCombo: true,
      variantGroup,
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
      TOTO_LAVABO_LABEL_MAP,
    ));
  }

  console.log(`  New rels created: ${newRelsCreated}`);
  totalRels += newRelsCreated;

  // ═══════════════════════════════════════════
  // BATCH 3C: 54 INAX /BW1 = color code (NOT combo)
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 3C: INAX /BW1 color variants (NOT combo)`);
  console.log(`${'─'.repeat(50)}`);

  const inaxBw = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'lavabo' },
      is_active: true,
      brands: { slug: 'inax' },
      sku: { contains: '/BW1' },
    },
    include: { brands: { select: { slug: true, name: true } } },
    orderBy: { sku: 'asc' },
  });

  console.log(`  Found ${inaxBw.length} INAX /BW1 products`);

  for (const product of inaxBw) {
    // Extract base model from SKU: "L-445V/BW1" → "L-445V"
    const baseModel = product.sku.split('/')[0];
    const variantGroup = baseModel.replace(/[-]/g, '').replace(/^(AL|L)/, '$1');

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: {
          is_combo: false, // NOT a combo
          variant_group: variantGroup,
        },
      });
    }

    // No rename needed — names are already correct
    renames.push({
      id: product.id,
      sku: product.sku,
      brand: product.brands?.name || 'INAX',
      variant_group: variantGroup,
      old_name: product.name,
      new_name: product.name,
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

  const csvPath = path.join(OUTPUT_DIR, 'phase3-lavabo-rename-preview.csv');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');
  console.log(`  📄 Written: ${csvPath}`);

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  const changedCount = renames.filter(r => r.changed === 'YES').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 3 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Products flagged is_combo:    ${totalCombo}`);
  console.log(`  INAX variant_group set:       ${inaxBw.length}`);
  console.log(`  Existing rels updated:        ${existingRelsUpdated}`);
  console.log(`  New rels created:             ${totalRels}`);
  console.log(`  Renames generated:            ${renames.length}`);
  console.log(`  Renames with changes:         ${changedCount}`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — No changes made. Run with --execute to apply.`);
  } else {
    console.log(`\n✅ Phase 3 EXECUTED successfully!`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
