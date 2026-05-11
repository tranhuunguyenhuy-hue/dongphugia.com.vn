import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu tiến trình quy hoạch danh mục BỒN CẦU TOTO...');

  // Các ID chuẩn trong hệ thống
  const CAT_TBVS = 1;
  const SUBCAT_BON_CAU = 1;

  // Lấy tất cả sản phẩm TOTO có SKU bắt đầu bằng MS, CS, CW, hoặc tên có chữ "Bồn cầu"
  // (Lấy dư một chút để không bỏ sót, sau đó lọc bằng code)
  const products = await prisma.products.findMany({
    where: {
      brand_id: 1, // TOTO
      OR: [
        { sku: { startsWith: 'MS' } },
        { sku: { startsWith: 'CS' } },
        { sku: { startsWith: 'CW' } },
        { name: { contains: 'Bồn cầu' } },
        { name: { contains: 'Thân cầu' } }
      ]
    }
  });

  console.log(`📦 Tìm thấy ${products.length} sản phẩm tiềm năng để xử lý.`);

  let updatedCount = 0;
  const updates = [];

  for (const p of products) {
    let newType = null;
    let typeNameText = '';

    const skuBase = p.sku.split('#')[0].toUpperCase(); // Bỏ phần mã màu
    const nameLower = p.name.toLowerCase();

    // 1. RULE: Bồn cầu thông minh (Neorest & Điện tử)
    // Ưu tiên cao nhất
    if (
      skuBase.endsWith('VT') || 
      ['CW878BA', 'CW993VA', 'CW992VA'].includes(skuBase) ||
      nameLower.includes('bồn cầu điện tử') ||
      nameLower.includes('neorest')
    ) {
      newType = 'bon-cau-thong-minh';
      typeNameText = 'thông minh';
    }
    // 2. RULE: Bồn cầu đặt sàn (Trường hợp ngoại lệ)
    else if (['CW425J', 'CW705ENJ'].includes(skuBase)) {
      newType = 'bon-cau-dat-san';
      typeNameText = 'đặt sàn';
    }
    // 3. RULE: Bồn cầu 1 khối
    else if (skuBase.startsWith('MS')) {
      newType = 'bon-cau-1-khoi';
      typeNameText = '1 khối';
    }
    // 4. RULE: Bồn cầu 2 khối
    else if (skuBase.startsWith('CS')) {
      newType = 'bon-cau-2-khoi';
      typeNameText = '2 khối';
    }
    // 5. RULE: Bồn cầu treo tường
    else if (skuBase.startsWith('CW')) {
      newType = 'bon-cau-treo-tuong';
      typeNameText = 'treo tường';
    }

    // Nếu không khớp quy tắc nào ở trên, bỏ qua
    if (!newType) continue;

    // Chuẩn hoá lại Tên Sản Phẩm để đồng bộ với cấu trúc Danh mục
    // Tìm các chuỗi như "Bồn cầu TOTO", "Bồn cầu 1 khối TOTO", "Thân cầu treo tường TOTO"
    // và thay thế thành chuẩn: "Bồn cầu {typeNameText} TOTO"
    let newName = p.name;
    const nameRegex = /^(?:Bồn cầu|Thân cầu)(?:\s+1 khối|\s+2 khối|\s+treo tường|\s+đặt sàn|\s+thông minh|\s+điện tử)?\s+TOTO/i;
    
    if (nameRegex.test(newName)) {
      newName = newName.replace(nameRegex, `Bồn cầu ${typeNameText} TOTO`);
    }

    // Nếu có sự thay đổi về danh mục hoặc tên, đưa vào danh sách cập nhật
    if (
      p.category_id !== CAT_TBVS || 
      p.subcategory_id !== SUBCAT_BON_CAU || 
      p.product_type !== newType ||
      p.name !== newName
    ) {
      updates.push({
        id: p.id,
        sku: p.sku,
        oldName: p.name,
        newName: newName,
        oldType: p.product_type,
        newType: newType
      });

      updatedCount++;
    }
  }

  // Ghi log ra file để sếp kiểm tra thủ công trước khi chạy
  const logData = updates.map(u => 
    `SKU: ${u.sku}\n  - Tên cũ: ${u.oldName}\n  - Tên mới: ${u.newName}\n  - Loại cũ: ${u.oldType || 'NULL'} -> Loại mới: ${u.newType}\n`
  ).join('\\n');

  fs.writeFileSync('toilet-mapping-review.txt', logData);

  console.log(`✅ Phân tích xong! Phát hiện ${updatedCount} sản phẩm cần quy hoạch lại.`);
  console.log(`📄 Đã xuất danh sách chi tiết ra file: toilet-mapping-review.txt để review.`);
  console.log(`\n(Chưa ghi vào DB. Hãy review file txt, nếu OK tôi sẽ chạy hàm UPDATE)`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
