/**
 * Phase 6A: Strip Duplicate SKU from Product Names
 * 
 * Problem: ~2,995 products have their SKU appended twice at the end of the name.
 * Example: "Vòi bồn tắm GROHE 19577001 19577001" → "Vòi bồn tắm GROHE 19577001"
 * 
 * This script:
 * 1. Finds all products where name ends with " {SKU}"
 * 2. Strips the trailing duplicate SKU
 * 3. Regenerates slug from cleaned name
 * 4. Creates 301 redirects for changed slugs
 * 
 * Usage:
 *   npx tsx scripts/variant-pipeline/phase6a-strip-dup-sku.ts --dry-run
 *   npx tsx scripts/variant-pipeline/phase6a-strip-dup-sku.ts --execute
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const isDryRun = !process.argv.includes('--execute');

// Subcategories to skip (already processed or intentionally excluded)
const SKIP_SUBCATS = [
  // Gạch ốp lát — user confirmed keep as-is
  'gach-thiet-ke-xi-mang',
  'gach-van-da-marble', 
  'gach-trang-tri',
  'gach-van-da-tu-nhien',
  'gach-van-go',
];

interface RenameEntry {
  id: number;
  sku: string;
  oldName: string;
  newName: string;
  oldSlug: string;
  newSlug: string;
  subcategory: string;
  brand: string;
}

/**
 * Generate URL-friendly slug from Vietnamese text
 */
