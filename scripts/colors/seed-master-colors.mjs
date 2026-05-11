import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const masterColors = [
  { name: "Trắng", slug: "trang", hex_code: "#FFFFFF" },
  { name: "Đen Mờ", slug: "den-mo", hex_code: "#2A2A2A" },
  { name: "Đen Bóng", slug: "den-bong", hex_code: "#000000" },
  { name: "Crom / Niken", slug: "crom-niken", hex_code: "#E8E9EB" }, // Silver/Chrome look
  { name: "Vàng", slug: "vang", hex_code: "#FFD700" },
  { name: "Vàng Mờ", slug: "vang-mo", hex_code: "#C5B358" },
  { name: "Vàng Hồng", slug: "vang-hong", hex_code: "#B76E79" },
  { name: "Đồng", slug: "dong", hex_code: "#B87333" },
  { name: "Xám", slug: "xam", hex_code: "#808080" },
  { name: "Kem / Biscoi", slug: "kem", hex_code: "#FFFDD0" },
  { name: "Xước Mờ", slug: "xuoc-mo", hex_code: "#C0C0C0" } // Brushed nickel/stainless
];

async function seedColors() {
  console.log("Bắt đầu tạo dữ liệu bảng colors...");
  try {
    for (const color of masterColors) {
      const result = await prisma.colors.upsert({
        where: { slug: color.slug },
        update: {
          name: color.name,
          hex_code: color.hex_code
        },
        create: color
      });
      console.log(`✅ Upserted color: ${result.name}`);
    }
    console.log("Hoàn tất tạo Master Colors!");
  } catch (error) {
    console.error("Lỗi khi tạo colors:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedColors();
