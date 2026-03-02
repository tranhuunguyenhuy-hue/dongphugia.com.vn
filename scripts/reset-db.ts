/**
 * reset-db.ts
 * 1. Drop all tables in public schema (CASCADE)
 * 2. Execute prisma/new-schema.sql (schema + seed)
 * 3. Report record counts
 *
 * Uses DIRECT_URL to bypass PgBouncer limitations on DDL operations.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

/** Strip SQL comments and split into individual statements */
function parseStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function dropAllTables() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  if (tables.length === 0) {
    console.log("  No tables found.");
    return;
  }

  const tableList = tables.map((t) => `"${t.tablename}"`).join(", ");
  console.log(`  Dropping ${tables.length} tables: ${tables.map((t) => t.tablename).join(", ")}`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${tableList} CASCADE`);
  console.log("  ✓ All tables dropped.");
}

async function runSchemaSQL() {
  const sqlPath = path.join(__dirname, "../prisma/new-schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = parseStatements(sql);

  console.log(`  Found ${statements.length} SQL statements to execute...`);

  let executed = 0;
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      executed++;
    } catch (err: any) {
      console.error(`\n  ✗ Error on statement:\n  ${stmt.slice(0, 120)}...\n  ${err.message}`);
      throw err;
    }
  }

  console.log(`  ✓ Executed ${executed} statements successfully.`);
}

async function countRecords() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  const counts: { table: string; count: number }[] = [];
  let total = 0;

  for (const { tablename } of tables) {
    const result = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM "${tablename}"`
    );
    const count = parseInt(result[0].count, 10);
    counts.push({ table: tablename, count });
    total += count;
  }

  return { counts, total };
}

async function main() {
  console.log("=".repeat(50));
  console.log("  DATABASE RESET — Đông Phú Gia");
  console.log("=".repeat(50));

  console.log("\n[1/3] Dropping existing tables...");
  await dropAllTables();

  console.log("\n[2/3] Running new-schema.sql...");
  await runSchemaSQL();

  console.log("\n[3/3] Counting records...");
  const { counts, total } = await countRecords();

  console.log("\n" + "=".repeat(50));
  console.log("  RESULT");
  console.log("=".repeat(50));
  console.log("Table".padEnd(25) + "Records");
  console.log("-".repeat(35));
  for (const { table, count } of counts) {
    console.log(table.padEnd(25) + count);
  }
  console.log("-".repeat(35));
  console.log("TOTAL".padEnd(25) + total);
  console.log("\n✅ Database reset complete!\n");
}

main()
  .catch((e) => { console.error("\n❌ Reset failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
