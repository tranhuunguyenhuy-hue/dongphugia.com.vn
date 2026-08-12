import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const taxonomyRedirects = JSON.parse(readFileSync(
  resolve(process.cwd(), "src/data/catalog-taxonomy-v2-redirect-map.json"),
  "utf8",
)) as Record<string, string>

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/staging-ghcr.yml"),
  "utf8",
)
const existingStagingRepair = readFileSync(
  resolve(process.cwd(), "docs/deploy/staging-db-bootstrap/004_align_synthetic_product_contract.sql"),
  "utf8",
)

describe("staging Product structured-data smoke", () => {
  it.each(["in_stock", "out_of_stock", "quote_only"])(
    "requires the %s PDP fixture to return exact HTTP 200",
    (fixture) => {
      expect(workflow).toContain(`product_${fixture}_status=`)
      expect(workflow).toContain(`test "$product_${fixture}_status" = "200"`)
    },
  )

  it("checks every reviewed runtime redirect against the isolated staging app", () => {
    expect(workflow).toContain('name: Install repository tools for source smoke gates')
    expect(workflow).toContain('run: npm ci')
    expect(workflow).toContain("npm run seo:check-redirect-targets --")
    expect(workflow).toContain('--request-base-url="http://$smoke_ip:3000"')
    expect(workflow).toContain('--canonical-base-url="$STAGING_SITE_URL"')
  })

  it("lets an already bootstrapped staging database receive every redirect target fixture", () => {
    expect(existingStagingRepair).toContain("STG-DEMO-REDIRECT-001")
    expect(existingStagingRepair).toContain("STG-DEMO-REDIRECT-012")
    expect(existingStagingRepair).toContain("'vat-lieu-nuoc'")
    expect(existingStagingRepair).toContain('INSERT INTO "categories"')
    expect(existingStagingRepair).toContain('ON CONFLICT ("slug") DO NOTHING')
    expect(existingStagingRepair).toContain('ON CONFLICT ("category_id", "slug") DO NOTHING')
    expect(existingStagingRepair).toContain("Expected exactly twelve STG-DEMO redirect targets")
  })

  it("upgrades the legacy kitchen fixture into the required Contact for Quote fixture", () => {
    expect(existingStagingRepair).toContain("STG-DEMO-BEP-001")
    expect(existingStagingRepair).toContain("STG-DEMO-TBVS-003")
    expect(existingStagingRepair).toContain("Expected exactly one legacy staging fixture migration")
    expect(existingStagingRepair).toContain('"brand_id" = b."id"')
    expect(existingStagingRepair).toContain('"product_type_id" = pt."id"')
    expect(existingStagingRepair).toContain('"product_sub_type_id" = pst."id"')
    expect(existingStagingRepair).toContain('"sitemap_include" = true')
    expect(existingStagingRepair.match(/"sitemap_include" = true/g)).toHaveLength(2)
  })

  it("keeps every active redirect destination represented by a synthetic staging fixture", () => {
    const destinations = Object.values(taxonomyRedirects)
    expect(destinations).toHaveLength(12)

    for (const destination of destinations) {
      expect(destination).toMatch(/^\/vat-lieu-nuoc\/may-nuoc-nong\//)
      const slug = destination.split("/").at(-1)
      expect(existingStagingRepair).toContain(`'${slug}')`)
    }
  })
})
