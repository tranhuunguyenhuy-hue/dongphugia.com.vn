import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const BATCH_SIZE = 100;
const isDryRun = !process.argv.includes('--execute');

const SUB_BON_CAU = 1;
const SUB_NAP_BON_CAU = 9;
const SUB_PHU_KIEN = 32; // ID của Phụ Kiện Bồn Cầu
const SUB_THAN_BON_CAU = 33; // ID của Thân Bồn Cầu

// ----------------------------------------------------------------------
// THUẬT TOÁN PHÂN LOẠI & CLEANUP
// ----------------------------------------------------------------------

// 1. Phân loại Category
function determineNewSubcategoryId(name: string, currentSubId: number): number | null {
  const lowerName = name.toLowerCase();

  // Nắp bồn cầu (1.1)
  // PHẢI dùng startsWith vì bồn cầu thường có đuôi "kèm nắp đóng êm"
  if (
    lowerName.startsWith('nắp') ||
    lowerName.startsWith('bệ ngồi') ||
    lowerName.startsWith('nắp che')
  ) {
    return SUB_NAP_BON_CAU;
  }

  // Thân bồn cầu (1.3)
  if (
    lowerName.includes('thân bồn cầu') ||
    lowerName.includes('thân cầu')
  ) {
    // Để ý tránh dính "thân đế thải" (là phụ kiện)
    if (!lowerName.includes('đế thải')) {
      return SUB_THAN_BON_CAU;
    }
  }

  // Phụ kiện Bồn Cầu (1.2)
  if (!lowerName.startsWith('bồn cầu') && !lowerName.startsWith('bàn cầu')) {
    if (
      lowerName.includes('két nước') ||
      lowerName.includes('nút nhấn') ||
      lowerName.includes('nút xả') ||
      lowerName.includes('van góc') ||
      lowerName.includes('van khóa') ||
      lowerName.includes('ống nối') ||
      lowerName.includes('ống thoát') ||
      lowerName.includes('ống xả') ||
      lowerName.includes('bộ đế') ||
      lowerName.includes('linh kiện') ||
      lowerName.includes('trụ xả') ||
      lowerName.includes('trụ cấp') ||
      lowerName.includes('bích nối') ||
      lowerName.includes('đế thải') ||
      lowerName.includes('dây cấp') ||
      lowerName.includes('gioăng') ||
      lowerName.includes('bộ xả') ||
      lowerName.includes('van cấp') ||
      lowerName.includes('mặt nạ xả') ||
      lowerName.includes('bộ đệm') ||
      lowerName.includes('cao su non') ||
      lowerName.includes('chốt nắp') ||
      lowerName.includes('chốt đóng êm') ||
      lowerName.includes('tấm trượt') ||
      lowerName.includes('đế washlet') ||
      lowerName.includes('mũ chụp')
    ) {
      return SUB_PHU_KIEN;
    }
  }

  return null; // Không đổi id
}

// 2. Clean Name (1.5)
function cleanProductName(name: string, sku: string | null): string | null {
  if (!sku) return null;
  // Nhiều sản phẩm bị dư thông tin kiểu: "Bồn Cầu 2 Khối INAX C-306VAN (C306VAN) nắp đóng êm C-306VAN/BW1"
  // hoặc "C-306VAN" lặp ở cuối
  const skuVariants = [
    sku,
    sku.replace(/-/g, ''), // C-306VAN -> C306VAN
    sku + '/BW1', // INAX white code
    sku + '#W',   // TOTO white code
    sku + '#XW',
    sku + '#NW1'
  ];

  let newName = name;
  let changed = false;

  // Dọn dẹp khoảng trắng liên tiếp và trim
  const normalizeSpaces = (str: string) => str.replace(/\s+/g, ' ').trim();

  // Try removing sku at the very end of the string
  for (const variant of skuVariants) {
    if (!variant) continue;
    // Kiểm tra nếu tên CÓ KẾT THÚC bằng biến thể của SKU (có khoảng trắng trước đó)
    const suffixPattern = new RegExp(`\\s+${variant.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')}$`, 'i');
    if (suffixPattern.test(newName)) {
      newName = newName.replace(suffixPattern, '');
      changed = true;
    }
  }

  // Loại bỏ cụm sku trong ngoặc (VD: "(C306VAN)") nếu nó đúng bằng sku
  const skuInBrackets1 = `(${sku})`;
  const skuInBrackets2 = `(${sku.replace(/-/g, '')})`;
  if (newName.includes(skuInBrackets1)) {
    newName = newName.replace(skuInBrackets1, '');
    changed = true;
  }
  if (newName.includes(skuInBrackets2)) {
    newName = newName.replace(skuInBrackets2, '');
    changed = true;
  }
  
  newName = normalizeSpaces(newName);
  
  return changed ? newName : null;
}


