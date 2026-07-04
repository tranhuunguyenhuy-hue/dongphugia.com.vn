import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output')
const LEGACY_PLAN_PATH = path.join(
  OUTPUT_DIR,
  'catalog-taxonomy-v2-legacy-migration-plan.json'
)
const REDIRECT_JSON_PATH = path.join(
  OUTPUT_DIR,
  'catalog-taxonomy-v2-redirect-map.json'
)
const REDIRECT_MD_PATH = path.join(
  OUTPUT_DIR,
  'catalog-taxonomy-v2-redirect-map.md'
)

type LegacyPlanRow = {
  productId: number
  sku: string
  name: string
  currentPublicUrl: string | null
  proposedCanonicalUrl: string | null
  seoRiskLevel: 'medium' | 'high'
  scope: 'listing_eligible' | 'search_only' | 'public_pdp_non_listing' | 'hidden_or_private'
  migrationGroup:
    | 'thiet-bi-ve-sinh -> gach-op-lat'
    | 'thiet-bi-ve-sinh -> vat-lieu-nuoc'
    | 'thiet-bi-ve-sinh -> thiet-bi-bep'
}

type LegacyPlanJson = {
  generatedAt: string
  summary: {
    legacyCaseCount: number
  }
  rows?: LegacyPlanRow[]
  cases?: LegacyPlanRow[]
}

type RedirectRow = {
  product_id: number
  sku: string
  name: string
  old_url: string
  new_url: string
  status_code: 301
  source: 'catalog_taxonomy_v2_legacy_plan'
  risk_level: 'medium' | 'high'
  scope: LegacyPlanRow['scope']
  migration_group: LegacyPlanRow['migrationGroup']
}

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function toRelativeUrl(url: string) {
  return new URL(url).pathname
}

function buildMarkdownTable(rows: string[][]) {
  if (rows.length === 0) return '_No rows_'
  const separator = rows[0].map(() => '---')
  return [rows[0], separator, ...rows.slice(1)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n')
}

function summarizeBy<T extends string>(items: T[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  if (!fs.existsSync(LEGACY_PLAN_PATH)) {
    throw new Error(`Missing required artifact: ${LEGACY_PLAN_PATH}`)
  }

  const legacyPlan = readJsonFile<LegacyPlanJson>(LEGACY_PLAN_PATH)

  const legacyRows = legacyPlan.rows ?? legacyPlan.cases ?? []

  const redirects = legacyRows
    .filter((row) => row.currentPublicUrl && row.proposedCanonicalUrl)
    .map<RedirectRow>((row) => ({
      product_id: row.productId,
      sku: row.sku,
      name: row.name,
      old_url: toRelativeUrl(row.currentPublicUrl!),
      new_url: toRelativeUrl(row.proposedCanonicalUrl!),
      status_code: 301,
      source: 'catalog_taxonomy_v2_legacy_plan',
      risk_level: row.seoRiskLevel,
      scope: row.scope,
      migration_group: row.migrationGroup,
    }))

  const duplicateOldUrls = [...new Set(
    redirects
      .map((row) => row.old_url)
      .filter((url, index, list) => list.indexOf(url) !== index)
  )]

  const selfRedirects = redirects.filter((row) => row.old_url === row.new_url)
  const redirectPairs = new Set(redirects.map((row) => `${row.old_url}=>${row.new_url}`))
  const loopPairs = redirects.filter((row) =>
    redirectPairs.has(`${row.new_url}=>${row.old_url}`)
  )

  if (duplicateOldUrls.length > 0) {
    throw new Error(`Duplicate old_url entries detected: ${duplicateOldUrls.slice(0, 5).join(', ')}`)
  }
  if (selfRedirects.length > 0) {
    throw new Error(`Self redirect detected for SKU(s): ${selfRedirects.map((row) => row.sku).join(', ')}`)
  }
  if (loopPairs.length > 0) {
    throw new Error(`Redirect loop pair detected for SKU(s): ${loopPairs.map((row) => row.sku).join(', ')}`)
  }

  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    summary: {
      redirectCount: redirects.length,
      legacyCaseCount: legacyPlan.summary.legacyCaseCount,
      duplicateOldUrlCount: duplicateOldUrls.length,
      selfRedirectCount: selfRedirects.length,
      loopPairCount: loopPairs.length,
      riskBreakdown: Object.fromEntries(summarizeBy(redirects.map((row) => row.risk_level))),
      scopeBreakdown: Object.fromEntries(summarizeBy(redirects.map((row) => row.scope))),
      migrationGroupBreakdown: Object.fromEntries(
        summarizeBy(redirects.map((row) => row.migration_group))
      ),
    },
    redirects,
  }

  const markdown = [
    '# Catalog Taxonomy v2 Redirect Map',
    '',
    `Generated at: ${jsonOutput.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Redirect rows: ${jsonOutput.summary.redirectCount}`,
    `- Legacy migration cases: ${jsonOutput.summary.legacyCaseCount}`,
    `- Duplicate old URLs: ${jsonOutput.summary.duplicateOldUrlCount}`,
    `- Self redirects: ${jsonOutput.summary.selfRedirectCount}`,
    `- Loop pairs: ${jsonOutput.summary.loopPairCount}`,
    '',
    '## Migration Group Breakdown',
    '',
    ...summarizeBy(redirects.map((row) => row.migration_group)).map(
      ([group, count]) => `- ${group}: ${count}`
    ),
    '',
    '## Risk Breakdown',
    '',
    ...summarizeBy(redirects.map((row) => row.risk_level)).map(
      ([risk, count]) => `- ${risk}: ${count}`
    ),
    '',
    '## Sample Redirects',
    '',
    buildMarkdownTable([
      ['SKU', 'Old URL', 'New URL', 'Risk', 'Group'],
      ...redirects.slice(0, 15).map((row) => [
        row.sku,
        row.old_url,
        row.new_url,
        row.risk_level,
        row.migration_group,
      ]),
    ]),
    '',
    '## Integration Notes',
    '',
    '- This artifact is read-only planning output for Goal 4a.',
    '- Middleware/runtime redirect integration should consume this map only after Goal 4b verification confirms no canonical or redirect loops.',
    '- Goal 3b legacy category migration must not run until redirect/canonical behavior is verified end-to-end.',
    '',
  ].join('\n')

  fs.writeFileSync(REDIRECT_JSON_PATH, `${JSON.stringify(jsonOutput, null, 2)}\n`)
  fs.writeFileSync(REDIRECT_MD_PATH, markdown)

  console.log(JSON.stringify(jsonOutput.summary, null, 2))
}

main()
