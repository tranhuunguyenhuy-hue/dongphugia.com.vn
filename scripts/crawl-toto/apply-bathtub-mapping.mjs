import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu quy hoạch danh mục BỒN TẮM TOTO...');

  const bathtubs = await prisma.products.findMany({
    where: { brand_id: 1, subcategory_id: 4 }
  });

  let updateCount = 0;
  const logs = [];

  for (const p of bathtubs) {
    const nameLower = p.name.toLowerCase();
    
    // Bóc tách Base SKU (trước dấu # hoặc /)
    const baseSkuMatch = p.sku.match(/^([^#\/]+)/);
    const baseSku = baseSkuMatch ? baseSkuMatch[1] : p.sku;
    
    // Chặn cửa 1: Đây là bồn hay phụ kiện?
    const isTubSku = /^(PAY|PPY|PJY|FBY)/.test(baseSku);
    
    let newType = p.product_type;
    let newName = p.name;
    let ruleMatched = '';

    if (!isTubSku) {
      // Đích thị là phụ kiện
      newType = 'phu-kien-bon-tam';
      ruleMatched = 'Phụ kiện';
    } else {
      // Nó là bồn tắm! Đi vào 3 lớp lọc
      
      // Lớp 1: Massage
      const isMassageSku = /^(PPYB|PPYD|PPYK|PJYD|PJYK)/.test(baseSku);
      const isMassageName = nameLower.includes('massage') || nameLower.includes('sục') || nameLower.includes('thủy lực');
      
      if (isMassageSku || isMassageName) {
        newType = 'bon-tam-massage';
        ruleMatched = 'Massage';
        newName = newName.replace(/^(?:Bồn tắm massage|Bồn tắm sục|Bồn tắm yếm|Bồn tắm)/i, 'Bồn tắm massage');
      } 
      // Lớp 2: Đặt sàn
      else if (baseSku.startsWith('PJY') || nameLower.includes('đặt sàn')) {
        newType = 'bon-tam-dat-san';
        ruleMatched = 'Đặt sàn';
        newName = newName.replace(/^(?:Bồn tắm đặt sàn|Bồn tắm yếm|Bồn tắm)/i, 'Bồn tắm đặt sàn');
      }
      // Lớp 3: Có Yếm vs Xây
      else {
        // TOTO PAY dòng có yếm luôn kết thúc bằng C. Các dòng khác thường có chữ 'yếm' trong tên.
        const isYemSkuStrict = /^PAY.*C$/.test(baseSku);
        const isYemName = nameLower.includes('yếm');
        
        if (isYemName || isYemSkuStrict) {
          newType = 'bon-tam-co-yem';
          ruleMatched = 'Có yếm';
          newName = newName.replace(/^(?:Bồn tắm yếm|Bồn tắm chân yếm|Bồn tắm)/i, 'Bồn tắm yếm');
        } else {
          newType = 'bon-tam-xay';
          ruleMatched = 'Bồn tắm xây';
          
          // Lớp 4: Chuẩn hóa tên cho bồn tắm xây dựa vào vật liệu
          if (baseSku.startsWith('FBY')) {
            newName = newName.replace(/^(?:Bồn tắm gang tráng men|Bồn tắm gang|Bồn tắm)/i, 'Bồn tắm gang tráng men');
          } else if (baseSku.startsWith('PPY')) {
            newName = newName.replace(/^(?:Bồn tắm ngọc trai|Bồn tắm)/i, 'Bồn tắm ngọc trai');
          } else if (baseSku.startsWith('PAY')) {
            newName = newName.replace(/^(?:Bồn tắm nhựa FRP|Bồn tắm nhựa|Bồn tắm)/i, 'Bồn tắm nhựa');
          }
        }
      }
    }

    if (newType !== p.product_type || newName !== p.name) {
      logs.push(
        'SKU: ' + p.sku + '\\n' +
        'Base SKU: ' + baseSku + ' | Là Bồn: ' + isTubSku + '\\n' +
        'Quy tắc: ' + ruleMatched + '\\n' +
        'Tên cũ: ' + p.name + '\\n' +
        'Tên mới: ' + newName + '\\n' +
        'Loại cũ: ' + p.product_type + ' -> Loại mới: ' + newType + '\\n' +
        '------------------------------------------------'
      );
      
      await prisma.products.update({
        where: { id: p.id },
        data: {
          product_type: newType,
          name: newName
        }
      });
      updateCount++;
    }
  }

  fs.writeFileSync('bathtub-mapping-log.txt', logs.join('\\n'));
  console.log('\\nCập nhật thành công ' + updateCount + ' sản phẩm vào Database!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