// ----------------------------------------------------------------------
// MAIN EXECUTION
// ----------------------------------------------------------------------
async function main() {
  console.log(`🚀 Bắt đầu ${isDryRun ? 'DRY RUN' : 'PRODUCTION RUN'} Phase 1 Data Cleanup\n`);
  
  let totalProcessed = 0;
  let reclassifiedToNap = 0;
  let reclassifiedToPhuKien = 0;
  let reclassifiedToThan = 0;
  let namesCleaned = 0;

  let cursorId: number | undefined;

  while (true) {
    // Chỉ lấy sản phẩm trong subcategory=1 (Bồn Cầu)
    const products = await prisma.products.findMany({
      where: { subcategory_id: SUB_BON_CAU },
      take: BATCH_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { id: 'asc' }
    });

    if (products.length === 0) break;

    for (const product of products) {
      totalProcessed++;
      const currentName = product.name || '';
      
      const newSubId = determineNewSubcategoryId(currentName, product.subcategory_id!);
      const newName = cleanProductName(currentName, product.sku);

      const isSubChanged = newSubId !== null;
      const isNameChanged = newName !== null;

      if (isSubChanged || isNameChanged) {
        // Log changes
        if (isSubChanged) {
          const typeStr = newSubId === SUB_NAP_BON_CAU ? 'NẮP' : newSubId === SUB_PHU_KIEN ? 'PHỤ KIỆN' : 'THÂN CẦU';
          console.log(`📦 [MOVE -> ${typeStr}] ID:${product.id}`);
          console.log(`  - Current: ${currentName}`);
          
          if (newSubId === SUB_NAP_BON_CAU) reclassifiedToNap++;
          if (newSubId === SUB_PHU_KIEN) reclassifiedToPhuKien++;
          if (newSubId === SUB_THAN_BON_CAU) reclassifiedToThan++;
        }
        
        if (isNameChanged && newName) {
           console.log(`🏷️  [CLEAN NAME] ID:${product.id}`);
           console.log(`  - Old: ${currentName}`);
           console.log(`  - New: ${newName}`);
           namesCleaned++;
        }

        // Execute if not dry run
        if (!isDryRun) {
          await prisma.products.update({
            where: { id: product.id },
            data: {
              ...(isSubChanged && newSubId ? { subcategory_id: newSubId } : {}),
              ...(isNameChanged && newName ? { name: newName } : {})
            }
          });
        }
      }
    }

    cursorId = products[products.length - 1].id;
  }
  
  // Phase 1.5 mở rộng dọn dẹp name cho các sp bồn cầu thuần tuý đang nằm ngoài batch trên (Bồn cầu đã là sub=1, nhưng ta cần dọn cho các category khác? Chờ đã, `cleanProductName` đã apply trên cùng batch). 
  // Nắp bồn cầu cũ (sub=9) cũng có thể bị lặp SKU
  let napCursor: number | undefined;
  while (true) {
    const naps = await prisma.products.findMany({
      where: { subcategory_id: SUB_NAP_BON_CAU },
      take: BATCH_SIZE,
      ...(napCursor ? { cursor: { id: napCursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' }
    });
    if (naps.length === 0) break;

    for (const nap of naps) {
       const newName = cleanProductName(nap.name||'', nap.sku);
       if (newName) {
           console.log(`🏷️  [CLEAN NAME - Nắp Cũ] ID:${nap.id}`);
           console.log(`  - Old: ${nap.name}`);
           console.log(`  - New: ${newName}`);
           namesCleaned++;
           
           if (!isDryRun) {
               await prisma.products.update({
                   where: { id: nap.id },
                   data: { name: newName }
               });
           }
       }
    }
    napCursor = naps[naps.length - 1].id;
  }


  // Report
  console.log('\n======================================================');
  console.log(`🎯 KẾT QUẢ ${isDryRun ? 'DRY RUN' : 'THỰC THI'} PHASE 1`);
  console.log('======================================================');
  console.log(`Tổng kiểm tra (Sub=1): ${totalProcessed} sản phẩm`);
  console.log(`🔄 Chuyển sang Nắp Bồn Cầu (Sub=${SUB_NAP_BON_CAU}): ${reclassifiedToNap} sp`);
  console.log(`🔄 Chuyển sang Phụ Kiện Bồn Cầu (Sub=${SUB_PHU_KIEN}): ${reclassifiedToPhuKien} sp`);
  console.log(`🔄 Chuyển sang Thân Bồn Cầu (Sub=${SUB_THAN_BON_CAU}): ${reclassifiedToThan} sp`);
  console.log(`✨ Số tên sản phẩm được dọn dẹp SKU đuôi: ${namesCleaned} sp`);
  
  if (isDryRun) {
    console.log('\n💡 Đây chỉ là DRY RUN. Để chạy thật và update DB, dùng:');
    console.log('   npx tsx scripts/db/phase1-cleanup.mts --execute');
  } else {
    console.log('\n✅ UPDATE THÀNH CÔNG VÀO DATABASE.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
