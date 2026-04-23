/**
 * A3: Parse và clean 223 combo product names
 * 
 * Patterns cần xử lý:
 * 1. Combo SKU ghép: "Bộ bồn cầu Duravit 2561090000 + 0020390000 + WD..." → clean name + extract components
 * 2. Double SKU: "D-code Duravit 0339550000 0339550000" → remove duplicate
 * 3. #XW suffix: "LT367CR#XW" cuối tên → remove
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/fix-product-names.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';
const isDryRun = !process.argv.includes('--execute');
const p = new PrismaClient();

/**
 * Parse SKU list from combo product names
 * "Bộ bồn cầu Duravit 2561090000 + 0020390000 + WD1011000000" 
 * → { displayName: "Bộ bồn cầu Duravit", components: ["2561090000", "0020390000", "WD1011000000"] }
 */
function parseComboName(name: string, sku: string): {
  displayName: string;
  components: string[];
  pattern: string;
} {
  // Pattern 1: Combo SKU ghép với dấu +
  // SKU = "AC-959A+CW-S15VN/BW1" → components = ["AC-959A", "CW-S15VN/BW1"]
  // Tên = "Bồn cầu 1 khối nắp rửa cơ INAX AC-959A + CW-S15VN AC-959A+CW-S15VN/BW1"
  // → display_name = "Bồn cầu 1 khối nắp rửa cơ INAX AC-959A" (giữ SKU đầu = model chính)
  if (sku.includes('+')) {
    const componentSkus = sku.split('+').map(s => s.trim()).filter(Boolean);
    const firstSku = componentSkus[0];
    
    // Tìm vị trí CUỐI của SKU đầu tiên trong tên (ngay trước " + ")
    const firstSkuIdx = name.indexOf(firstSku);
    if (firstSkuIdx > 0) {
      // Tên sạch = tất cả trước khi SKU thứ 2 bắt đầu
      // Tìm vị trí " + SKU2" hoặc " SKU1+SKU2"
      const secondSku = componentSkus[1];
      
      // Vị trí " + [secondSku]"
      const plusIdx = name.indexOf(' + ' + secondSku);
      // Fallback: vị trí " [firstSku]+" (dấu + dính)
      const directPlusIdx = name.indexOf(firstSku + '+');
      
      let cutAt = -1;
      if (plusIdx > 0) {
        cutAt = plusIdx; // Cắt tại " + SKU2"
      } else if (directPlusIdx > 0) {
        cutAt = directPlusIdx + firstSku.length; // Cắt tại "+"
        // Quay lại tìm vị trí đầu của firstSku lần 2 (dạng lặp)
        const afterFirst = name.indexOf(' ' + firstSku, firstSkuIdx + firstSku.length);
        if (afterFirst > 0) cutAt = afterFirst;
      }

      if (cutAt > 5) {
        const displayName = name.substring(0, cutAt).trim();
        return { displayName, components: componentSkus, pattern: 'combo-plus' };
      }
    }
  }

  // Pattern 2: Double SKU cuối tên — "LT367CR LT367CR#XW" hoặc "0339550000 0339550000"
  if (sku) {
    // Tên kết thúc bằng SKU bị duplicate (xuất hiện 2 lần liên tiếp)
    const skuPattern = escapeRegex(sku.split('+')[0]); // Lấy base SKU
    const doubleMatch = name.match(new RegExp(`^(.+?)\\s+(\\S+)\\s+${skuPattern}(\\S*)\\s*$`));
    if (doubleMatch) {
      return { displayName: doubleMatch[1].trim() + ' ' + doubleMatch[2].trim(), components: [sku], pattern: 'double-sku' };
    }
    
    // Tên kết thúc đúng = SKU (trailing SKU)
    if (name.endsWith(' ' + sku)) {
      const cleaned = name.slice(0, name.lastIndexOf(' ' + sku)).trim();
      if (cleaned.length > 5) {
        return { displayName: cleaned, components: [sku], pattern: 'trailing-sku' };
      }
    }
  }

  // Pattern 3: #XW suffix (TOTO: "LT367CR#XW" cuối tên)
  if (name.includes('#')) {
    const withoutXW = name.replace(/\s+\S+#[A-Z]+\d*\s*$/, '').trim();
    if (withoutXW !== name && withoutXW.length > 5) {
      return { displayName: withoutXW, components: [sku], pattern: 'xw-suffix' };
    }
  }

  return { displayName: name, components: [], pattern: 'none' };
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  console.log(`\n🔧 Fix Product Names — Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  // Lấy tất cả sp cần fix
  const products = await p.products.findMany({
    where: {
      is_active: true,
      OR: [
        { name: { contains: '+' } },
        { sku: { contains: '+' } },
      ]
    },
    select: { id: true, name: true, sku: true },
    orderBy: { id: 'asc' }
  });

  // Thêm products có #XW trong SKU nhưng tên chưa clean
  const xwProducts = await p.products.findMany({
    where: {
      is_active: true,
      sku: { endsWith: '#XW' }
    },
    select: { id: true, name: true, sku: true }
  });

  const allToProcess = [...products, ...xwProducts.filter(x => !products.find(p => p.id === x.id))];

  console.log(`📦 Tổng sản phẩm cần xử lý: ${allToProcess.length}\n`);

  const results: { id: number; oldName: string; newName: string; components: string[]; pattern: string }[] = [];
  const skipped: { id: number; name: string; reason: string }[] = [];

  for (const product of allToProcess) {
    const { displayName, components, pattern } = parseComboName(product.name, product.sku || '');
    
    if (pattern === 'none' || displayName === product.name) {
      skipped.push({ id: product.id, name: product.name.substring(0, 60), reason: 'no change needed' });
      continue;
    }

    if (displayName.length < 5) {
      skipped.push({ id: product.id, name: product.name.substring(0, 60), reason: 'display_name too short, skip' });
      continue;
    }

    results.push({
      id: product.id,
      oldName: product.name,
      newName: displayName,
      components,
      pattern
    });
  }

  // Group by pattern
  const byPattern = results.reduce((acc, r) => {
    acc[r.pattern] = (acc[r.pattern] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Phân tích patterns:');
  Object.entries(byPattern).forEach(([k, v]) => console.log(`   ${k}: ${v} sp`));
  console.log(`   unchanged/skipped: ${skipped.length} sp\n`);

  // Preview
  console.log('📝 Preview (first 10):');
  results.slice(0, 10).forEach(r => {
    console.log(`\n  ID:${r.id} [${r.pattern}]`);
    console.log(`  OLD: ${r.oldName.substring(0, 100)}`);
    console.log(`  NEW: ${r.newName}`);
    if (r.components.length > 0) console.log(`  PARTS: [${r.components.join(', ')}]`);
  });

  if (!isDryRun) {
    console.log('\n⚡ Executing updates...');
    let updated = 0;
    for (const r of results) {
      await p.products.update({
        where: { id: r.id },
        data: {
          display_name: r.newName,
          // Note: component_skus column needs to be added via ALTER TABLE first
          // Will be filled once column exists
        }
      });
      updated++;
      if (updated % 20 === 0) console.log(`   Updated ${updated}/${results.length}...`);
    }
    console.log(`\n✅ Updated ${updated} products`);
  } else {
    console.log(`\n💡 Run với --execute để thực thi ${results.length} updates`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
