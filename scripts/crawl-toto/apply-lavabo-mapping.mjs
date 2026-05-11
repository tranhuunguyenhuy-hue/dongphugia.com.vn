import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu quy hoạch danh mục LAVABO TOTO...');

  const lavabos = await prisma.products.findMany({
    where: { brand_id: 1, subcategory_id: 2 }
  });

  let updateCount = 0;
  const logs = [];

  for (const p of lavabos) {
    const nameLower = p.name.toLowerCase();
    
    // Bóc tách Base SKU
    const baseSkuMatch = p.sku.match(/^([^#\/]+)/);
    const baseSku = baseSkuMatch ? baseSkuMatch[1] : p.sku;
    
    let newType = p.product_type;
    let newName = p.name;
    let newSubcategory = p.subcategory_id;
    let ruleMatched = '';

    // Bước 1: Lọc kẻ lạc bầy
    if (baseSku.startsWith('TLG') || baseSku.startsWith('TS')) {
      newSubcategory = 6; // Đẩy về danh mục Vòi chậu
      ruleMatched = 'Kẻ lạc bầy -> Vòi Chậu';
    } 
    else if (baseSku === 'T6JV6') {
      newType = 'phu-kien-lavabo';
      ruleMatched = 'Phụ kiện (Ống xả)';
      newName = 'Ống xả Lavabo TOTO T6JV6';
    }
    // Bước 2: Phân loại Lavabo
    else {
      if (nameLower.includes('bán âm')) {
        newType = 'lavabo-ban-am';
        ruleMatched = 'Bán âm';
        newName = newName.replace(/^(?:Chậu rửa lavabo bán âm bàn|Chậu rửa mặt bán âm bàn|Chậu rửa lavabo bán âm|Chậu rửa mặt bán âm|Chậu lavabo bán âm|Chậu rửa lavabo|Chậu rửa mặt|Lavabo)/i, 'Chậu Lavabo Bán Âm Bàn');
      } else if (nameLower.includes('âm bàn')) {
        newType = 'lavabo-am-ban';
        ruleMatched = 'Âm bàn';
        newName = newName.replace(/^(?:Chậu rửa lavabo âm bàn|Chậu rửa mặt âm bàn|Chậu rửa lavabo|Chậu rửa mặt|Lavabo)/i, 'Chậu Lavabo Âm Bàn');
      } else if (nameLower.includes('dương vành')) {
        newType = 'lavabo-duong-vanh';
        ruleMatched = 'Dương vành';
        newName = newName.replace(/^(?:Chậu rửa lavabo dương vành|Chậu rửa mặt dương vành|Chậu rửa lavabo|Chậu rửa mặt|Lavabo)/i, 'Chậu Lavabo Dương Vành');
      } else if (nameLower.includes('đặt bàn') || baseSku.startsWith('PJS')) {
        newType = 'lavabo-dat-ban';
        ruleMatched = 'Đặt bàn';
        newName = newName.replace(/^(?:Chậu rửa lavabo đặt bàn|Chậu rửa mặt đặt bàn|Chậu rửa lavabo|Chậu rửa mặt|Lavabo)/i, 'Chậu Lavabo Đặt Bàn');
      } else if (nameLower.includes('treo tường') || /^(L|LHT|LPT)/.test(baseSku)) {
        newType = 'lavabo-treo-tuong';
        ruleMatched = 'Treo tường';
        newName = newName.replace(/^(?:Chậu rửa lavabo treo tường|Chậu rửa mặt treo tường|Chậu rửa lavabo|Chậu rửa mặt|Lavabo)/i, 'Chậu Lavabo Treo Tường');
      } else {
        ruleMatched = 'Mặc định';
        newName = newName.replace(/^(?:Chậu rửa lavabo|Chậu rửa mặt|Lavabo)/i, 'Chậu Lavabo');
      }
    }

    if (newType !== p.product_type || newName !== p.name || newSubcategory !== p.subcategory_id) {
      logs.push(
        `SKU: ${p.sku}\n` +
        `Quy tắc: ${ruleMatched}\n` +
        `Tên cũ: ${p.name}\n` +
        `Tên mới: ${newName}\n` +
        `Sub ID cũ: ${p.subcategory_id} -> Sub ID mới: ${newSubcategory}\n` +
        `Loại cũ: ${p.product_type} -> Loại mới: ${newType}\n` +
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

  fs.writeFileSync('lavabo-mapping-log.txt', logs.join('\n'));
  console.log(`\nCập nhật thành công ${updateCount} sản phẩm vào Database! Đã lưu log vào lavabo-mapping-log.txt`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
