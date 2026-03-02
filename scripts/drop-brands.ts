import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

async function main() {
  console.log("[1/3] Dropping brand_id from collections...");
  await prisma.$executeRawUnsafe(`ALTER TABLE collections DROP COLUMN IF EXISTS brand_id`);
  console.log("  ✓ Done.");

  console.log("[2/3] Dropping brand_id from products...");
  await prisma.$executeRawUnsafe(`ALTER TABLE products DROP COLUMN IF EXISTS brand_id`);
  console.log("  ✓ Done.");

  console.log("[3/3] Dropping brands table...");
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS brands CASCADE`);
  console.log("  ✓ Done.");

  // Verify
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const colsCollections = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collections' ORDER BY ordinal_position
  `;
  const colsProducts = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' ORDER BY ordinal_position
  `;

  console.log("\n--- Verification ---");
  console.log("Tables:", tables.map((t) => t.tablename).join(", "));
  console.log("collections columns:", colsCollections.map((c) => c.column_name).join(", "));
  console.log("products columns:", colsProducts.map((c) => c.column_name).join(", "));
  console.log("\n✅ Done!");
}

main()
  .catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
