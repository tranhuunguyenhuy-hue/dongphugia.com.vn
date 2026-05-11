import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu phân tích & giả lập mapping danh mục SEN TẮM TOTO...');

  const CAT_TBVS = 1;
  const SUBCAT_SEN_TAM = 3;
  
  const products = await prisma.products.findMany({
    where: { 
      brand_id: 1, 
      OR: [
        { subcategory_id: SUBCAT_SEN_TAM },
        { name: { contains: 'Sen ' } },
        { name: { contains: 'sen tắm' } },
        { name: { contains: 'Vòi xả bồn' } },
        { sku: { startsWith: 'TB' } }
      ]
    }
  });

  const logs = [];
  let updateCount = 0;

  for (const p of products) {
    let newCategoryId = CAT_TBVS;
    let newSubcategoryId = SUBCAT_SEN_TAM;
    let newProductType = p.product_type;
    let newName = p.name;

    const nameLower = p.name.toLowerCase();
    let ruleMatched = '';

    // --- STEP 1: PHỤ KIỆN LẺ ---
    if (
      nameLower.includes('lõi van') ||
      nameLower.includes('đầu chuyển') ||
      nameLower.includes('tay vặn') ||
      nameLower.includes('van dừng') ||
      nameLower.includes('bộ chia nước') ||
      nameLower.includes('thanh trượt') ||
      nameLower.includes('gác sen') ||
      nameLower.includes('dây sen') ||
      nameLower.includes('nút nhấn') ||
      nameLower.includes('van biến nhiệt') ||
      nameLower.includes('phụ kiện âm tường') ||
      nameLower.includes('đế đặt sàn')
    ) {
      newProductType = 'phu-kien-sen-tam';
      ruleMatched = 'Phụ kiện lẻ';
    }
    // --- STEP 2: VÒI XẢ BỒN TẮM ---
    else if (nameLower.includes('vòi xả bồn') || nameLower.includes('vòi bồn tắm')) {
      newProductType = 'voi-xa-bon-tam';
      ruleMatched = 'Vòi xả bồn';
      newName = newName.replace(/^(?:Vòi xả bồn tắm|Vòi xả bồn)(?:\s+đặt sàn|\s+nóng lạnh)?/i, 'Vòi xả bồn tắm');
    }
    // --- STEP 3: SEN CÂY ---
    else if (nameLower.includes('sen cây') || nameLower.includes('cây sen') || p.sku.startsWith('DM')) {
      newProductType = 'sen-cay';
      ruleMatched = 'Sen cây';
      newName = newName.replace(/^(?:Bộ sen cây tắm nóng lạnh|Bộ sen cây nóng lạnh|Bộ sen cây|Sen cây tắm|Sen cây)/i, 'Bộ sen cây');
    }
    // --- STEP 4: BỘ SEN TẮM / SET SEN TẮM (Được đưa lên ưu tiên để không bị lọt vào Bát sen) ---
    else if (nameLower.includes('bộ sen tắm') || nameLower.includes('set sen tắm') || nameLower.includes('sen tắm') || p.sku.startsWith('TBV') || p.sku.startsWith('TBS')) {
      // Loại trừ các trường hợp tên chứa "sen tắm" nhưng thực ra là linh kiện
      if (nameLower.includes('bát sen') && !nameLower.includes('bộ') && !nameLower.includes('set')) {
        // Fallthrough xuống bước 6
      } else if (nameLower.includes('củ sen') && !nameLower.includes('bộ') && !nameLower.includes('set')) {
        // Fallthrough xuống bước 5
      } else {
        if (nameLower.includes('âm tường') || p.product_type === 'sen-am-tuong') {
          newProductType = 'sen-tam-am-tuong';
          ruleMatched = 'Set sen tắm âm tường';
          newName = newName.replace(/^(?:Set sen tắm âm tường|Bộ sen tắm âm tường|Set sen tắm|Bộ sen tắm)/i, 'Bộ sen tắm âm tường');
        } else if (nameLower.includes('nhiệt độ') || p.sku.startsWith('TBV')) {
          newProductType = 'sen-tam-nhiet-do';
          ruleMatched = 'Bộ sen tắm nhiệt độ';
          newName = newName.replace(/^(?:Bộ sen tắm nhiệt độ|Sen tắm nhiệt độ|Bộ sen tắm|Set sen tắm)/i, 'Bộ sen tắm nhiệt độ');
        } else {
          newProductType = 'sen-tam-nong-lanh';
          ruleMatched = 'Bộ sen tắm nóng lạnh';
          newName = newName.replace(/^(?:Bộ sen tắm nóng lạnh|Sen tắm nóng lạnh|Bộ sen tắm lạnh|Sen tắm lạnh|Bộ sen tắm|Set sen tắm|Sen tắm)/i, 'Bộ sen tắm nóng lạnh');
        }
      }
    }
    
    // Nếu bị fallthrough từ Bước 4, nó sẽ chạy tiếp vào đây:
    
    // --- STEP 5: CỦ SEN / VAN SEN ---
    if (!ruleMatched || ruleMatched.includes('Không rõ')) {
      if (nameLower.includes('củ sen') || nameLower.includes('van gật gù') || nameLower.includes('van chuyển hướng') || nameLower.includes('thân sen')) {
        newProductType = 'cu-sen-van-sen';
        ruleMatched = 'Củ sen / Van điều chỉnh';
        if (nameLower.includes('củ sen')) {
          newName = newName.replace(/^(?:Củ sen tắm nóng lạnh|Củ sen nóng lạnh|Củ sen tắm|Củ sen)/i, 'Củ sen tắm');
        }
      }
      // --- STEP 6: BÁT SEN / TAY SEN ---
      else if (nameLower.includes('bát sen') || nameLower.includes('tay sen') || nameLower.includes('sen cầm tay')) {
        if (nameLower.includes('gắn trần') || nameLower.includes('âm trần') || nameLower.includes('bát sen trần')) {
          newProductType = 'bat-sen-tran';
          ruleMatched = 'Bát sen trần';
          newName = newName.replace(/^(?:Bát sen tắm gắn trần|Bát sen gắn trần|Bát sen trần)/i, 'Bát sen gắn trần');
        } else {
          newProductType = 'bat-sen-cam-tay';
          ruleMatched = 'Bát sen cầm tay';
          newName = newName.replace(/^(?:Bát sen tắm cầm tay|Bát sen cầm tay|Tay sen tắm|Tay sen|Bát sen tắm gắn tường|Bát sen tay|Bát sen tắm|Bát sen)/i, 'Bát sen cầm tay');
        }
      }
    }

    if (!ruleMatched) ruleMatched = 'Không rõ (Cần kiểm tra lại)';

    // Ghi log những thay đổi
    if (
      p.category_id !== newCategoryId || 
      p.subcategory_id !== newSubcategoryId || 
      p.product_type !== newProductType ||
      p.name !== newName
    ) {
      logs.push(
        'SKU: ' + p.sku + '\\n' +
        'Quy tắc áp dụng: ' + ruleMatched + '\\n' +
        'Tên cũ: ' + p.name + '\\n' +
        'Tên mới: ' + newName + '\\n' +
        'Loại cũ: L2:' + p.subcategory_id + ' | ' + p.product_type + '\\n' +
        'Loại mới: L2:' + newSubcategoryId + ' | ' + newProductType + '\\n' +
        '------------------------------------------------'
      );
      updateCount++;
    }
  }

  // Ghi ra file
  fs.writeFileSync('shower-mapping-review.txt', logs.join('\\n'));
  console.log('\\nĐã ghi ' + updateCount + ' sản phẩm cần thay đổi vào file shower-mapping-review.txt');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
