/**
 * PHASE 4: BỒN TẮM + BỒN TIỂU + PHỤ KIỆN — Variant Pipeline
 *
 * Processes multiple categories:
 *  - Batch 4A: 53 TOTO Bồn Tắm slash + 12 INAX color + 2 MOEN plus
 *  - Batch 4B: 4 TOTO Bồn Tiểu slash + 16 INAX color + 1 ATMOR slash + 1 ATMOR plus
 *  - Batch 4C: 1 ATMOR Phụ Kiện plus + 2 INAX color
 *
 * Usage:
 *   npx tsx scripts/variant-pipeline/phase4-mixed.ts --dry-run
 *   npx tsx scripts/variant-pipeline/phase4-mixed.ts --execute
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extractProductType, generateSlug, type ComponentType } from './utils';

/**
 * Clean TOTO SKU: strip standard white codes (#W, #XW) but preserve
 * color variants (#GW, #MW, #P, #S) to avoid slug collisions.
 */
function cleanTotoSku(rawPart: string): string {
  // Standard white codes to strip completely
  const standardWhite = /^#(W|XW)$/;
  const hashIdx = rawPart.indexOf('#');
  if (hashIdx === -1) return rawPart;
  
  const base = rawPart.substring(0, hashIdx);
  const colorCode = rawPart.substring(hashIdx);
  
  if (standardWhite.test(colorCode)) {
    return base; // strip standard white
  }
  // Keep non-standard color in the SKU for uniqueness
  return rawPart.replace('#', '-');
}

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--execute');
const OUTPUT_DIR = path.join(__dirname, 'output');

// ──────────────────────────────────────────
// TOTO Bồn Tắm component type detection
// ──────────────────────────────────────────
const TOTO_BATHTUB_PREFIX_MAP: Record<string, ComponentType> = {
  'PJY':  'body',       // Bồn tắm đặt sàn
  'PPY':  'body',       // Bồn tắm yếm / ngọc trai
  'PAY':  'body',       // Bồn tắm
  'TVBF': 'drain',      // Bộ xả thải
  'DB':   'frame',      // Tay vịn / khung
  'TBG':  'faucet',     // Vòi xả bồn tắm
  'TBP':  'faucet',     // Vòi xả bồn tắm
  'TBN':  'valve',      // Đế vòi / van
};

const TOTO_BATHTUB_LABEL_MAP: Record<string, string> = {
  body: 'bồn',
  drain: 'bộ xả',
  frame: 'tay vịn',
  faucet: 'vòi',
  valve: 'đế vòi',
  component: '',
};

// TOTO Bồn Tiểu
const TOTO_URINAL_PREFIX_MAP: Record<string, ComponentType> = {
  'U':    'body',      // Bồn tiểu
  'USWN': 'body',     // Bồn tiểu thông minh
  'F':    'pedestal', // Chân
  'DU':   'valve',    // Van xả nhấn
  'HHF':  'valve',    // Van cảm ứng
};

const TOTO_URINAL_LABEL_MAP: Record<string, string> = {
  body: 'bồn',
  pedestal: 'chân',
  valve: 'van xả',
  component: '',
};

function detectComponentType(
  sku: string,
  prefixMap: Record<string, ComponentType>,
): ComponentType {
  const clean = sku.replace(/#.*$/, '');
  // Sort by length descending for longest match first
  const sorted = Object.keys(prefixMap).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (clean.startsWith(prefix)) {
      return prefixMap[prefix];
    }
  }
  return 'component';
}

// ──────────────────────────────────────────
// Rename
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

interface ParsedPart {
  sku: string;
  type: ComponentType;
}

function generateComboName(
  productName: string,
  brandName: string,
  primarySku: string,
  accessories: ParsedPart[],
  labelMap: Record<string, string>,
): string {
  let productType = extractProductType(productName);

  // Strip brand from productType to avoid duplication
  const brandPattern = new RegExp(`\\s+${brandName}$`, 'i');
  productType = productType.replace(brandPattern, '').trim();

  if (accessories.length === 0) {
    return `${productType} ${brandName} ${primarySku}`;
  }

  const accessoryDesc = accessories
    .map(c => {
      const typeLabel = labelMap[c.type] || '';
      return typeLabel ? `${typeLabel} ${c.sku}` : c.sku;
    })
    .join(', ');

  return `${productType} ${brandName} ${primarySku} kèm ${accessoryDesc}`;
}

