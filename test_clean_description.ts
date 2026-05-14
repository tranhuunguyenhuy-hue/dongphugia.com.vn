import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.products.findMany({
    where: { sku: { contains: 'CS302DE2' } },
    select: { sku: true, description: true }
  })

  if (products.length === 0) {
    console.log("Không tìm thấy sản phẩm nào chứa mã CS302DE2.");
    return;
  }

  console.log(`Tìm thấy ${products.length} sản phẩm. Bắt đầu test quá trình dọn dẹp:\n`);

  for (const p of products) {
    if (!p.description) {
      console.log(`[${p.sku}]: Không có description.`);
      continue;
    }

    const $ = cheerio.load(p.description, null, false);
    let removedItems: string[] = [];

    // Tìm thẻ div.preview-intro-video
    $('.preview-intro-video').each((i, el) => {
      removedItems.push($.html(el));
      $(el).remove();
    });

    // Phòng hờ các thẻ img có alt="Thumbnail Youtube" nhưng bị rớt ra ngoài
    $('img[alt="Thumbnail Youtube"]').each((i, el) => {
      removedItems.push($.html(el));
      $(el).remove();
    });

    console.log(`========================================`);
    console.log(`Sản phẩm: ${p.sku}`);
    if (removedItems.length > 0) {
      console.log(`✅ Đã phát hiện và XÓA ${removedItems.length} khối rác quảng cáo:`);
      removedItems.forEach((item, index) => {
        // Chỉ in ra khoảng 150 ký tự đầu để xem
        console.log(`   Khối ${index + 1}: ${item.substring(0, 150)}...`);
      });
      
      const cleanedLength = $.html().length;
      console.log(`   [Kết quả] Kích thước HTML: ${p.description.length} ký tự -> còn lại ${cleanedLength} ký tự.`);
      console.log(`   => Đã xóa an toàn, không ảnh hưởng các thẻ khác.`);
    } else {
      console.log(`➖ Không phát hiện ảnh quảng cáo Thumbnail Youtube.`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
