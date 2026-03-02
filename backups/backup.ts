import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, "2026-03-01");

function toInsertSQL(tableName: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- ${tableName}: no records\n`;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const values = rows.map((row) => {
    const vals = cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      if (typeof v === "number") return String(v);
      if (v instanceof Date) return `'${v.toISOString()}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    return `(${vals.join(", ")})`;
  });
  return (
    `INSERT INTO "${tableName}" (${colList}) VALUES\n` +
    values.join(",\n") +
    `;\n`
  );
}

async function backup() {
  const summary: { table: string; count: number }[] = [];

  const tables: { name: string; fetch: () => Promise<Record<string, unknown>[]> }[] = [
    { name: "AdminUser",    fetch: () => prisma.adminUser.findMany()    as any },
    { name: "Category",     fetch: () => prisma.category.findMany()     as any },
    { name: "Brand",        fetch: () => prisma.brand.findMany()        as any },
    { name: "ProductType",  fetch: () => prisma.productType.findMany()  as any },
    { name: "Collection",   fetch: () => prisma.collection.findMany()   as any },
    { name: "ProductGroup", fetch: () => prisma.productGroup.findMany() as any },
    { name: "Product",      fetch: () => prisma.product.findMany()      as any },
    { name: "Banner",       fetch: () => prisma.banner.findMany()       as any },
    { name: "Post",         fetch: () => prisma.post.findMany()         as any },
    { name: "Partner",      fetch: () => prisma.partner.findMany()      as any },
    { name: "Project",      fetch: () => prisma.project.findMany()      as any },
    { name: "QuoteRequest", fetch: () => prisma.quoteRequest.findMany() as any },
    { name: "QuoteItem",    fetch: () => prisma.quoteItem.findMany()    as any },
  ];

  // SQL header
  let fullSQL = `-- Đông Phú Gia — Full Database Backup\n-- Date: ${new Date().toISOString()}\n-- Database: Supabase PostgreSQL\n\n`;

  for (const { name, fetch } of tables) {
    console.log(`Backing up ${name}...`);
    const rows = await fetch();

    // JSON
    fs.writeFileSync(
      path.join(BACKUP_DIR, `${name}.json`),
      JSON.stringify(rows, null, 2),
      "utf8"
    );

    // SQL
    const sql = toInsertSQL(name, rows);
    fs.writeFileSync(path.join(BACKUP_DIR, `${name}.sql`), sql, "utf8");
    fullSQL += `-- ==================== ${name} (${rows.length} records) ====================\n`;
    fullSQL += sql + "\n";

    summary.push({ table: name, count: rows.length });
  }

  // Combined SQL dump
  fs.writeFileSync(path.join(BACKUP_DIR, "full_backup.sql"), fullSQL, "utf8");

  // Summary JSON
  const meta = {
    backedUpAt: new Date().toISOString(),
    tables: summary,
    totalRecords: summary.reduce((s, t) => s + t.count, 0),
  };
  fs.writeFileSync(path.join(BACKUP_DIR, "_summary.json"), JSON.stringify(meta, null, 2), "utf8");

  console.log("\n✅ Backup complete!\n");
  console.log("Table".padEnd(20) + "Records");
  console.log("-".repeat(30));
  for (const { table, count } of summary) {
    console.log(table.padEnd(20) + count);
  }
  console.log("-".repeat(30));
  console.log("TOTAL".padEnd(20) + meta.totalRecords);
}

backup()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
