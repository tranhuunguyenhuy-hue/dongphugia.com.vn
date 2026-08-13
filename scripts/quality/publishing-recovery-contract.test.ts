import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const rootMigration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260812205000_publishing_api_v1/migration.sql"),
  "utf8",
)
const recovery = readFileSync(
  resolve(process.cwd(), "docs/deploy/publishing-api-v1-production-recovery.sql"),
  "utf8",
)

const reviewedTail = rootMigration.slice(
  rootMigration.indexOf("CREATE TABLE IF NOT EXISTS publishing_machine_identities ("),
)
  .replaceAll("CREATE TABLE IF NOT EXISTS", "CREATE TABLE")
  .replaceAll("CREATE UNIQUE INDEX IF NOT EXISTS", "CREATE UNIQUE INDEX")
  .replaceAll("CREATE INDEX IF NOT EXISTS", "CREATE INDEX")
  .replace(
    "CREATE OR REPLACE FUNCTION publishing_audit_events_append_only()",
    "CREATE FUNCTION publishing_audit_events_append_only()",
  )
  .replace(
    /DROP TRIGGER IF EXISTS publishing_audit_events_append_only_trigger\n  ON publishing_audit_events;\n/,
    "",
  )
  .replace(
    /INSERT INTO publishing_global_controls \(id, publishing_enabled, version\)\nVALUES \(1, false, 1\)\nON CONFLICT \(id\) DO NOTHING;/,
    "INSERT INTO publishing_global_controls (id, publishing_enabled, version)\nVALUES (1, false, 1);",
  )
  .replace(
    /INSERT INTO publishing_scheduler_state \(id\)\nVALUES \(1\)\nON CONFLICT \(id\) DO NOTHING;/,
    "INSERT INTO publishing_scheduler_state (id)\nVALUES (1);",
  )
  .trim()

describe("Publishing API v1 production recovery artifact", () => {
  it("stays outside Prisma discovery and is atomic", () => {
    expect(recovery).toContain("BEGIN;")
    expect(recovery.trimEnd()).toMatch(/COMMIT;$/)
    expect(recovery).not.toContain("\\ir ")
    expect(recovery).not.toContain("IF NOT EXISTS")
    expect(recovery).not.toContain("CREATE OR REPLACE")
    expect(recovery).not.toContain("DROP TRIGGER IF EXISTS")
  })

  it("fails closed unless the exact known partial state is present", () => {
    for (const guard of [
      "LOCK TABLE blog_posts, blog_tags IN ACCESS EXCLUSIVE MODE;",
      "Publishing recovery requires no existing Publishing tables",
      "Publishing recovery requires no existing Publishing audit function",
      "Publishing recovery requires no existing Publishing audit trigger",
      "Publishing recovery requires no existing Publishing indexes",
      "Publishing recovery requires no existing Publishing blog_posts constraints",
      "Publishing recovery requires exactly the known partial blog_posts column definitions",
      "Publishing recovery requires exactly the known partial blog_tags column definitions",
      "Publishing recovery requires the reviewed editorial byline default",
      "Publishing recovery requires exactly one blog_posts status constraint",
      "Publishing recovery requires the known legacy blog_posts lifecycle constraint",
    ]) {
      expect(recovery).toContain(guard)
    }

    expect(recovery).not.toMatch(/\b(GRANT|REVOKE|OWNER TO|ALTER OWNER)\b/i)
  })

  it("keeps the completed v1 schema as a strict snapshot of the reviewed migration", () => {
    const recoveryTail = recovery.slice(
      recovery.indexOf("CREATE TABLE publishing_machine_identities ("),
      recovery.lastIndexOf("\n\nCOMMIT;"),
    ).trim()

    expect(recoveryTail).toBe(reviewedTail)
  })
})
