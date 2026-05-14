import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

async function main() {
  console.log("Bắt đầu tiến trình dọn dẹp Database hàng loạt...");
  
  // Lấy toàn bộ sản phẩm có mô tả
  const products = await prisma.products.findMany({
    where: { description: { not: null } },
    select: { id: true, sku: true, description: true }
  });

  let updateCount = 0;

  for (const p of products) {
    if (!p.description) continue;

    const $ = cheerio.load(p.description, null, false);
    let hasChanges = false;

    // Tìm thẻ div.preview-intro-video
    const videoBlocks = $('.preview-intro-video');
    if (videoBlocks.length > 0) {
      videoBlocks.remove();
      hasChanges = true;
    }

    // Phòng hờ các thẻ img có alt="Thumbnail Youtube" nhưng bị rớt ra ngoài
    const youtubeThumbnails = $('img[alt="Thumbnail Youtube"]');
    if (youtubeThumbnails.length > 0) {
      youtubeThumbnails.remove();
      hasChanges = true;
    }

    // Nếu có sự thay đổi, tiến hành lưu lại vào Database
    if (hasChanges) {
      const cleanedHtml = $.html();
      await prisma.products.update({
        where: { id: p.id },
        data: { description: cleanedHtml }
      });
      updateCount++;
      console.log(`✅ Đã làm sạch & Cập nhật CSDL: [${p.sku}]`);
    }
  }

  console.log(`\n🎉 HOÀN TẤT! Đã dọn dẹp thành công ${updateCount} sản phẩm.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
