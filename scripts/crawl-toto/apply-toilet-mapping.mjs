import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu cập nhật chính thức danh mục BỒN CẦU TOTO vào Database...');

  // Danh mục L1
  const CAT_TBVS = 1;

  // Danh mục L2
  const SUBCAT_BON_CAU = 1;
  const SUBCAT_NAP_BON_CAU = 9;

  const products = await prisma.products.findMany({
    where: {
      brand_id: 1, // TOTO
      OR: [
        { sku: { startsWith: 'MS' } },
        { sku: { startsWith: 'CS' } },
        { sku: { startsWith: 'CW' } },
        { sku: { startsWith: 'TCF' } },
        { name: { contains: 'Bồn cầu' } },
        { name: { contains: 'Thân cầu' } }
      ]
    }
  });

  let updatedCount = 0;

  for (const p of products) {
    let newCategoryId = p.category_id;
    let newSubcategoryId = p.subcategory_id;
    let newProductType = p.product_type;
    let newName = p.name;

    const skuBase = p.sku.split('#')[0].split('/')[0].toUpperCase(); // Loại bỏ mã màu và hậu tố linh kiện
    const nameLower = p.name.toLowerCase();

    // -- BƯỚC 1: XỬ LÝ NGOẠI LỆ (RỦI RO) --

    // Rủi ro 1: Phụ kiện bị nhầm là Bồn cầu (Ví dụ: Nắp két nước CW823)
    if (
      nameLower.includes('nắp két nước') || 
      nameLower.includes('bộ cố định') || 
      nameLower.includes('ống nối')
    ) {
      // Bỏ qua không map vào nhóm bồn cầu
      continue;
    }

    // Rủi ro 2: Nắp rửa điện tử (TCF) bị đặt tên nhầm thành Bồn cầu thông minh
    if (skuBase.startsWith('TCF')) {
      newCategoryId = CAT_TBVS;
      newSubcategoryId = SUBCAT_NAP_BON_CAU;
      newProductType = 'nap-dien-tu';
      
      // Sửa tên nếu bị nhầm
      if (nameLower.includes('bồn cầu thông minh')) {
        newName = p.name.replace(/Bồn cầu thông minh(?: Neorest)?\s+TOTO/i, 'Nắp rửa điện tử Washlet TOTO');
      }
    }
    else {
      // -- BƯỚC 2: PHÂN LOẠI BỒN CẦU --
      
      let isToilet = false;
      let typeNameText = '';

      // Quy tắc Bồn cầu thông minh Neorest & Bồn cầu điện tử
      if (
        skuBase.endsWith('VT') || 
        ['CW878BA', 'CW993VA', 'CW992VA'].includes(skuBase) ||
        nameLower.includes('bồn cầu điện tử') ||
        nameLower.includes('neorest')
      ) {
        newCategoryId = CAT_TBVS;
        newSubcategoryId = SUBCAT_BON_CAU;
        newProductType = 'bon-cau-thong-minh';
        typeNameText = 'thông minh';
        isToilet = true;
      }
      // Quy tắc Bồn cầu đặt sàn (Ngoại lệ cứng)
      else if (['CW425J', 'CW705ENJ'].includes(skuBase)) {
        newCategoryId = CAT_TBVS;
        newSubcategoryId = SUBCAT_BON_CAU;
        newProductType = 'bon-cau-dat-san';
        typeNameText = 'đặt sàn';
        isToilet = true;
      }
      // Quy tắc Bồn cầu 1 khối
      else if (skuBase.startsWith('MS')) {
        newCategoryId = CAT_TBVS;
        newSubcategoryId = SUBCAT_BON_CAU;
        newProductType = 'bon-cau-1-khoi';
        typeNameText = '1 khối';
        isToilet = true;
      }
      // Quy tắc Bồn cầu 2 khối
      else if (skuBase.startsWith('CS')) {
        newCategoryId = CAT_TBVS;
        newSubcategoryId = SUBCAT_BON_CAU;
        newProductType = 'bon-cau-2-khoi';
        typeNameText = '2 khối';
        isToilet = true;
      }
      // Quy tắc Bồn cầu treo tường
      else if (skuBase.startsWith('CW')) {
        newCategoryId = CAT_TBVS;
        newSubcategoryId = SUBCAT_BON_CAU;
        newProductType = 'bon-cau-treo-tuong';
        typeNameText = 'treo tường';
        isToilet = true;
      }

      // -- BƯỚC 3: CHUẨN HOÁ TÊN BỒN CẦU --
      if (isToilet && typeNameText) {
        // Thay thế "Bồn cầu 1 khối TOTO", "Bồn cầu TOTO", "Thân cầu treo tường TOTO"
        // thành chuẩn: "Bồn cầu {loại} TOTO"
        const nameRegex = /^(?:Bồn cầu|Thân cầu)(?:\s+1 khối|\s+2 khối|\s+treo tường|\s+đặt sàn|\s+thông minh|\s+điện tử)?\s+TOTO/i;
        if (nameRegex.test(newName)) {
          newName = newName.replace(nameRegex, `Bồn cầu ${typeNameText} TOTO`);
        } else if (!newName.startsWith('Bồn cầu')) {
          // Fallback nếu tên không bắt đầu bằng chuẩn
          newName = `Bồn cầu ${typeNameText} TOTO ${p.sku} ${p.name}`;
        }
      }
    }

    // -- BƯỚC 4: THỰC THI CẬP NHẬT (NẾU CÓ THAY ĐỔI) --
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
      
      console.log(`✅ Đã cập nhật [${p.sku}]:`);
      if (p.name !== newName) console.log(`   - Tên: ${p.name} -> ${newName}`);
      if (p.product_type !== newProductType) console.log(`   - L3:  ${p.product_type} -> ${newProductType}`);
      
      updatedCount++;
    }
  }

  console.log(`\n🎉 HOÀN TẤT! Đã quy hoạch & chuẩn hoá thành công ${updatedCount} sản phẩm Bồn Cầu TOTO.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
