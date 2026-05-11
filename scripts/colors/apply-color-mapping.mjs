import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Hàm xác định slug màu dựa trên các manh mối (specs, sku, name)
function determineColorSlug(specs, sku, name) {
  // Lấy text màu từ specs (nếu có)
  let specColorText = "";
  if (specs && typeof specs === "object") {
    const keys = Object.keys(specs);
    const lopMaKey = keys.find(k => k.toLowerCase() === "lớp mạ (màu)");
    const mauSacKey = keys.find(k => k.toLowerCase() === "màu sắc");
    
    if (lopMaKey) specColorText += " " + specs[lopMaKey];
    if (mauSacKey) specColorText += " " + specs[mauSacKey];
  }

  const combinedText = `${specColorText} ${sku} ${name}`.toLowerCase();

  // Ưu tiên các mã màu đặc thù của hãng trước (TOTO/Inax)
  if (combinedText.includes("#mbl") || combinedText.includes("đen mờ") || combinedText.includes("đen nhám")) return "den-mo";
  if (combinedText.includes("#nw1") || combinedText.includes("#xw") || combinedText.includes("#w") || combinedText.includes("trắng")) return "trang";
  
  if (combinedText.includes("vàng hồng") || combinedText.includes("rose gold") || combinedText.includes("#pg") || combinedText.includes("#prg")) return "vang-hong";
  if (combinedText.includes("vàng mờ") || combinedText.includes("vàng nhám") || combinedText.includes("#fg")) return "vang-mo";
  if (combinedText.includes("vàng") || combinedText.includes("gold") || combinedText.includes("#pg")) return "vang";
  
  if (combinedText.includes("đồng mờ") || combinedText.includes("#pb") || combinedText.includes("đồng chải")) return "dong";
  if (combinedText.includes("đồng") || combinedText.includes("bronze")) return "dong";
  
  if (combinedText.includes("niken mờ") || combinedText.includes("xước") || combinedText.includes("brushed") || combinedText.includes("#pn")) return "xuoc-mo";
  
  if (combinedText.includes("đen") || combinedText.includes("black")) return "den-bong"; // Fallback cho màu đen chung chung
  if (combinedText.includes("xám") || combinedText.includes("grey") || combinedText.includes("gray")) return "xam";
  if (combinedText.includes("kem") || combinedText.includes("biscoi") || combinedText.includes("#n")) return "kem";
  
  if (combinedText.includes("crom") || combinedText.includes("niken") || combinedText.includes("chrome") || combinedText.includes("bạc") || combinedText.includes("#cp")) return "crom-niken";

  return null;
}

async function runMapping() {
  console.log("Bắt đầu Map dữ liệu Màu Sắc (Color) vào Products...");
  const logStream = fs.createWriteStream(path.join(process.cwd(), "color-mapping-log.txt"), { flags: 'w' });

  try {
    // 1. Lấy tất cả Colors từ DB
    const colors = await prisma.colors.findMany();
    const colorMap = {}; // slug -> id
    colors.forEach(c => { colorMap[c.slug] = c.id; });

    // 2. Lấy tất cả products
    const products = await prisma.products.findMany({
      select: { id: true, sku: true, name: true, specs: true, color_id: true }
    });

    let updatedCount = 0;
    const batchUpdates = [];

    for (const p of products) {
      const targetSlug = determineColorSlug(p.specs, p.sku, p.name);
      
      if (targetSlug && colorMap[targetSlug]) {
        const targetColorId = colorMap[targetSlug];
        
        // Nếu color_id hiện tại khác với targetColorId thì cập nhật
        if (p.color_id !== targetColorId) {
          batchUpdates.push({
            id: p.id,
            color_id: targetColorId
          });

          // Log
          const logMsg = `SKU: ${p.sku} | Name: ${p.name}\n=> Map sang màu: ${targetSlug} (ID: ${targetColorId})\n-------------------------\n`;
          logStream.write(logMsg);
        }
      }
    }

    // 3. Thực thi cập nhật hàng loạt (từng 100 sản phẩm một để tránh quá tải)
    console.log(`Tìm thấy ${batchUpdates.length} sản phẩm cần cập nhật color_id.`);
    
    const BATCH_SIZE = 100;
    for (let i = 0; i < batchUpdates.length; i += BATCH_SIZE) {
      const batch = batchUpdates.slice(i, i + BATCH_SIZE);
      
      // Prisma không hỗ trợ updateMany cho nhiều bản ghi với các giá trị khác nhau trực tiếp
      // Nên dùng transaction
      const transactions = batch.map(updateData => 
        prisma.products.update({
          where: { id: updateData.id },
          data: { color_id: updateData.color_id }
        })
      );
      
      await prisma.$transaction(transactions);
      updatedCount += batch.length;
      console.log(`Đã cập nhật ${updatedCount} / ${batchUpdates.length} sản phẩm...`);
    }

    console.log("Hoàn tất map màu sắc! Log được lưu tại color-mapping-log.txt");

  } catch (error) {
    console.error("Lỗi:", error);
  } finally {
    logStream.end();
    await prisma.$disconnect();
  }
}

runMapping();
