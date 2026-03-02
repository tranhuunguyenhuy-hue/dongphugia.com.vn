/**
 * add-quote-requests.ts
 * Tạo bảng quote_requests trong DB (nếu chưa có).
 * Sử dụng DIRECT_URL để bypass PgBouncer limitations.
 */

import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

async function main() {
  console.log("=".repeat(50));
  console.log("  Adding quote_requests table");
  console.log("=".repeat(50));

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS quote_requests (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      phone      VARCHAR(20) NOT NULL,
      email      VARCHAR(100),
      message    TEXT,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      status     VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ Table quote_requests created (or already exists)");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_quote_requests_status
      ON quote_requests(status)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_quote_requests_created
      ON quote_requests(created_at DESC)
  `);
  console.log("✓ Indexes created");

  // Verify
  const result = await prisma.$queryRaw<{ count: string }[]>`
    SELECT COUNT(*) as count FROM quote_requests
  `;
  console.log(`✓ quote_requests records: ${result[0].count}`);
  console.log("\n✅ Migration complete!\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Migration failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