// ──────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 4: BỒN TẮM + BỒN TIỂU + PHỤ KIỆN — ${DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const renames: RenameEntry[] = [];
  let totalCombo = 0;
  let totalColorVariant = 0;
  let totalNewRels = 0;

  // ═══════════════════════════════════════════
  // BATCH 4A: BỒN TẮM
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 4A: BỒN TẮM`);
  console.log(`${'─'.repeat(50)}`);

  // 4A.1: TOTO slash combos (53)
  const totoBonTam = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tam' },
      is_active: true,
      brands: { slug: 'toto' },
      sku: { contains: '/' },
    },
    include: { brands: { select: { name: true } }, parent_relationships: true },
    orderBy: { sku: 'asc' },
  });

  console.log(`  TOTO slash: ${totoBonTam.length}`);

  for (const product of totoBonTam) {
    const parts = product.sku.split('/').map(p => p.trim()).filter(Boolean);
    const parsedParts: ParsedPart[] = parts.map(part => ({
      sku: cleanTotoSku(part),
      type: detectComponentType(part, TOTO_BATHTUB_PREFIX_MAP),
    }));

    // Primary = body (PJY/PPY/PAY)
    const bodyComp = parsedParts.find(c => c.type === 'body');
    const variantGroup = bodyComp?.sku || parsedParts[0]?.sku || null;
    const primarySku = parsedParts[0]?.sku || '';
    const accessories = parsedParts.slice(1);

    totalCombo++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: true, variant_group: variantGroup },
      });
    }

    // Create rels
    const existingChildSkus = new Set(product.parent_relationships.map(r => r.child_sku));
    for (const comp of parsedParts) {
      if (!existingChildSkus.has(comp.sku)) {
        totalNewRels++;
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

    const newName = generateComboName(
      product.name, 'TOTO', primarySku, accessories, TOTO_BATHTUB_LABEL_MAP,
    );
    const newSlug = generateSlug(newName);

    renames.push({
      id: product.id, sku: product.sku, brand: 'TOTO',
      variant_group: variantGroup || '',
      old_name: product.name, new_name: newName,
      old_slug: product.slug, new_slug: newSlug,
      changed: product.name !== newName ? 'YES' : 'NO',
    });
  }

  // 4A.2: INAX /BW1 color codes (12)
  const inaxBonTam = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tam' },
      is_active: true,
      brands: { slug: 'inax' },
      sku: { contains: '/BW1' },
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  INAX /BW1 color: ${inaxBonTam.length}`);

  for (const product of inaxBonTam) {
    const baseModel = product.sku.split('/')[0];
    const variantGroup = baseModel.replace(/[-]/g, '');
    totalColorVariant++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: false, variant_group: variantGroup },
      });
    }

    renames.push({
      id: product.id, sku: product.sku, brand: 'INAX',
      variant_group: variantGroup,
      old_name: product.name, new_name: product.name,
      old_slug: product.slug, new_slug: product.slug,
      changed: 'NO',
    });
  }

  // 4A.3: MOEN plus combos (2)
  const moenBonTam = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tam' },
      is_active: true,
      sku: { contains: '+' },
    },
    include: { brands: { select: { name: true, slug: true } }, parent_relationships: true },
    orderBy: { sku: 'asc' },
  });

  console.log(`  MOEN plus: ${moenBonTam.length}`);

  for (const product of moenBonTam) {
    const parts = product.sku.split('+').map(p => p.trim()).filter(Boolean);
    const primarySku = parts[0] || '';
    const accessories = parts.slice(1).map(s => ({ sku: s, type: 'component' as ComponentType }));

    totalCombo++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: true, variant_group: primarySku },
      });
    }

    const brandName = product.brands?.name || 'MOEN';
    const newName = generateComboName(
      product.name, brandName, primarySku, accessories, TOTO_BATHTUB_LABEL_MAP,
    );
    const newSlug = generateSlug(newName);

    renames.push({
      id: product.id, sku: product.sku, brand: brandName,
      variant_group: primarySku,
      old_name: product.name, new_name: newName,
      old_slug: product.slug, new_slug: newSlug,
      changed: product.name !== newName ? 'YES' : 'NO',
    });
  }

  // ═══════════════════════════════════════════
  // BATCH 4B: BỒN TIỂU
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 4B: BỒN TIỂU`);
  console.log(`${'─'.repeat(50)}`);

  // 4B.1: TOTO slash combos
  const totoBonTieu = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tieu' },
      is_active: true,
      brands: { slug: 'toto' },
      sku: { contains: '/' },
    },
    include: { brands: { select: { name: true } }, parent_relationships: true },
    orderBy: { sku: 'asc' },
  });

  console.log(`  TOTO slash: ${totoBonTieu.length}`);

  for (const product of totoBonTieu) {
    const parts = product.sku.split('/').map(p => p.trim()).filter(Boolean);
    const parsedParts: ParsedPart[] = parts.map(part => ({
      sku: cleanTotoSku(part),
      type: detectComponentType(part, TOTO_URINAL_PREFIX_MAP),
    }));

    const bodyComp = parsedParts.find(c => c.type === 'body');
    const variantGroup = bodyComp?.sku || parsedParts[0]?.sku || null;
    const primarySku = parsedParts[0]?.sku || '';
    const accessories = parsedParts.slice(1);

    totalCombo++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: true, variant_group: variantGroup },
      });
    }

    const existingChildSkus = new Set(product.parent_relationships.map(r => r.child_sku));
    for (const comp of parsedParts) {
      if (!existingChildSkus.has(comp.sku)) {
        totalNewRels++;
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

    const newName = generateComboName(
      product.name, 'TOTO', primarySku, accessories, TOTO_URINAL_LABEL_MAP,
    );
    const newSlug = generateSlug(newName);

    renames.push({
      id: product.id, sku: product.sku, brand: 'TOTO',
      variant_group: variantGroup || '',
      old_name: product.name, new_name: newName,
      old_slug: product.slug, new_slug: newSlug,
      changed: product.name !== newName ? 'YES' : 'NO',
    });
  }

  // 4B.2: INAX /BW1 color codes
  const inaxBonTieu = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tieu' },
      is_active: true,
      brands: { slug: 'inax' },
      sku: { contains: '/BW1' },
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  INAX /BW1 color: ${inaxBonTieu.length}`);

  for (const product of inaxBonTieu) {
    const baseModel = product.sku.split('/')[0];
    const variantGroup = baseModel.replace(/[-]/g, '');
    totalColorVariant++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: false, variant_group: variantGroup },
      });
    }

    renames.push({
      id: product.id, sku: product.sku, brand: 'INAX',
      variant_group: variantGroup,
      old_name: product.name, new_name: product.name,
      old_slug: product.slug, new_slug: product.slug,
      changed: 'NO',
    });
  }

  // 4B.3: ATMOR slash combo (AT6024/AT-2083)
  const atmorBonTieu = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tieu' },
      is_active: true,
      brands: { slug: 'atmor' },
      sku: { contains: '/' },
      NOT: { sku: { contains: '(' } }, // exclude (AC/DC) which is model spec
    },
    include: { brands: { select: { name: true } }, parent_relationships: true },
  });

  // Also ATMOR plus
  const atmorBonTieuPlus = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'bon-tieu' },
      is_active: true,
      brands: { slug: 'atmor' },
      sku: { contains: '+' },
    },
    include: { brands: { select: { name: true } }, parent_relationships: true },
  });

  const allAtmorBtieu = [...atmorBonTieu, ...atmorBonTieuPlus];
  console.log(`  ATMOR combos: ${allAtmorBtieu.length}`);

  for (const product of allAtmorBtieu) {
    const sep = product.sku.includes('+') ? '+' : '/';
    const parts = product.sku.split(sep).map(p => p.trim()).filter(Boolean);
    const primarySku = parts[0] || '';
    const accessories = parts.slice(1).map(s => ({ sku: s, type: 'valve' as ComponentType }));

    totalCombo++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: true, variant_group: primarySku },
      });
    }

    const newName = generateComboName(
      product.name, 'ATMOR', primarySku, accessories, TOTO_URINAL_LABEL_MAP,
    );
    const newSlug = generateSlug(newName);

    renames.push({
      id: product.id, sku: product.sku, brand: 'ATMOR',
      variant_group: primarySku,
      old_name: product.name, new_name: newName,
      old_slug: product.slug, new_slug: newSlug,
      changed: product.name !== newName ? 'YES' : 'NO',
    });
  }

  // ═══════════════════════════════════════════
  // BATCH 4C: PHỤ KIỆN BỒN CẦU
  // ═══════════════════════════════════════════
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  BATCH 4C: PHỤ KIỆN BỒN CẦU`);
  console.log(`${'─'.repeat(50)}`);

  // ATMOR plus combo
  const atmorPkbc = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'phu-kien-bon-cau' },
      is_active: true,
      brands: { slug: 'atmor' },
      sku: { contains: '+' },
    },
    include: { brands: { select: { name: true } }, parent_relationships: true },
  });

  console.log(`  ATMOR plus: ${atmorPkbc.length}`);

  for (const product of atmorPkbc) {
    const parts = product.sku.split('+').map(p => p.trim()).filter(Boolean);
    const primarySku = parts[0] || '';
    const accessories = parts.slice(1).map(s => ({ sku: s, type: 'component' as ComponentType }));

    totalCombo++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: true, variant_group: primarySku },
      });
    }

    const newName = generateComboName(
      product.name, 'ATMOR', primarySku, accessories, {},
    );
    const newSlug = generateSlug(newName);

    renames.push({
      id: product.id, sku: product.sku, brand: 'ATMOR',
      variant_group: primarySku,
      old_name: product.name, new_name: newName,
      old_slug: product.slug, new_slug: newSlug,
      changed: product.name !== newName ? 'YES' : 'NO',
    });
  }

  // INAX /BW1 color in phụ kiện
  const inaxPkbc = await prisma.products.findMany({
    where: {
      subcategories: { slug: 'phu-kien-bon-cau' },
      is_active: true,
      brands: { slug: 'inax' },
      sku: { contains: '/BW1' },
    },
    orderBy: { sku: 'asc' },
  });

  console.log(`  INAX /BW1 color: ${inaxPkbc.length}`);

  for (const product of inaxPkbc) {
    const baseModel = product.sku.split('/')[0];
    const variantGroup = baseModel.replace(/[-]/g, '');
    totalColorVariant++;

    if (!DRY_RUN) {
      await prisma.products.update({
        where: { id: product.id },
        data: { is_combo: false, variant_group: variantGroup },
      });
    }

    renames.push({
      id: product.id, sku: product.sku, brand: 'INAX',
      variant_group: variantGroup,
      old_name: product.name, new_name: product.name,
      old_slug: product.slug, new_slug: product.slug,
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

  const csvPath = path.join(OUTPUT_DIR, 'phase4-mixed-rename-preview.csv');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');
  console.log(`  📄 Written: ${csvPath}`);

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  const changedCount = renames.filter(r => r.changed === 'YES').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PHASE 4 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total products processed:     ${renames.length}`);
  console.log(`  Combos (is_combo=true):        ${totalCombo}`);
  console.log(`  Color variants (is_combo=false): ${totalColorVariant}`);
  console.log(`  New rels created:              ${totalNewRels}`);
  console.log(`  Renames with changes:          ${changedCount}`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — No changes made. Run with --execute to apply.`);
  } else {
    console.log(`\n✅ Phase 4 EXECUTED successfully!`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