function generateSlug(text: string): string {
  const map: Record<string, string> = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'đ': 'd',
    'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
    'Đ': 'D',
  };

  return text
    .split('')
    .map(c => map[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

/**
 * Check if the product name ends with a duplicate of the SKU.
 * SAFETY: Only strips if the SKU (or a recognizable portion) still appears
 * in the cleaned name. This prevents losing the only SKU reference.
 */
function detectDuplicateSku(name: string, sku: string): string | null {
  if (!name || !sku) return null;
  
  const trimmedName = name.trim();
  const trimmedSku = sku.trim();
  
  // Direct match: name ends with " SKU"
  if (!trimmedName.endsWith(' ' + trimmedSku)) return null;
  
  const cleanedName = trimmedName.slice(0, -(trimmedSku.length + 1)).trim();
  
  // Sanity: cleaned name must be meaningful
  if (cleanedName.length <= 10) return null;

  // Normalize for comparison: strip special chars, lowercase
  const normalize = (s: string) => s.replace(/[-\\/#+().\s]/g, '').toLowerCase();
  const skuNorm = normalize(trimmedSku);
  const nameNorm = normalize(cleanedName);
  
  // Check if SKU (or significant portion) still appears in cleaned name
  // Use first 5+ chars of normalized SKU as a recognizable fingerprint
  const fingerprint = skuNorm.substring(0, Math.min(skuNorm.length, Math.max(5, Math.floor(skuNorm.length * 0.6))));
  
  if (nameNorm.includes(fingerprint)) {
    // SKU still identifiable in cleaned name — safe to strip duplicate
    return cleanedName;
  }
  
  // SKU NOT found in cleaned name — this is the ONLY occurrence
  // Do NOT strip — the trailing "SKU" is informational, not a duplicate
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  PHASE 6A: STRIP DUPLICATE SKU FROM NAMES');
  console.log('  Mode:', isDryRun ? 'DRY RUN' : 'EXECUTE');
  console.log('='.repeat(60));

  // Get all active products excluding gạch and already-processed
  const products = await prisma.$queryRaw`
    SELECT p.id, p.sku, p.name, p.slug, s.slug as subcat, b.name as brand
    FROM products p
    JOIN subcategories s ON p.subcategory_id = s.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.is_active = true
    AND p.variant_group IS NULL
    AND s.slug NOT IN ('gach-thiet-ke-xi-mang', 'gach-van-da-marble', 'gach-trang-tri', 'gach-van-da-tu-nhien', 'gach-van-go')
    ORDER BY s.slug, b.name, p.sku
  ` as any[];

  console.log('\nTotal candidates:', products.length);

  const renames: RenameEntry[] = [];
  const skipped: { sku: string; name: string; reason: string }[] = [];

  for (const p of products) {
    const cleanedName = detectDuplicateSku(p.name, p.sku);
    
    if (!cleanedName) {
      // Name doesn't end with duplicate SKU — skip
      continue;
    }

    const newSlug = generateSlug(cleanedName);

    if (newSlug === p.slug || !newSlug) {
      // Slug didn't change — just fix name
    }

    renames.push({
      id: p.id,
      sku: p.sku,
      oldName: p.name,
      newName: cleanedName,
      oldSlug: p.slug,
      newSlug: newSlug || p.slug,
      subcategory: p.subcat,
      brand: p.brand || '',
    });
  }

  console.log('Products to rename:', renames.length);
  console.log('');

  // Group by subcategory for reporting
  const bySubcat: Record<string, RenameEntry[]> = {};
  for (const r of renames) {
    if (!bySubcat[r.subcategory]) bySubcat[r.subcategory] = [];
    bySubcat[r.subcategory].push(r);
  }

  console.log('Breakdown by subcategory:');
  for (const [subcat, entries] of Object.entries(bySubcat).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${subcat}: ${entries.length}`);
  }

  // Check for slug collisions
  console.log('\nChecking slug collisions...');
  const slugMap: Record<string, string[]> = {};
  for (const r of renames) {
    if (r.oldSlug !== r.newSlug) {
      if (!slugMap[r.newSlug]) slugMap[r.newSlug] = [];
      slugMap[r.newSlug].push(r.sku);
    }
  }

  // Also check against existing slugs in DB
  let collisions = 0;
  for (const [newSlug, skus] of Object.entries(slugMap)) {
    if (skus.length > 1) {
      collisions++;
      if (collisions <= 5) {
        console.log(`  ⚠️ Internal collision: "${newSlug}" → ${skus.join(', ')}`);
      }
    }
  }

  // Check against DB existing slugs
  const existingSlugs = await prisma.$queryRaw`
    SELECT slug FROM products WHERE is_active = true
  ` as any[];
  const existingSlugSet = new Set(existingSlugs.map((s: any) => s.slug));
  
  let dbCollisions = 0;
  for (const r of renames) {
    if (r.oldSlug !== r.newSlug && existingSlugSet.has(r.newSlug)) {
      // Check if the existing slug is actually this same product
      const existing = renames.find(x => x.oldSlug === r.newSlug);
      if (!existing) {
        dbCollisions++;
        if (dbCollisions <= 5) {
          console.log(`  ⚠️ DB collision: "${r.newSlug}" already exists (SKU: ${r.sku})`);
        }
      }
    }
  }

  console.log(`Internal collisions: ${collisions}`);
  console.log(`DB collisions: ${dbCollisions}`);

  // Write CSV preview
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const csvLines = ['sku,brand,subcategory,old_name,new_name,old_slug,new_slug,slug_changed'];
  for (const r of renames) {
    csvLines.push([
      `"${r.sku}"`,
      `"${r.brand}"`,
      `"${r.subcategory}"`,
      `"${r.oldName.replace(/"/g, '""')}"`,
      `"${r.newName.replace(/"/g, '""')}"`,
      `"${r.oldSlug}"`,
      `"${r.newSlug}"`,
      r.oldSlug !== r.newSlug ? 'YES' : 'NO',
    ].join(','));
  }
  fs.writeFileSync(path.join(outputDir, 'phase6a-rename-preview.csv'), csvLines.join('\n'));
  console.log('\n📄 Preview CSV:', path.join(outputDir, 'phase6a-rename-preview.csv'));

  // Show samples
  console.log('\n═══ SAMPLES ═══');
  const sampleSubcats = Object.keys(bySubcat).slice(0, 6);
  for (const subcat of sampleSubcats) {
    const entries = bySubcat[subcat];
    console.log(`\n  [${subcat}]`);
    for (const e of entries.slice(0, 2)) {
      console.log(`    BEFORE: ${e.oldName.substring(0, 70)}`);
      console.log(`    AFTER:  ${e.newName.substring(0, 70)}`);
    }
  }

  if (isDryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('  PHASE 6A SUMMARY — DRY RUN');
    console.log('='.repeat(60));
    console.log(`  Products to rename:       ${renames.length}`);
    console.log(`  Slug changes:             ${renames.filter(r => r.oldSlug !== r.newSlug).length}`);
    console.log(`  Internal collisions:      ${collisions}`);
    console.log(`  DB collisions:            ${dbCollisions}`);
    console.log('='.repeat(60));
    console.log('\n⚠️  DRY RUN — No changes made. Run with --execute to apply.');
  } else {
    // EXECUTE: Apply renames
    console.log('\n🔄 Applying renames...');
    let renamed = 0;
    let redirects = 0;
    let errors = 0;

    for (const r of renames) {
      try {
        // Update product name and slug
        const updateData: any = { name: r.newName };
        
        if (r.oldSlug !== r.newSlug) {
          // Check for DB collision before updating slug
          const existing = await prisma.products.findFirst({
            where: { slug: r.newSlug, id: { not: r.id } },
          });
          
          if (existing) {
            // Collision — keep old slug, only update name
            console.log(`  ⚠️ Slug collision for ${r.sku}, keeping old slug`);
          } else {
            updateData.slug = r.newSlug;
          }
        }

        await prisma.products.update({
          where: { id: r.id },
          data: updateData,
        });
        renamed++;

        // Create redirect if slug changed
        if (updateData.slug && r.oldSlug !== updateData.slug) {
          await prisma.slug_redirects.create({
            data: {
              old_slug: r.oldSlug,
              new_slug: updateData.slug,
              entity_type: 'product',
              entity_id: r.id,
            },
          }).catch(() => {
            // Ignore duplicate redirect errors
          });
          redirects++;
        }
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          console.log(`  ❌ Error for ${r.sku}: ${err.message?.substring(0, 60)}`);
        }
      }
    }

    // Generate redirect JSON
    const redirectEntries = renames
      .filter(r => r.oldSlug !== r.newSlug)
      .map(r => ({
        source: '/san-pham/' + r.oldSlug,
        destination: '/san-pham/' + r.newSlug,
        permanent: true,
      }));
    
    fs.writeFileSync(
      path.join(outputDir, 'phase6a-redirects.json'),
      JSON.stringify(redirectEntries, null, 2)
    );

    console.log('\n' + '='.repeat(60));
    console.log('  PHASE 6A SUMMARY — EXECUTED');
    console.log('='.repeat(60));
    console.log(`  Products renamed:         ${renamed}/${renames.length}`);
    console.log(`  Slug redirects created:   ${redirects}`);
    console.log(`  Errors:                   ${errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Phase 6A EXECUTED successfully!');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
