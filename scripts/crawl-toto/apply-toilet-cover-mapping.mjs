import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu cập nhật danh mục NẮP BỒN CẦU TOTO vào Database...');

  // Danh mục L1
  const CAT_TBVS = 1;
  // Danh mục L2
  const SUBCAT_NAP_BON_CAU = 9;

  const products = await prisma.products.findMany({
    where: {
      brand_id: 1, // TOTO
      OR: [
        { subcategory_id: SUBCAT_NAP_BON_CAU },
        { sku: { startsWith: 'TCF' } },
        { sku: { startsWith: 'TCW' } },
        { sku: { startsWith: 'TC3' } },
        { sku: { startsWith: 'TC6' } },
        { sku: { startsWith: 'TC8' } },
        { sku: { startsWith: 'TC5' } }
      ]
    }
  });

  let updatedCount = 0;

  for (const p of products) {
    // Bỏ qua các mã linh kiện không phải nắp
    if (p.sku.startsWith('TCA') || p.sku.startsWith('TCM') || p.sku.startsWith('TTC')) continue;

    let newCategoryId = CAT_TBVS;
    let newSubcategoryId = SUBCAT_NAP_BON_CAU;
    let newProductType = p.product_type;
    let newName = p.name;

    const skuBase = p.sku.split('#')[0].split('/')[0].toUpperCase();

    // 1. NHÓM NẮP ĐIỆN TỬ (TCF)
    if (skuBase.startsWith('TCF')) {
      newProductType = 'nap-dien-tu';
      
      // Xóa các cụm từ cũ, thay bằng cụm từ thống nhất
      const prefixRegex = /^(?:Nắp rửa điện tử|Nắp bồn cầu thông minh|Nắp bồn cầu rửa điện tử|Nắp thông minh|Nắp rửa điện tử thông minh)(?:\s+Washlet)?/i;
      
      if (prefixRegex.test(newName)) {
        newName = newName.replace(prefixRegex, 'Nắp điện tử thông minh Washlet');
      } else if (!newName.includes('Nắp điện tử thông minh Washlet')) {
        // Fallback nếu tên cũ quá lạ
        newName = `Nắp điện tử thông minh Washlet TOTO ${p.sku}`;
      }
    }
    
    // 2. NHÓM NẮP RỬA CƠ (TCW)
    else if (skuBase.startsWith('TCW')) {
      newProductType = 'nap-rua-co';
      
      const prefixRegex = /^(?:Nắp bồn cầu rửa cơ|Nắp rửa cơ|Nắp bồn cầu đóng êm|Nắp bồn cầu thường)(?:\s+Eco[\s\-]?washer)?/i;
      if (prefixRegex.test(newName)) {
        newName = newName.replace(prefixRegex, 'Nắp rửa cơ Eco-washer');
      } else if (!newName.includes('Nắp rửa cơ Eco-washer')) {
        newName = `Nắp rửa cơ Eco-washer TOTO ${p.sku}`;
      }
    }

    // 3. NHÓM NẮP THƯỜNG / ĐÓNG ÊM (TC)
    else if (skuBase.startsWith('TC')) {
      newProductType = 'nap-thuong-dong-em';
      
      // Xử lý lỗi nghiêm trọng: Mã SKU là cái nắp, nhưng tên là Bồn cầu (combo)
      if (newName.toLowerCase().startsWith('bồn cầu') || newName.toLowerCase().startsWith('thân cầu')) {
        const comboName = newName.split(/kèm/i)[0].trim();
        newName = `Nắp bồn cầu đóng êm TOTO ${skuBase} (Dùng cho ${comboName})`;
      } else {
        const prefixRegex = /^(?:Nắp bồn cầu đóng êm|Nắp đóng êm|Nắp bồn cầu thường|Nắp thường|Nắp bồn cầu)/i;
        if (prefixRegex.test(newName)) {
          newName = newName.replace(prefixRegex, 'Nắp bồn cầu đóng êm');
        } else if (!newName.includes('Nắp bồn cầu đóng êm')) {
          newName = `Nắp bồn cầu đóng êm TOTO ${p.sku}`;
        }
      }
    }

    // THỰC THI CẬP NHẬT
    if (
      p.category_id !== newCategoryId || 
      p.subcategory_id !== newSubcategoryId || 
      p.product_type !== newProductType ||
      p.name !== newName
    ) {
      await prisma.products.update({
        where: { id: p.id },
        data: {
          category_id: newCategoryId,
          subcategory_id: newSubcategoryId,
          product_type: newProductType,
          name: newName
        }
      });
      
      console.log(`✅ [${p.sku}]`);
      if (p.name !== newName) console.log(`   - Tên: ${p.name} -> ${newName}`);
      if (p.product_type !== newProductType) console.log(`   - L3:  ${p.product_type} -> ${newProductType}`);
      
      updatedCount++;
    }
  }

  console.log(`\n🎉 HOÀN TẤT! Đã chuẩn hoá thành công ${updatedCount} sản phẩm NẮP BỒN CẦU TOTO.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
