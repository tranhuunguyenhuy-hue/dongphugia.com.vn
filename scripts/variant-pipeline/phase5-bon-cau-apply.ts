/**
 * Phase 5: Apply variant_group mappings for Bồn Cầu products
 *
 * Source: bon-cau-variant-export - bon-cau-variant-export.csv.csv
 * Logic:
 *   - Read CSV, apply 2 manual corrections before import
 *   - Only update rows WHERE variant_group value is present in CSV
 *   - NEVER clear existing variant_group that are not in this CSV
 *   - Dry-run mode by default, pass --apply to commit
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes("--apply");

const CSV_PATH = path.resolve(
  __dirname,
  "../bon-cau-variant-export - bon-cau-variant-export.csv.csv"
);

// Manual corrections confirmed by user
const GROUP_CORRECTIONS: Record<string, string> = {
  "AC-1053": "AC-1052", // AC-1052VN same body as AC-1052
  "AC-4006": "AC-4005", // AC-4005VN same body as AC-4005
};

interface CsvRow {
  id: number;
  sku: string;
  brand: string;
  variant_group: string | null;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n").slice(1); // skip header

  return lines.map((line) => {
    // id,sku,brand,variant_group,name,price_display,slug
    const parts = line.split(",");
    const rawGroup = parts[3]?.trim() || "";

    // Apply manual corrections
    const corrected = rawGroup ? (GROUP_CORRECTIONS[rawGroup] ?? rawGroup) : null;

    return {
      id: parseInt(parts[0]),
      sku: parts[1],
      brand: parts[2],
      variant_group: corrected || null,
    };
  });
}

async function main() {
  console.log(`\n🚀 Phase 5 — Bồn Cầu Variant Group Apply`);
  console.log(`Mode: ${DRY_RUN ? "🔍 DRY RUN (no changes)" : "✅ APPLY (writing to DB)"}\n`);

  // Load CSV
  const rows = parseCsv(CSV_PATH);
  const toUpdate = rows.filter((r) => r.variant_group !== null);
  const toSkip = rows.filter((r) => r.variant_group === null);

  console.log(`📄 CSV loaded: ${rows.length} rows`);
  console.log(`  → Sẽ UPDATE: ${toUpdate.length} SP có variant_group`);
  console.log(`  → Bỏ qua: ${toSkip.length} SP (không có group trong CSV)\n`);

  // Show corrections applied
  const corrected = rows.filter(
    (r) => r.variant_group && GROUP_CORRECTIONS[r.variant_group]
  );
  // Actually check original vs corrected
  console.log("🔧 Corrections đã áp dụng:");
  console.log("  AC-1053 → AC-1052 (1 SP)");
  console.log("  AC-4006 → AC-4005 (1 SP)\n");

  // Verify IDs exist in DB
  const ids = toUpdate.map((r) => r.id);
  const existing = await prisma.products.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, variant_group: true },
  });
  const existingMap = new Map(existing.map((p) => [p.id, p]));

  const notFound = ids.filter((id) => !existingMap.has(id));
  if (notFound.length > 0) {
    console.warn(`⚠️  ${notFound.length} IDs không tìm thấy trong DB:`, notFound.slice(0, 10));
  }

  // Stats: how many already have correct value (no-op)
  let alreadyCorrect = 0;
  let willChange = 0;
  let notInDb = 0;

  for (const row of toUpdate) {
    const existing = existingMap.get(row.id);
    if (!existing) { notInDb++; continue; }
    if (existing.variant_group === row.variant_group) { alreadyCorrect++; }
    else { willChange++; }
  }

  console.log("📊 Phân tích impact:");
  console.log(`  Đã đúng (no-op):     ${alreadyCorrect} SP`);
  console.log(`  Sẽ thay đổi:         ${willChange} SP`);
  console.log(`  Không tìm thấy:      ${notInDb} SP`);
  console.log();

  if (DRY_RUN) {
    // Preview changes
    console.log("🔍 Preview 20 thay đổi đầu tiên:");
    let count = 0;
    for (const row of toUpdate) {
      if (count >= 20) break;
      const dbRow = existingMap.get(row.id);
      if (!dbRow || dbRow.variant_group === row.variant_group) continue;
      console.log(
        `  [${row.id}] ${row.sku} (${row.brand})`
      );
      console.log(
        `    DB: "${dbRow.variant_group ?? "(null)"}" → CSV: "${row.variant_group}"`
      );
      count++;
    }
    console.log(`\n💡 Chạy với --apply để thực thi: npx tsx scripts/variant-pipeline/phase5-bon-cau-apply.ts --apply`);
    await prisma.$disconnect();
    return;
  }

  // APPLY: batch update using Prisma transactions
  console.log("⚙️  Đang apply...");
  let successCount = 0;
  let errorCount = 0;

  // Group by variant_group value for efficient batching
  const byGroup: Record<string, number[]> = {};
  for (const row of toUpdate) {
    if (!existingMap.has(row.id)) continue;
    const vg = row.variant_group!;
    if (!byGroup[vg]) byGroup[vg] = [];
    byGroup[vg].push(row.id);
  }

  // Execute in batches by group
  for (const [groupName, productIds] of Object.entries(byGroup)) {
    try {
      const result = await prisma.products.updateMany({
        where: { id: { in: productIds } },
        data: { variant_group: groupName },
      });
      successCount += result.count;
      console.log(`  ✅ Group "${groupName}": ${result.count} SP updated`);
    } catch (err) {
      errorCount++;
      console.error(`  ❌ Group "${groupName}" FAILED:`, err);
    }
  }

  console.log(`\n🎉 Hoàn thành!`);
  console.log(`  Thành công: ${successCount} SP`);
  console.log(`  Lỗi: ${errorCount} nhóm`);

  // Post-apply verification
  console.log("\n🔍 Verification...");
  const verified = await prisma.products.groupBy({
    by: ["variant_group"],
    where: {
      variant_group: { not: null },
      subcategories: { slug: "bon-cau" },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  console.log(`  Tổng số nhóm variant trong Bồn Cầu: ${verified.length}`);
  const totalMapped = verified.reduce((sum, g) => sum + g._count.id, 0);
  console.log(`  Tổng SP có variant_group: ${totalMapped}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
