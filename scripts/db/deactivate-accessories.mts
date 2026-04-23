/**
 * Soft-delete 26 sản phẩm PHỤ KIỆN sai chỗ trong sub=1 (Bồn Cầu)
 * → is_active = false (ẩn khỏi website, KHÔNG xóa vĩnh viễn)
 * 
 * Loại trừ ID:742 (Bồn cầu treo tường TOTO CW822RA) — bồn cầu thật!
 * 
 * Run: npx tsx --env-file=.env.local scripts/db/deactivate-accessories.mts [--execute]
 */
import { PrismaClient } from '@prisma/client';
const isDryRun = !process.argv.includes('--execute');
const p = new PrismaClient();

// 26 phụ kiện xác nhận KHÔNG phải bồn cầu (đã loại ID:742 - bồn cầu thật)
const TO_DEACTIVATE = [
  4586,  // Bộ chống trượt TOTO HHF90590U
  4672,  // Bộ cố định của nắp bồn cầu TOTO
  4017,  // Bộ kết nối đầu vào và đầu ra GROHE
  4022,  // Bộ ốc vít cho két âm tường GROHE
  4603,  // Bộ thoát thải bồn cầu TOTO VM5U024#W
  3862,  // Bộ vít cố định INAX A-S32VN-5
  4575,  // Bu lông inox nắp TC385VS TOTO
  4580,  // Cục hơi đế nắp TC600VS TOTO
  4578,  // Cục hơi nắp TC385VS bên phải TOTO
  4579,  // Cục hơi nắp TC385VS bên trái TOTO
  3840,  // Đầu nối chữ T chia 2 đường nước TOTO
  3865,  // Đế cố định với bồn cầu INAX A-500VS-5B
  4669,  // Đệm thoát sàn TOTO HTHU291D
  4606,  // Đệm thoát sàn TOTO TX215C
  3931,  // Gạt nước bàn cầu MOEN Bamboo
  4014,  // Két nước bồn cầu 2 khối Euro Ceramic GROHE 39332000
  4581,  // Lõi đóng êm nắp ngồi TOTO D46964R
  4582,  // Lõi đóng êm nắp ngồi TOTO D46965R
  4598,  // Mặt van xả cảm ứng hồng ngoại GROHE
  4599,  // Mặt van xả cảm ứng hồng ngoại GROHE (bản 2)
  4583,  // Miếng đệm bằng thép nắp TC385VS TOTO
  4709,  // Ống thải cong INAX A-DTF23P-2
  4710,  // Ống thải thẳng INAX A-DTF23P-3
  4593,  // Tay gạt xả bồn cầu TOTO HB5674-767
  4715,  // Thân đế thải INAX PT-1052G52G17
  4768,  // Thanh bật cho van xả điện tử Servo GROHE
];

// Bồn cầu treo tường thật - sửa product_type
const FIX_TOILET = 742; // Bồn cầu treo tường nắp êm TOTO CW822RA

async function main() {
  console.log(`\n🗑️  Deactivate ${TO_DEACTIVATE.length} phụ kiện sai sub=1`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  const items = await p.products.findMany({
    where: { id: { in: TO_DEACTIVATE } },
    select: { id: true, name: true }
  });

  console.log('📦 Danh sách sẽ bị ẩn (is_active = false):');
  items.forEach(s => console.log(`   ✗ ID:${s.id} — ${s.name.substring(0, 65)}`));

  const toilet742 = await p.products.findFirst({
    where: { id: FIX_TOILET },
    select: { id: true, name: true, product_type: true }
  });
  console.log(`\n✅ Giữ lại & fix type: ID:${toilet742?.id} — ${toilet742?.name?.substring(0, 60)}`);

  if (!isDryRun) {
    // Soft delete 26 phụ kiện
    const result = await p.products.updateMany({
      where: { id: { in: TO_DEACTIVATE } },
      data: {
        is_active: false,
        subcategory_id: 32, // Phụ Kiện Bồn Cầu (để khỏi lẫn nếu reactivate sau)
      }
    });

    // Fix ID:742 - bồn cầu treo tường thật
    await p.products.update({
      where: { id: FIX_TOILET },
      data: { product_type: 'bon-cau-treo-tuong' }
    });

    // Verify
    const newCount = await p.products.count({
      where: { subcategory_id: 1, is_active: true }
    });

    console.log(`\n✅ ĐÃ ẨN: ${result.count} sản phẩm (is_active = false)`);
    console.log(`📊 Sub=1 sau xóa: ${newCount} sp bồn cầu thật`);
  } else {
    console.log(`\n💡 Chạy --execute để thực thi.`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
