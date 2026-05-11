import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu quy hoạch các danh mục TOTO còn lại (Bồn Tiểu, Vòi Bếp, Phụ Kiện, v.v.)...');

  const products = await prisma.products.findMany({
    where: { brand_id: 1, subcategory_id: { in: [5, 7, 8, 9, 10, 11, 32] } }
  });

  let updateCount = 0;
  const logs = [];

  for (const p of products) {
    const nameLower = p.name.toLowerCase();
    
    // Extract Base SKU
    const baseSkuMatch = p.sku.match(/^([^#\/]+)/);
    const baseSku = baseSkuMatch ? baseSkuMatch[1] : p.sku;
    
    let newType = p.product_type;
    let newName = p.name;
    let newSubcategory = p.subcategory_id;
    let ruleMatched = '';

    // 1. Phụ Kiện Phòng Tắm (5)
    if (p.subcategory_id === 5) {
      if (baseSku.startsWith('YM')) {
        newType = 'guong-phong-tam';
        ruleMatched = 'Gương phòng tắm';
        newName = newName.replace(/^Gương phòng tắm/i, 'Gương Phòng Tắm');
      } else if (!newType) {
        newType = 'phu-kien-phong-tam';
      }
    }
    
    // 2. Bồn Tiểu (7)
    else if (p.subcategory_id === 7) {
      if (baseSku.startsWith('U')) { // U, UT, US
        newType = 'bon-tieu-nam';
        ruleMatched = 'Bồn tiểu nam';
        newName = newName.replace(/^Bồn tiểu nam/i, 'Bồn Tiểu Nam');
      } else {
        newType = 'phu-kien-bon-tieu';
        ruleMatched = 'Phụ kiện bồn tiểu';
      }
    }

    // 3. Vòi Nước - Xịt vệ sinh (8)
    else if (p.subcategory_id === 8) {
      if (nameLower.includes('xịt vệ sinh')) {
        newSubcategory = 5; // Move to Phụ kiện phòng tắm
        newType = 'voi-xit-ve-sinh';
        ruleMatched = 'Vòi xịt vệ sinh -> Phụ kiện PT';
      }
    }

    // 4. Nắp Bồn Cầu (9)
    else if (p.subcategory_id === 9) {
      if (newType === 'nap-thuong-dong-em') {
        newName = newName.replace(/^Nắp bồn cầu đóng êm/i, 'Nắp Bồn Cầu Đóng Êm');
      } else if (newType === 'nap-dien-tu') {
        newName = newName.replace(/^Nắp điện tử thông minh Washlet/i, 'Nắp Bồn Cầu Điện Tử Washlet');
      } else if (newType === 'nap-rua-co') {
        newName = newName.replace(/^Nắp rửa cơ Ecowasher/i, 'Nắp Bồn Cầu Rửa Cơ Ecowasher');
      }
    }

    // 5. Vòi Rửa Chén (10)
    else if (p.subcategory_id === 10) {
      newType = 'voi-rua-chen';
      ruleMatched = 'Vòi rửa chén';
      newName = newName.replace(/Vòi bếp/i, 'Vòi Rửa Chén');
    }

    // 6. Thiết bị bếp khác (11) -> Lõi van
    else if (p.subcategory_id === 11) {
      if (nameLower.includes('lõi van')) {
        newSubcategory = 6; // Move to Vòi Chậu
        newType = 'phu-kien-voi';
        ruleMatched = 'Lõi van -> Phụ kiện Vòi Chậu';
      }
    }

    // 7. Phụ Kiện Bồn Cầu (32)
    else if (p.subcategory_id === 32) {
      if (baseSku.startsWith('HTSV') || nameLower.startsWith('bồn cầu toto c') || nameLower.startsWith('bồn cầu toto cs') || nameLower.startsWith('bồn cầu toto ms')) {
        newSubcategory = 33; // Thân bồn cầu
        newType = 'than-bon-cau';
        ruleMatched = 'Thân bồn cầu -> Subcat 33';
        newName = newName.replace(/^Bồn cầu/i, 'Thân Bồn Cầu');
      } else if (nameLower.includes('nắp két nước')) {
        newType = 'nap-ket-nuoc';
      } else if (nameLower.includes('két nước')) {
        newType = 'ket-nuoc';
      } else if (!newType) {
        newType = 'phu-kien-bon-cau';
      }
    }

    if (newType !== p.product_type || newName !== p.name || newSubcategory !== p.subcategory_id) {
      logs.push(
        `SKU: ${p.sku}\n` +
        `Quy tắc: ${ruleMatched || 'Chuẩn hóa Tên/Type'}\n` +
        `Tên cũ: ${p.name}\n` +
        `Tên mới: ${newName}\n` +
        `Sub ID: ${p.subcategory_id} -> ${newSubcategory}\n` +
        `Loại: ${p.product_type} -> ${newType}\n` +
        `------------------------------------------------`
      );
      
      await prisma.products.update({
        where: { id: p.id },
        data: {
          product_type: newType,
          name: newName,
          subcategory_id: newSubcategory
        }
      });
      updateCount++;
    }
  }

  fs.writeFileSync('remaining-toto-mapping-log.txt', logs.join('\n'));
  console.log(`\nCập nhật thành công ${updateCount} sản phẩm vào Database! Đã lưu log vào remaining-toto-mapping-log.txt`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
