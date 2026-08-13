import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const grants = readFileSync(
  resolve(process.cwd(), "docs/deploy/publishing-api-v1-runtime-grants.sql"),
  "utf8",
)
const manifest = readFileSync(
  resolve(process.cwd(), "docs/deploy/publishing-api-v1-runtime-grants.sha256"),
  "utf8",
).trim()

function tableGrantMap() {
  const result = new Map<string, string[]>()
  for (const match of grants.matchAll(
    /GRANT ([A-Z, ]+) ON TABLE\s+([\s\S]*?)\s+TO :"runtime_role";/g,
  )) {
    const privileges = match[1].split(",").map((value) => value.trim()).sort()
    const tables = match[2]
      .split(",")
      .map((value) => value.trim().replace(/^public\./, ""))
    for (const table of tables) result.set(table, privileges)
  }
  return result
}

describe("Publishing API v1 runtime grants artifact", () => {
  it("is an explicit, parameterized, atomic forward migration", () => {
    expect(grants).toContain("\\if :{?runtime_role}")
    expect(grants).toContain("\\set ON_ERROR_STOP on")
    expect(grants).toContain("SELECT 1 / 0;")
    expect(grants).not.toContain("\\quit")
    expect(grants).toContain("SET LOCAL search_path = pg_catalog, public;")
    expect(grants).toContain("BEGIN;")
    expect(grants.trimEnd()).toMatch(/COMMIT;$/)
    expect(grants).not.toContain("IF NOT EXISTS")
    expect(grants).not.toContain("CREATE OR REPLACE")
    expect(grants).not.toMatch(/\bALTER\s+OWNER\b/i)
    expect(grants).not.toMatch(/\bGRANT\s+ALL\b/i)
    expect(grants).not.toMatch(/\bTO\s+PUBLIC\b/i)
  })

  it("pins the reviewed deployment artifact", () => {
    const digest = createHash("sha256").update(grants).digest("hex")
    expect(manifest).toBe(`${digest}  publishing-api-v1-runtime-grants.sql`)
  })

  it("fails closed for an unexpected target, owner, or existing grant state", () => {
    for (const guard of [
      "Publishing runtime grants require --set=runtime_role=<application-runtime-role>",
      "Publishing runtime grants require exactly 11 Publishing tables",
      "Publishing runtime grants found an unexpected Publishing table",
      "Publishing runtime grants require the migration role to own every Publishing table",
      "Publishing runtime grants require exactly two Publishing identity sequences",
      "Publishing runtime grants found an unexpected Publishing sequence",
      "Publishing runtime grants require the migration role to own every Publishing sequence",
      "Publishing runtime role must exist, be a non-owner application login role, and differ from the migration role",
      "Publishing runtime role requires safe direct existing CMS privileges without ownership, PUBLIC access, grant option, or DDL access",
      "Publishing runtime role must have no inherited or SET ROLE membership path",
      "Publishing runtime role must not have CREATE on the public schema",
      "Publishing runtime grants require no column-level Publishing ACLs",
      "Publishing runtime grants require no row security on Publishing tables",
      "Publishing runtime grants require the reviewed immutable audit function",
      "Publishing runtime grants require the reviewed enabled append-only audit trigger",
      "Publishing runtime grants require no PUBLIC table or sequence grants",
      "Publishing runtime grants require either zero privileges or the exact desired ACL state",
      "Publishing runtime grants postcondition failed",
    ]) {
      expect(grants).toContain(guard)
    }
  })

  it("grants only the Publishing runtime surface and preserves immutable audit rows", () => {
    const tableGrants = tableGrantMap()
    expect(Object.fromEntries(tableGrants)).toEqual({
      publishing_machine_identities: ["SELECT"],
      publishing_identity_capabilities: ["SELECT"],
      publishing_credentials: ["SELECT"],
      publishing_identity_ip_allowlist: ["SELECT"],
      publishing_global_controls: ["SELECT"],
      publishing_managed_media: ["INSERT", "SELECT", "UPDATE"],
      publishing_rate_limit_windows: ["INSERT", "SELECT", "UPDATE"],
      publishing_idempotency_records: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      publishing_blog_post_media: ["DELETE", "INSERT", "SELECT"],
      publishing_scheduler_state: ["INSERT", "SELECT", "UPDATE"],
      publishing_audit_events: ["INSERT"],
    })

    expect(grants).toContain("publishing_audit_events_id_seq")
    expect(grants).toContain("publishing_identity_ip_allowlist_id_seq")
    expect(grants).toMatch(
      /GRANT USAGE ON SEQUENCE\s+public\.publishing_audit_events_id_seq,\s+public\.publishing_identity_ip_allowlist_id_seq\s+TO :"runtime_role";/,
    )
    expect(grants).toContain("public.publishing_audit_events")
    expect(grants).not.toMatch(/ON TABLE\s+publishing_/)
    expect(grants).not.toMatch(/ON SEQUENCE\s+publishing_/)
    expect(grants).toContain("('TRUNCATE')")
    expect(grants).toContain("('UPDATE')) checked(privilege_type)")
    expect(grants).toContain("tgtype = 27")
    expect(grants).toContain("Exact desired state: safe idempotent rerun")
  })

  it("requires the pre-existing CMS ACL surface without granting or changing it", () => {
    expect(grants).toContain("publishing_required_legacy_table_privileges")
    const legacyPrivilegeMap = [...grants.matchAll(
      /\('(blog_categories|blog_tags|blog_post_tags|blog_posts)', '(SELECT|INSERT|UPDATE|DELETE)'\)/g,
    )]
      .map((match) => `${match[1]}:${match[2]}`)
      .sort()
    expect(legacyPrivilegeMap).toEqual([
        "blog_categories:SELECT",
        "blog_post_tags:DELETE",
        "blog_post_tags:INSERT",
        "blog_post_tags:SELECT",
        "blog_posts:INSERT",
        "blog_posts:SELECT",
        "blog_posts:UPDATE",
        "blog_tags:SELECT",
      ])
    expect(grants).toContain("('blog_tags', 'post_count', 'UPDATE')")
    expect(grants).toContain("legacy_sequence.relname = 'blog_posts_id_seq'")
    expect(grants).toContain("privilege.grantee = target_role_oid")
    expect(grants).toContain("privilege.grantee = 0")
    expect(grants).toContain("NOT privilege.is_grantable")
    expect(grants).toContain("privilege.is_grantable")
    expect(grants).toContain("legacy_table.relowner = target_role_oid")
    expect(grants).toContain("legacy_sequence.relowner = target_role_oid")
    expect(grants).toContain("('TRUNCATE'), ('REFERENCES'), ('TRIGGER')")
    expect(grants).toContain("(VALUES ('UPDATE')) checked(privilege_type)")
    expect(grants).not.toMatch(/GRANT [^;]*\bblog_(?:categories|tags|post_tags|posts)\b/i)
  })
})
