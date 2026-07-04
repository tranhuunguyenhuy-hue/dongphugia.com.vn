import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const argv = process.argv.slice(2)
const executeMode = argv.includes('--execute')
const scopeArg = argv.find((arg) => arg.startsWith('--scope='))?.split('=')[1] ?? null
const confirmArg = argv.find((arg) => arg.startsWith('--confirm='))?.split('=')[1] ?? null

type TaxonSlug =
  | 'thiet-bi-ve-sinh'
  | 'thiet-bi-bep'
  | 'vat-lieu-nuoc'
  | 'gach-op-lat'
  | 'bon-cau'
  | 'nap-bon-cau'
  | 'lavabo'
  | 'voi-chau'
  | 'sen-tam'
  | 'bon-tam'
  | 'bon-tieu'
  | 'phu-kien-phong-tam'
  | 'guong-phong-tam'
  | 'ga-thoat-san'
  | 'may-say-tay'
  | 'chau-rua-chen'
  | 'voi-rua-chen'
  | 'phu-kien-chau-rua-chen'
  | 'bep-dien-tu'
  | 'bep-gas'
  | 'may-hut-mui'
  | 'may-rua-chen'
  | 'lo-nuong'
  | 'phu-kien-bep'
  | 'thiet-bi-bep-khac'
  | 'may-nuoc-nong'
  | 'loc-nuoc'
  | 'bon-chua-nuoc'
  | 'may-bom-nuoc'
  | 'phu-kien-vat-lieu-nuoc'
  | 'gach-op-tuong'
  | 'gach-lat-nen'
  | 'gach-trang-tri'
  | 'gach-inax-ecocarat'

type SignalSource =
  | 'current_subcategory'
  | 'product_type'
  | 'source_url'
  | 'source_breadcrumb'
  | 'name_keyword'
  | 'category_root'
  | 'manual_review'

type Candidate = {
  taxonSlug: TaxonSlug
  score: number
  details: string[]
  sources: Set<SignalSource>
}

type Proposal = {
  productId: number
  sku: string
  name: string
  brand: string | null
  categorySlug: string | null
  currentSubcategorySlug: string | null
  productType: string | null
  productSubType: string | null
  publicationStatus: string
  pdpVisibility: string
  listingVisibility: string
  isActive: boolean
  sourceUrl: string | null
  proposedPrimaryTaxonSlug: string | null
  proposedPrimaryCanonicalPath: string | null
  proposedPrimaryIsRoot: boolean
  proposedSecondaryTaxonSlug: string | null
  proposedSecondaryCanonicalPath: string | null
  confidence: number
  scope: 'listing_eligible' | 'search_only' | 'public_pdp_non_listing' | 'hidden_or_private'
  acceptedAutoProposal: boolean
  manualReview: boolean
  blocked: boolean
  rootFallback: boolean
  lowConfidence: boolean
  needsPdp404Review: boolean
  listingEligibleRouteRisk: boolean
  publicPdpRouteRisk: boolean
  crossCategoryIssue: boolean
  crossRootMove: boolean
  reasons: string[]
  sources: SignalSource[]
}

type ResolutionBucket =
  | 'safe_auto_after_rule'
  | 'needs_manual_approval'
  | 'blocked_missing_taxon'
  | 'requires_legacy_category_migration'
  | 'requires_new_taxon'

type ResolutionCase = {
  productId: number
  sku: string
  name: string
  brand: string | null
  scope: Proposal['scope']
  categorySlug: string | null
  currentSubcategorySlug: string | null
  productType: string | null
  proposedPrimaryTaxonSlug: string | null
  proposedPrimaryCanonicalPath: string | null
  confidence: number
  resolution: ResolutionBucket
  reason: string
  sourceUrl: string | null
}

type FinalDecisionBucket =
  | 'safe_for_assignment_only'
  | 'requires_legacy_category_migration'
  | 'needs_manual_business_decision'

type FinalDecisionCase = {
  productId: number
  sku: string
  name: string
  brand: string | null
  currentLegacyCategorySlug: string | null
  currentLegacySubcategorySlug: string | null
  targetTaxonSlug: string | null
  targetCanonicalPath: string | null
  confidence: number
  scope: Proposal['scope']
  decision: FinalDecisionBucket
  rationale: string
  sourceUrl: string | null
}

type Summary = {
  scannedProducts: number
  publicPdpCount: number
  listingEligibleCount: number
  searchOnlyCount: number
  hiddenOrPrivateCount: number
  activeProducts: number
  proposedPrimaryTaxonCount: number
  autoReadyCount: number
  manualReviewCount: number
  blockedCount: number
  rootFallbackCount: number
  lowConfidenceCount: number
  crossRootMoveCount: number
  activeNullSubcategoryCount: number
  publicPdpNullSubcategoryCount: number
  nullSubcategoryRouteRiskCount: number
  listingEligibleRouteRiskCount: number
  publicPdpRouteRiskCount: number
  crossCategoryProductTypeIssueCount: number
  futureListingEligibleWithoutAcceptedPrimaryTaxonCount: number
}

type ExecuteSnapshot = {
  productsCount: number
  activeProductsCount: number
  productTaxonAssignmentsCount: number
  primaryAssignmentsCount: number
}

type ExecuteResult = {
  executed: boolean
  scope: string
  confirmed: boolean
  candidateCount: number
  skippedDueToPrimaryConflictCount: number
  demotedExistingBackfillPrimaryCount: number
  insertedOrUpdatedCount: number
  assignedCandidateCount: number
  excludedLegacyMigrationCount: number
  excludedManualDecisionCount: number
  excludedBlockedCount: number
  legacyCaseAssignedCount: number
  primaryViolationsAfter: number
  before: ExecuteSnapshot
  after: ExecuteSnapshot
  skippedPrimaryConflictSamples: Array<{
    productId: number
    sku: string
    existingTaxonId: number
    existingSource: string
    targetTaxonId: number
  }>
}

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output')

const ROOT_BY_CATEGORY_SLUG: Record<string, TaxonSlug> = {
  'thiet-bi-ve-sinh': 'thiet-bi-ve-sinh',
  'thiet-bi-bep': 'thiet-bi-bep',
  'vat-lieu-nuoc': 'vat-lieu-nuoc',
  'gach-op-lat': 'gach-op-lat',
}

const ROOT_OF_TAXON: Record<TaxonSlug, TaxonSlug> = {
  'thiet-bi-ve-sinh': 'thiet-bi-ve-sinh',
  'bon-cau': 'thiet-bi-ve-sinh',
  'nap-bon-cau': 'thiet-bi-ve-sinh',
  'lavabo': 'thiet-bi-ve-sinh',
  'voi-chau': 'thiet-bi-ve-sinh',
  'sen-tam': 'thiet-bi-ve-sinh',
  'bon-tam': 'thiet-bi-ve-sinh',
  'bon-tieu': 'thiet-bi-ve-sinh',
  'phu-kien-phong-tam': 'thiet-bi-ve-sinh',
  'guong-phong-tam': 'thiet-bi-ve-sinh',
  'ga-thoat-san': 'thiet-bi-ve-sinh',
  'may-say-tay': 'thiet-bi-ve-sinh',
  'thiet-bi-bep': 'thiet-bi-bep',
  'chau-rua-chen': 'thiet-bi-bep',
  'voi-rua-chen': 'thiet-bi-bep',
  'phu-kien-chau-rua-chen': 'thiet-bi-bep',
  'bep-dien-tu': 'thiet-bi-bep',
  'bep-gas': 'thiet-bi-bep',
  'may-hut-mui': 'thiet-bi-bep',
  'may-rua-chen': 'thiet-bi-bep',
  'lo-nuong': 'thiet-bi-bep',
  'phu-kien-bep': 'thiet-bi-bep',
  'thiet-bi-bep-khac': 'thiet-bi-bep',
  'vat-lieu-nuoc': 'vat-lieu-nuoc',
  'may-nuoc-nong': 'vat-lieu-nuoc',
  'loc-nuoc': 'vat-lieu-nuoc',
  'bon-chua-nuoc': 'vat-lieu-nuoc',
  'may-bom-nuoc': 'vat-lieu-nuoc',
  'phu-kien-vat-lieu-nuoc': 'vat-lieu-nuoc',
  'gach-op-lat': 'gach-op-lat',
  'gach-op-tuong': 'gach-op-lat',
  'gach-lat-nen': 'gach-op-lat',
  'gach-trang-tri': 'gach-op-lat',
  'gach-inax-ecocarat': 'gach-op-lat',
}

const DIRECT_SUBCATEGORY_MAP: Record<string, TaxonSlug> = {
  'bon-cau': 'bon-cau',
  'nap-bon-cau': 'nap-bon-cau',
  'lavabo': 'lavabo',
  'voi-chau': 'voi-chau',
  'sen-tam': 'sen-tam',
  'bon-tam': 'bon-tam',
  'bon-tieu': 'bon-tieu',
  'phu-kien-phong-tam': 'phu-kien-phong-tam',
  'phu-kien-bon-cau': 'bon-cau',
  'chau-rua-chen': 'chau-rua-chen',
  'voi-rua-chen': 'voi-rua-chen',
  'bep-dien-tu': 'bep-dien-tu',
  'bep-gas': 'bep-gas',
  'may-hut-mui': 'may-hut-mui',
  'may-rua-chen': 'may-rua-chen',
  'lo-nuong': 'lo-nuong',
  'thiet-bi-bep-khac': 'thiet-bi-bep-khac',
  'loc-nuoc': 'loc-nuoc',
  'may-nuoc-nong': 'may-nuoc-nong',
  'bon-chua-nuoc': 'bon-chua-nuoc',
  'may-bom-nuoc': 'may-bom-nuoc',
  'gach-trang-tri': 'gach-trang-tri',
  'gach-van-da-marble': 'gach-op-lat',
  'gach-thiet-ke-xi-mang': 'gach-op-lat',
  'gach-van-da-tu-nhien': 'gach-op-lat',
  'gach-van-go': 'gach-op-lat',
}

const TAXON_WITH_BROAD_SECONDARY: Partial<Record<TaxonSlug, TaxonSlug>> = {
  'guong-phong-tam': 'phu-kien-phong-tam',
  'ga-thoat-san': 'phu-kien-phong-tam',
  'may-say-tay': 'phu-kien-phong-tam',
  'gach-inax-ecocarat': 'gach-op-lat',
}

const FINAL_DECISION_OVERRIDES: Record<
  string,
  { targetTaxonSlug: TaxonSlug; rationale: string }
> = {
  'KF-414V': {
    targetTaxonSlug: 'phu-kien-phong-tam',
    rationale: 'Name, source URL, and PDP description all identify this as a bathroom soap holder accessory.',
  },
  'KF-646V': {
    targetTaxonSlug: 'phu-kien-phong-tam',
    rationale: 'Name, source URL, and PDP description all identify this as a bathroom toilet-paper holder accessory.',
  },
  MCL117967: {
    targetTaxonSlug: 'phu-kien-chau-rua-chen',
    rationale: 'PDP description explicitly places this product under kitchen sink accessories and describes a drinking-water faucet accessory.',
  },
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function slugifyKey(value: string | null | undefined) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function isPublicPdp(product: {
  publicationStatus: string
  pdpVisibility: string
}) {
  return product.publicationStatus === 'public' && product.pdpVisibility === 'public'
}

function isListingEligible(product: {
  publicationStatus: string
  pdpVisibility: string
  listingVisibility: string
}) {
  return (
    isPublicPdp(product) &&
    !['hidden', 'search_only'].includes(product.listingVisibility)
  )
}

function classifyScope(product: {
  publicationStatus: string
  pdpVisibility: string
  listingVisibility: string
}) {
  if (!isPublicPdp(product)) return 'hidden_or_private' as const
  if (product.listingVisibility === 'search_only') return 'search_only' as const
  if (product.listingVisibility === 'hidden') return 'public_pdp_non_listing' as const
  return 'listing_eligible' as const
}

function isRootTaxonSlug(taxonSlug: string | null) {
  return taxonSlug !== null && Object.values(ROOT_BY_CATEGORY_SLUG).includes(taxonSlug as TaxonSlug)
}

function matchKeyword(haystack: string, patterns: string[]) {
  return patterns.some((pattern) => haystack.includes(pattern))
}

function hasStrongKeywordEvidence(
  taxonSlug: TaxonSlug,
  name: string,
  sourceUrl: string | null,
  productType: string | null
) {
  const haystack = `${normalize(name)} ${normalize(sourceUrl)} ${normalize(productType)}`

  switch (taxonSlug) {
    case 'chau-rua-chen':
      return matchKeyword(haystack, [
        'chau rua chen',
        'chau rua bat',
        'bon xa chau rua chen',
        'gio dat len chau rua chen',
        'khay dat len chau rua chen',
      ])
    case 'voi-rua-chen':
      return matchKeyword(haystack, ['voi rua chen', 'voi bep'])
    case 'phu-kien-phong-tam':
      return matchKeyword(haystack, [
        'ke xa phong',
        'ke dung xa phong',
        'gia treo khan',
        'moc treo',
        'hop dung giay',
        'binh xa phong',
        'lo ban chai',
        'phu kien',
        'gia treo',
        'ke kinh',
      ])
    case 'phu-kien-bep':
      return matchKeyword(haystack, ['ke bep', 'ke bep da nang'])
    case 'phu-kien-chau-rua-chen':
      return matchKeyword(haystack, ['voi uong nuoc', 'phu kien chau rua chen'])
    case 'bon-cau':
      return matchKeyword(haystack, ['bon cau', 'than bon cau'])
    case 'voi-chau':
      return matchKeyword(haystack, ['voi chau', 'voi lavabo'])
    case 'may-say-tay':
      return matchKeyword(haystack, ['may say tay', 'jt-'])
    case 'may-nuoc-nong':
      return matchKeyword(haystack, ['may nuoc nong'])
    case 'gach-inax-ecocarat':
      return matchKeyword(haystack, ['ecocarat'])
    case 'gach-op-tuong':
      return matchKeyword(haystack, ['gach op tuong'])
    case 'gach-op-lat':
      return matchKeyword(haystack, ['gach', 'tile'])
    default:
      return false
  }
}

function createCandidateMap() {
  return new Map<TaxonSlug, Candidate>()
}

function addCandidate(
  map: Map<TaxonSlug, Candidate>,
  taxonSlug: TaxonSlug,
  score: number,
  source: SignalSource,
  detail: string
) {
  const existing = map.get(taxonSlug)
  if (existing) {
    existing.score += score
    existing.details.push(detail)
    existing.sources.add(source)
    return
  }

  map.set(taxonSlug, {
    taxonSlug,
    score,
    details: [detail],
    sources: new Set([source]),
  })
}

function rootOf(taxonSlug: TaxonSlug | null) {
  return taxonSlug ? ROOT_OF_TAXON[taxonSlug] : null
}

function inferFromProductType(productType: string | null): TaxonSlug | null {
  const normalized = slugifyKey(productType)

  if (!normalized) return null
  if (normalized === 'voi-rua-chen') return 'voi-rua-chen'
  if (normalized === 'chau-rua-chen') return 'chau-rua-chen'
  if (normalized === 'phu-kien-chau-rua-chen' || normalized === 'phu-kien-voi-rua-chen') return 'phu-kien-chau-rua-chen'
  if (normalized.startsWith('bep-dien')) return 'bep-dien-tu'
  if (normalized.startsWith('bep-gas')) return 'bep-gas'
  if (normalized.startsWith('may-hut-mui')) return 'may-hut-mui'
  if (normalized.startsWith('may-rua-chen')) return 'may-rua-chen'
  if (normalized.startsWith('lo-nuong')) return 'lo-nuong'
  if (normalized.includes('phu-kien-bep')) return 'phu-kien-bep'

  if (normalized.startsWith('bon-cau') || normalized === 'phu-kien-bon-cau' || normalized === 'ket-nuoc' || normalized === 'nap-ket-nuoc') return 'bon-cau'
  if (normalized.startsWith('nap-') || normalized.includes('washlet')) return 'nap-bon-cau'
  if (normalized.startsWith('lavabo') || normalized === 'chan-chau-lavabo' || normalized === 'tu-chau') return 'lavabo'
  if (normalized === 'voi-rua-mat' || normalized.startsWith('voi-') || normalized === 'phu-kien-voi') return 'voi-chau'
  if (normalized.startsWith('sen-') || normalized.startsWith('bo-sen') || normalized.startsWith('cu-sen') || normalized.startsWith('tay-sen') || normalized === 'phu-kien-sen-voi') return 'sen-tam'
  if (normalized.startsWith('bon-tam') || normalized === 'voi-bon-tam' || normalized === 'voi-xa-bon' || normalized === 'phu-kien-bon-tam') return 'bon-tam'
  if (normalized.startsWith('bon-tieu') || normalized === 'van-xa-tieu' || normalized === 'phu-kien-bon-tieu') return 'bon-tieu'
  if (normalized === 'guong-phong-tam') return 'guong-phong-tam'
  if (normalized === 'pheu-thoat-san') return 'ga-thoat-san'
  if (normalized === 'may-say-tay') return 'may-say-tay'
  if (
    [
      'phu-kien-khac',
      'hop-giay-ve-sinh',
      'moc-ao',
      'ke-xa-phong',
      'hop-xa-phong',
      'lo-ban-chai',
      'thanh-treo-khan',
      'vong-treo-khan',
      'thanh-tay-vin',
      'bo-phu-kien',
      'voi-xit-ve-sinh',
    ].includes(normalized)
  ) {
    return 'phu-kien-phong-tam'
  }

  if (normalized.startsWith('may-nuoc-nong')) return 'may-nuoc-nong'
  if (normalized.includes('loc-nuoc')) return 'loc-nuoc'
  if (normalized.includes('bon-chua-nuoc')) return 'bon-chua-nuoc'
  if (normalized.includes('may-bom-nuoc')) return 'may-bom-nuoc'
  if (normalized.includes('phu-kien-vat-lieu-nuoc')) return 'phu-kien-vat-lieu-nuoc'

  if (normalized.includes('ecocarat')) return 'gach-inax-ecocarat'
  if (normalized.includes('gach-op-tuong')) return 'gach-op-tuong'
  if (normalized.includes('gach-lat-nen')) return 'gach-lat-nen'
  if (normalized.includes('gach-trang-tri')) return 'gach-trang-tri'

  return null
}

function inferFromKeywords(name: string, sourceUrl: string | null): TaxonSlug | null {
  const haystack = `${normalize(name)} ${normalize(sourceUrl)}`

  if (haystack.includes('ecocarat')) return 'gach-inax-ecocarat'
  if (haystack.includes('gach op tuong')) return 'gach-op-tuong'
  if (haystack.includes('gach lat nen')) return 'gach-lat-nen'
  if (haystack.includes('gach trang tri')) return 'gach-trang-tri'
  if (haystack.includes('gach') || haystack.includes('tile')) return 'gach-op-lat'

  if (haystack.includes('may say tay') || haystack.includes('jt-')) return 'may-say-tay'
  if (haystack.includes('guong')) return 'guong-phong-tam'
  if (haystack.includes('thoat san') || haystack.includes('pheu thoat san')) return 'ga-thoat-san'
  if (haystack.includes('voi chau bep')) return 'voi-rua-chen'
  if (haystack.includes('voi rua chen') || haystack.includes('voi bep')) return 'voi-rua-chen'
  if (haystack.includes('voi uong nuoc')) return 'phu-kien-chau-rua-chen'
  if (haystack.includes('chau rua chen') || haystack.includes('chau rua bat')) return 'chau-rua-chen'
  if (haystack.includes('may nuoc nong')) return 'may-nuoc-nong'
  if (haystack.includes('loc nuoc')) return 'loc-nuoc'
  if (haystack.includes('bon chua nuoc')) return 'bon-chua-nuoc'
  if (haystack.includes('may bom nuoc')) return 'may-bom-nuoc'
  if (haystack.includes('nap bon cau') || haystack.includes('washlet')) return 'nap-bon-cau'
  if (haystack.includes('bon cau')) return 'bon-cau'
  if (haystack.includes('lavabo') || haystack.includes('chau rua mat')) return 'lavabo'
  if (haystack.includes('voi chau') || haystack.includes('voi lavabo')) return 'voi-chau'
  if (haystack.includes('sen tam') || haystack.includes('sen cay') || haystack.includes('cu sen') || haystack.includes('tay sen')) return 'sen-tam'
  if (haystack.includes('bon tam')) return 'bon-tam'
  if (haystack.includes('bon tieu') || haystack.includes('tieu nam')) return 'bon-tieu'

  if (
    haystack.includes('ke xa phong') ||
    haystack.includes('ke dung xa phong') ||
    haystack.includes('gia treo khan') ||
    haystack.includes('moc treo') ||
    haystack.includes('hop dung giay') ||
    haystack.includes('binh xa phong') ||
    haystack.includes('lo ban chai') ||
    haystack.includes('voi xit') ||
    haystack.includes('tay vin') ||
    haystack.includes('phu kien') ||
    haystack.includes('ke kinh')
  ) {
    return 'phu-kien-phong-tam'
  }

  if (haystack.includes('ke bep da nang') || haystack.includes('ke bep')) return 'phu-kien-bep'

  return null
}

function buildMarkdownTable(rows: string[][]) {
  if (rows.length === 0) return '_No rows_'
  const header = rows[0]
  const separator = header.map(() => '---')
  const lines = [header, separator, ...rows.slice(1)]
  return lines.map((row) => `| ${row.join(' | ')} |`).join('\n')
}

function toCsvValue(value: unknown) {
  const stringValue = String(value ?? '')
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function writeCsv(filePath: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '')
    return
  }
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => toCsvValue(row[header])).join(','))
  }
  fs.writeFileSync(filePath, lines.join('\n'))
}

function topBreakdown<T extends string | null>(items: T[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = item && item.trim() ? item : '(null)'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }))
}

async function readExecuteSnapshot() {
  const [productsCount, activeProductsCount, productTaxonAssignmentsCount, primaryAssignmentsCount] =
    await Promise.all([
      prisma.products.count(),
      prisma.products.count({ where: { is_active: true } }),
      prisma.product_taxon_assignments.count(),
      prisma.product_taxon_assignments.count({ where: { is_primary: true } }),
    ])

  return {
    productsCount,
    activeProductsCount,
    productTaxonAssignmentsCount,
    primaryAssignmentsCount,
  } satisfies ExecuteSnapshot
}

async function readPrimaryViolationsCount() {
  const rows = await prisma.$queryRaw<Array<{ duplicate_products: bigint }>>`
    SELECT COUNT(*)::bigint AS duplicate_products
    FROM (
      SELECT product_id
      FROM product_taxon_assignments
      WHERE is_primary = true
      GROUP BY product_id
      HAVING COUNT(*) > 1
    ) duplicated
  `

  return Number(rows[0]?.duplicate_products ?? 0n)
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const [taxons, productTypes, products] = await Promise.all([
    prisma.catalog_taxons.findMany({
      select: { id: true, slug: true, canonical_path: true, parent_id: true, name: true },
      orderBy: [{ depth: 'asc' }, { sort_order: 'asc' }, { canonical_path: 'asc' }],
    }),
    prisma.product_types.findMany({
      select: {
        slug: true,
        subcategories: { select: { slug: true, categories: { select: { slug: true } } } },
      },
      where: { is_active: true },
    }),
    prisma.products.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        is_active: true,
        publication_status: true,
        pdp_visibility: true,
        listing_visibility: true,
        source_url: true,
        product_type: true,
        product_sub_type: true,
        categories: { select: { slug: true, name: true } },
        subcategories: { select: { slug: true, name: true } },
        brands: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    }),
  ])

  const taxonsBySlug = new Map<string, typeof taxons>()
  for (const taxon of taxons) {
    const existing = taxonsBySlug.get(taxon.slug) ?? []
    existing.push(taxon)
    taxonsBySlug.set(taxon.slug, existing)
  }

  const findTaxonRecord = (
    slug: string | null,
    options?: { preferChild?: boolean }
  ) => {
    if (!slug) return null
    const matches = taxonsBySlug.get(slug) ?? []
    if (matches.length === 0) return null
    if (options?.preferChild) {
      return matches.find((taxon) => taxon.parent_id !== null) ?? matches[0]
    }
    return matches.find((taxon) => taxon.parent_id === null) ?? matches[0]
  }

  const productTypeToTaxon = new Map<string, TaxonSlug>()

  for (const productType of productTypes) {
    const subSlug = productType.subcategories.slug
    const direct = DIRECT_SUBCATEGORY_MAP[subSlug]
    if (direct) {
      productTypeToTaxon.set(productType.slug, direct)
    }
  }

  const proposals: Proposal[] = []
  const activeNullSubcategory: Proposal[] = []
  const publicPdpNullSubcategory: Proposal[] = []
  const crossCategoryIssues: Proposal[] = []
  const listingEligibleRouteRiskCases: Proposal[] = []
  const publicPdpRouteRiskCases: Proposal[] = []
  const manualReviewCases: Proposal[] = []
  const blockedCases: Proposal[] = []
  const reviewQueueCases: Proposal[] = []

  const scannedProducts = products.length
  const activeProducts = products.filter((product) => product.is_active).length
  const publicPdpProducts = products.filter((product) =>
    isPublicPdp({
      publicationStatus: product.publication_status,
      pdpVisibility: product.pdp_visibility,
    })
  )
  const listingEligibleProducts = products.filter((product) =>
    isListingEligible({
      publicationStatus: product.publication_status,
      pdpVisibility: product.pdp_visibility,
      listingVisibility: product.listing_visibility,
    })
  )
  const searchOnlyProducts = publicPdpProducts.filter((product) => product.listing_visibility === 'search_only')
  const hiddenOrPrivateProducts = products.filter((product) =>
    classifyScope({
      publicationStatus: product.publication_status,
      pdpVisibility: product.pdp_visibility,
      listingVisibility: product.listing_visibility,
    }) === 'hidden_or_private'
  )

  for (const product of products) {
    const categorySlug = product.categories?.slug ?? null
    const subcategorySlug = product.subcategories?.slug ?? null
    const rootFromCategory = categorySlug ? ROOT_BY_CATEGORY_SLUG[categorySlug] ?? null : null
    const normalizedType = slugifyKey(product.product_type)
    const normalizedName = normalize(product.name)
    const candidateMap = createCandidateMap()

    if (rootFromCategory) {
      addCandidate(candidateMap, rootFromCategory, 10, 'category_root', `category root ${rootFromCategory}`)
    }

    if (subcategorySlug) {
      const mapped = DIRECT_SUBCATEGORY_MAP[subcategorySlug]
      if (mapped) {
        addCandidate(candidateMap, mapped, 70, 'current_subcategory', `subcategory ${subcategorySlug}`)
      }
    }

    if (normalizedType) {
      const fromProductType =
        productTypeToTaxon.get(normalizedType) ??
        inferFromProductType(product.product_type)
      if (fromProductType) {
        addCandidate(candidateMap, fromProductType, 55, 'product_type', `product_type ${normalizedType}`)
      }
    }

    const fromKeywords = inferFromKeywords(product.name, product.source_url)
    if (fromKeywords) {
      const reasonSource = product.source_url && normalize(product.source_url).includes(slugifyKey(fromKeywords).replace(/-/g, ' '))
        ? 'source_url'
        : 'name_keyword'
      addCandidate(candidateMap, fromKeywords, 45, reasonSource, `keyword/url match ${fromKeywords}`)
      if (hasStrongKeywordEvidence(fromKeywords, product.name, product.source_url, product.product_type)) {
        addCandidate(candidateMap, fromKeywords, 30, reasonSource, `strong keyword ${fromKeywords}`)
      }
    }

    const sortedCandidates = [...candidateMap.values()].sort((a, b) => b.score - a.score)
    const topCandidate = sortedCandidates[0] ?? null
    const secondCandidate = sortedCandidates[1] ?? null
    const scope = classifyScope({
      publicationStatus: product.publication_status,
      pdpVisibility: product.pdp_visibility,
      listingVisibility: product.listing_visibility,
    })

    let proposedPrimaryTaxonSlug: string | null = topCandidate?.taxonSlug ?? rootFromCategory ?? null
    let proposedSecondaryTaxonSlug: string | null = null
    let confidence = Math.min(100, topCandidate?.score ?? (rootFromCategory ? 55 : 0))
    const reasons = topCandidate?.details ? [...topCandidate.details] : []
    const sources = topCandidate?.sources ? [...topCandidate.sources] : ([] as SignalSource[])

    if (!topCandidate && rootFromCategory) {
      reasons.push(`fallback root ${rootFromCategory}`)
      sources.push('manual_review')
    }

    if (topCandidate && secondCandidate && topCandidate.score - secondCandidate.score <= 10) {
      confidence = Math.min(confidence, 72)
      reasons.push(`candidate conflict with ${secondCandidate.taxonSlug}`)
      if (!sources.includes('manual_review')) sources.push('manual_review')
    }

    const shouldPreferChildTaxon =
      proposedPrimaryTaxonSlug === 'gach-op-lat' &&
      (categorySlug === 'gach-op-lat' || subcategorySlug === 'gach-op-lat' || normalizedName.includes('gach'))
    const proposedPrimaryTaxonRecord = findTaxonRecord(proposedPrimaryTaxonSlug, {
      preferChild: shouldPreferChildTaxon,
    })
    const proposedRoot = rootOf(proposedPrimaryTaxonSlug as TaxonSlug | null)
    const crossRootMove =
      Boolean(proposedRoot && rootFromCategory && proposedRoot !== rootFromCategory) ||
      (['voi-rua-chen', 'chau-rua-chen', 'phu-kien-chau-rua-chen'].includes(normalizedType) &&
        categorySlug !== 'thiet-bi-bep')
    const crossCategoryIssue = crossRootMove

    const kitchenMismatch =
      ['voi-rua-chen', 'chau-rua-chen', 'phu-kien-chau-rua-chen'].includes(normalizedType) &&
      categorySlug !== 'thiet-bi-bep'

    if (kitchenMismatch) {
      confidence = Math.max(confidence, 88)
      reasons.push(`cross-category kitchen product_type ${normalizedType}`)
      if (!sources.includes('product_type')) sources.push('product_type')
    }

    if (proposedPrimaryTaxonSlug === 'gach-op-lat' && normalizedName.includes('ecocarat')) {
      proposedPrimaryTaxonSlug = 'gach-inax-ecocarat'
      confidence = Math.max(confidence, 92)
      reasons.push('ecocarat override')
      if (!sources.includes('name_keyword')) sources.push('name_keyword')
    }

    if (
      proposedPrimaryTaxonSlug &&
      TAXON_WITH_BROAD_SECONDARY[proposedPrimaryTaxonSlug as TaxonSlug] &&
      TAXON_WITH_BROAD_SECONDARY[proposedPrimaryTaxonSlug as TaxonSlug] !== proposedPrimaryTaxonSlug
    ) {
      proposedSecondaryTaxonSlug = TAXON_WITH_BROAD_SECONDARY[proposedPrimaryTaxonSlug as TaxonSlug] ?? null
    } else if (
      proposedPrimaryTaxonSlug &&
      subcategorySlug === 'phu-kien-phong-tam' &&
      proposedPrimaryTaxonSlug !== 'phu-kien-phong-tam' &&
      rootOf(proposedPrimaryTaxonSlug as TaxonSlug) === 'thiet-bi-ve-sinh'
    ) {
      proposedSecondaryTaxonSlug = 'phu-kien-phong-tam'
    }

    const rootFallback =
      Boolean(proposedPrimaryTaxonRecord && proposedPrimaryTaxonRecord.parent_id === null && isRootTaxonSlug(proposedPrimaryTaxonSlug)) ||
      (!topCandidate && Boolean(rootFromCategory))
    const lowConfidence = confidence <= 45

    let manualReview =
      !proposedPrimaryTaxonSlug ||
      confidence < 70 ||
      rootFallback ||
      lowConfidence ||
      crossRootMove ||
      (topCandidate !== null && topCandidate.taxonSlug === rootFromCategory && !subcategorySlug) ||
      Boolean(topCandidate && secondCandidate && topCandidate.score - secondCandidate.score <= 10)

    if (!subcategorySlug) {
      confidence = Math.min(confidence, proposedPrimaryTaxonSlug ? 90 : 60)
      reasons.push('missing current subcategory')
      if (!sources.includes('manual_review') && confidence < 90) sources.push('manual_review')
      if (!proposedPrimaryTaxonSlug) manualReview = true
    }

    if (!product.product_type && categorySlug === 'vat-lieu-nuoc') {
      reasons.push('vat-lieu-nuoc null product_type')
      confidence = Math.max(confidence, subcategorySlug ? 84 : 60)
    }

    if (proposedRoot && rootFromCategory && proposedRoot !== rootFromCategory) {
      reasons.push(`root mismatch ${rootFromCategory} -> ${proposedRoot}`)
      confidence = Math.min(confidence, 82)
      manualReview = true
      if (!sources.includes('manual_review')) sources.push('manual_review')
    }

    const publicPdpRouteRisk =
      isPublicPdp({
        publicationStatus: product.publication_status,
        pdpVisibility: product.pdp_visibility,
      }) && (!product.slug || !subcategorySlug)

    const listingEligibleRouteRisk =
      isListingEligible({
        publicationStatus: product.publication_status,
        pdpVisibility: product.pdp_visibility,
        listingVisibility: product.listing_visibility,
      }) && (!product.slug || !subcategorySlug)

    if (publicPdpRouteRisk) {
      reasons.push('public PDP route risk')
    }
    if (listingEligibleRouteRisk) {
      reasons.push('listing eligible route risk')
    }

    const blocked =
      !proposedPrimaryTaxonSlug ||
      rootFallback ||
      (lowConfidence && !topCandidate) ||
      confidence < 30

    const acceptedAutoProposal =
      scope === 'listing_eligible' &&
      Boolean(proposedPrimaryTaxonSlug) &&
      !rootFallback &&
      !lowConfidence &&
      !crossRootMove &&
      confidence >= 70

    if (blocked) {
      manualReview = true
      if (!sources.includes('manual_review')) sources.push('manual_review')
    }

    const proposal: Proposal = {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brands?.name ?? null,
      categorySlug,
      currentSubcategorySlug: subcategorySlug,
      productType: product.product_type,
      productSubType: product.product_sub_type,
      publicationStatus: product.publication_status,
      pdpVisibility: product.pdp_visibility,
      listingVisibility: product.listing_visibility,
      isActive: product.is_active,
      sourceUrl: product.source_url,
      proposedPrimaryTaxonSlug,
      proposedPrimaryCanonicalPath: proposedPrimaryTaxonRecord?.canonical_path ?? null,
      proposedPrimaryIsRoot: proposedPrimaryTaxonRecord?.parent_id === null,
      proposedSecondaryTaxonSlug,
      proposedSecondaryCanonicalPath: proposedSecondaryTaxonSlug ? findTaxonRecord(proposedSecondaryTaxonSlug)?.canonical_path ?? null : null,
      confidence,
      scope,
      acceptedAutoProposal,
      manualReview,
      blocked,
      rootFallback,
      lowConfidence,
      needsPdp404Review: publicPdpRouteRisk,
      listingEligibleRouteRisk,
      publicPdpRouteRisk,
      crossCategoryIssue: Boolean(crossCategoryIssue),
      crossRootMove,
      reasons,
      sources: [...new Set(sources)],
    }

    if (isPublicPdp(proposal)) {
      proposals.push(proposal)
    }

    if (product.is_active && !subcategorySlug) {
      activeNullSubcategory.push(proposal)
    }

    if (isPublicPdp(proposal) && !subcategorySlug) {
      publicPdpNullSubcategory.push(proposal)
    }

    if (isPublicPdp(proposal)) {
      if (proposal.crossCategoryIssue) {
        crossCategoryIssues.push(proposal)
      }

      if (proposal.publicPdpRouteRisk) {
        publicPdpRouteRiskCases.push(proposal)
      }

      if (proposal.listingEligibleRouteRisk) {
        listingEligibleRouteRiskCases.push(proposal)
      }

      if (proposal.manualReview) {
        manualReviewCases.push(proposal)
      }

      if (proposal.blocked) {
        blockedCases.push(proposal)
      }

      if (proposal.manualReview || proposal.blocked) {
        reviewQueueCases.push(proposal)
      }
    }
  }

  const summary: Summary = {
    scannedProducts,
    publicPdpCount: publicPdpProducts.length,
    listingEligibleCount: listingEligibleProducts.length,
    searchOnlyCount: searchOnlyProducts.length,
    hiddenOrPrivateCount: hiddenOrPrivateProducts.length,
    activeProducts,
    proposedPrimaryTaxonCount: proposals.filter((proposal) => proposal.proposedPrimaryTaxonSlug).length,
    autoReadyCount: proposals.filter((proposal) => proposal.acceptedAutoProposal).length,
    manualReviewCount: manualReviewCases.length,
    blockedCount: blockedCases.length,
    rootFallbackCount: proposals.filter((proposal) => proposal.rootFallback).length,
    lowConfidenceCount: proposals.filter((proposal) => proposal.lowConfidence).length,
    crossRootMoveCount: proposals.filter((proposal) => proposal.crossRootMove).length,
    activeNullSubcategoryCount: activeNullSubcategory.length,
    publicPdpNullSubcategoryCount: publicPdpNullSubcategory.length,
    nullSubcategoryRouteRiskCount: publicPdpNullSubcategory.length,
    listingEligibleRouteRiskCount: listingEligibleRouteRiskCases.length,
    publicPdpRouteRiskCount: publicPdpRouteRiskCases.length,
    crossCategoryProductTypeIssueCount: crossCategoryIssues.length,
    futureListingEligibleWithoutAcceptedPrimaryTaxonCount: proposals.filter(
      (proposal) => proposal.scope === 'listing_eligible' && !proposal.acceptedAutoProposal
    ).length,
  }

  const breakdowns = {
    byCategory: topBreakdown(proposals.map((proposal) => proposal.categorySlug)),
    byBrand: topBreakdown(proposals.map((proposal) => proposal.brand)),
    byCurrentSubcategory: topBreakdown(proposals.map((proposal) => proposal.currentSubcategorySlug)),
    byProductType: topBreakdown(proposals.map((proposal) => proposal.productType)),
    byPrimaryTaxon: topBreakdown(proposals.map((proposal) => proposal.proposedPrimaryTaxonSlug)),
    byScope: topBreakdown(proposals.map((proposal) => proposal.scope)),
    byReason: topBreakdown(proposals.flatMap((proposal) => proposal.reasons)),
    nullSubcategoryByDisposition: topBreakdown(
      activeNullSubcategory.map((proposal) =>
        proposal.blocked ? 'blocked' : proposal.manualReview ? 'manual_review' : proposal.acceptedAutoProposal ? 'auto_ready' : 'other'
      )
    ),
    publicPdpNullSubcategoryByDisposition: topBreakdown(
      publicPdpNullSubcategory.map((proposal) =>
        proposal.blocked ? 'blocked' : proposal.manualReview ? 'manual_review' : proposal.acceptedAutoProposal ? 'auto_ready' : 'other'
      )
    ),
    crossRootMoveByTarget: topBreakdown(
      proposals
        .filter((proposal) => proposal.crossRootMove)
        .map((proposal) => `${proposal.categorySlug} -> ${rootOf(proposal.proposedPrimaryTaxonSlug as TaxonSlug | null) ?? '(none)'}`)
    ),
  }

  const riskySamples = [...manualReviewCases]
    .sort((a, b) => a.confidence - b.confidence || a.productId - b.productId)
    .slice(0, 40)

  const resolutionCandidates = proposals.filter(
    (proposal) =>
      proposal.scope === 'listing_eligible' &&
      (
        proposal.publicPdpRouteRisk ||
        proposal.crossRootMove ||
        proposal.rootFallback ||
        proposal.lowConfidence ||
        !proposal.acceptedAutoProposal
      )
  )

  const resolutionCases: ResolutionCase[] = resolutionCandidates.map((proposal) => {
    const normalized = normalize(`${proposal.name} ${proposal.productType ?? ''} ${proposal.sourceUrl ?? ''}`)
    let resolution: ResolutionBucket = 'needs_manual_approval'
    let reason = proposal.reasons[0] ?? 'manual review'

    if (proposal.crossRootMove) {
      resolution = 'requires_legacy_category_migration'
      reason = `Cross-root move ${proposal.categorySlug ?? '(null)'} -> ${rootOf(proposal.proposedPrimaryTaxonSlug as TaxonSlug | null) ?? '(none)'} requires redirect/app compatibility planning`
    } else if (proposal.acceptedAutoProposal) {
      resolution = 'safe_auto_after_rule'
      reason = 'Deterministic keyword/category rule now reaches accepted non-root taxon'
    } else if (
      proposal.rootFallback &&
      (normalized.includes('combo') || normalized.includes('keo dan gach'))
    ) {
      resolution = 'requires_new_taxon'
      reason = 'Current taxonomy v1 has no safe leaf for this product shape'
    } else if (proposal.rootFallback || proposal.blocked) {
      resolution = 'blocked_missing_taxon'
      reason = 'Only root fallback is available; no safe leaf taxon can be assigned yet'
    }

    return {
      productId: proposal.productId,
      sku: proposal.sku,
      name: proposal.name,
      brand: proposal.brand,
      scope: proposal.scope,
      categorySlug: proposal.categorySlug,
      currentSubcategorySlug: proposal.currentSubcategorySlug,
      productType: proposal.productType,
      proposedPrimaryTaxonSlug: proposal.proposedPrimaryTaxonSlug,
      proposedPrimaryCanonicalPath: proposal.proposedPrimaryCanonicalPath,
      confidence: proposal.confidence,
      resolution,
      reason,
      sourceUrl: proposal.sourceUrl,
    }
  })

  const resolutionBreakdown = topBreakdown(resolutionCases.map((item) => item.resolution))
  const unresolvedCases = resolutionCases.filter((item) => item.resolution !== 'safe_auto_after_rule')

  const finalDecisionSeeds = proposals.filter(
    (proposal) =>
      (proposal.scope === 'listing_eligible' && !proposal.acceptedAutoProposal) ||
      proposal.sku in FINAL_DECISION_OVERRIDES
  )

  const finalDecisionBySku = new Map<string, FinalDecisionCase>()

  for (const proposal of finalDecisionSeeds) {
    const override = FINAL_DECISION_OVERRIDES[proposal.sku]
    const targetSlug = override?.targetTaxonSlug ?? (proposal.proposedPrimaryTaxonSlug as TaxonSlug | null)
    const targetRecord = targetSlug ? findTaxonRecord(targetSlug, {
      preferChild: targetSlug === 'gach-op-lat',
    }) : null

    let decision: FinalDecisionBucket = 'needs_manual_business_decision'
    let rationale = proposal.reasons.join('; ')

    if (override) {
      decision = 'safe_for_assignment_only'
      rationale = override.rationale
    } else if (proposal.crossRootMove) {
      decision = 'requires_legacy_category_migration'
      rationale = `Legacy category ${proposal.categorySlug ?? '(null)'} is inconsistent with target taxonomy ${targetRecord?.canonical_path ?? targetSlug ?? '(none)'}. Goal 3b must add app compatibility and redirect/canonical planning before any legacy category migration.`
    }

    finalDecisionBySku.set(proposal.sku, {
      productId: proposal.productId,
      sku: proposal.sku,
      name: proposal.name,
      brand: proposal.brand,
      currentLegacyCategorySlug: proposal.categorySlug,
      currentLegacySubcategorySlug: proposal.currentSubcategorySlug,
      targetTaxonSlug: targetSlug,
      targetCanonicalPath: targetRecord?.canonical_path ?? null,
      confidence: override ? Math.max(proposal.confidence, 80) : proposal.confidence,
      scope: proposal.scope,
      decision,
      rationale,
      sourceUrl: proposal.sourceUrl,
    })
  }

  const finalDecisionCases = [...finalDecisionBySku.values()].sort((a, b) => a.productId - b.productId)
  const finalDecisionBreakdown = topBreakdown(finalDecisionCases.map((item) => item.decision))
  const finalDecisionSafeCases = finalDecisionCases.filter((item) => item.decision === 'safe_for_assignment_only')
  const finalDecisionLegacyCases = finalDecisionCases.filter((item) => item.decision === 'requires_legacy_category_migration')
  const finalDecisionManualCases = finalDecisionCases.filter((item) => item.decision === 'needs_manual_business_decision')

  const goal3aCandidates = proposals.filter(
    (proposal) =>
      proposal.scope === 'listing_eligible' &&
      proposal.acceptedAutoProposal &&
      !proposal.crossRootMove &&
      !proposal.rootFallback &&
      !proposal.lowConfidence &&
      !proposal.blocked
  )

  let executeResult: ExecuteResult | null = null

  if (executeMode) {
    if (scopeArg !== 'assignment-only' || confirmArg !== 'taxonomy-v2') {
      throw new Error(
        'Execute mode requires --scope=assignment-only --confirm=taxonomy-v2'
      )
    }

    const before = await readExecuteSnapshot()
    const legacyDecisionBySku = new Set(
      finalDecisionLegacyCases.map((item) => item.sku)
    )
    const manualDecisionBySku = new Set(
      finalDecisionManualCases.map((item) => item.sku)
    )
    const blockedDecisionBySku = new Set(
      blockedCases
        .filter((proposal) => proposal.scope === 'listing_eligible')
        .map((proposal) => proposal.sku)
    )

    const candidateRows = goal3aCandidates.map((proposal) => {
      const targetTaxon = proposal.proposedPrimaryCanonicalPath
        ? taxons.find((taxon) => taxon.canonical_path === proposal.proposedPrimaryCanonicalPath) ?? null
        : findTaxonRecord(proposal.proposedPrimaryTaxonSlug, {
            preferChild: proposal.proposedPrimaryTaxonSlug === 'gach-op-lat',
          })

      if (!targetTaxon) {
        throw new Error(`Missing taxon for candidate SKU ${proposal.sku}`)
      }

      return {
        productId: proposal.productId,
        sku: proposal.sku,
        taxonId: targetTaxon.id,
        taxonCanonicalPath: targetTaxon.canonical_path,
        confidence: proposal.confidence,
        metadata: {
          reasons: proposal.reasons,
          sources: proposal.sources,
          current_category: proposal.categorySlug,
          current_subcategory: proposal.currentSubcategorySlug,
          product_type: proposal.productType,
          product_sub_type: proposal.productSubType,
        },
      }
    })

    const existingAssignments = await prisma.product_taxon_assignments.findMany({
      where: {
        product_id: { in: candidateRows.map((row) => row.productId) },
      },
      select: {
        product_id: true,
        taxon_id: true,
        is_primary: true,
        source: true,
      },
    })

    const manualPrimaryConflicts = new Map<
      number,
      { existingTaxonId: number; existingSource: string }
    >()
    const backfillPrimaryDemotions = new Set<number>()
    const targetTaxonByProductId = new Map(
      candidateRows.map((row) => [row.productId, row.taxonId])
    )

    for (const assignment of existingAssignments) {
      const targetTaxonId = targetTaxonByProductId.get(assignment.product_id)
      if (!assignment.is_primary || targetTaxonId === undefined || assignment.taxon_id === targetTaxonId) {
        continue
      }

      if (assignment.source === 'taxonomy_v2_backfill') {
        backfillPrimaryDemotions.add(assignment.product_id)
      } else {
        manualPrimaryConflicts.set(assignment.product_id, {
          existingTaxonId: assignment.taxon_id,
          existingSource: assignment.source,
        })
      }
    }

    const skippedPrimaryConflictSamples = candidateRows
      .filter((row) => manualPrimaryConflicts.has(row.productId))
      .slice(0, 20)
      .map((row) => ({
        productId: row.productId,
        sku: row.sku,
        existingTaxonId: manualPrimaryConflicts.get(row.productId)!.existingTaxonId,
        existingSource: manualPrimaryConflicts.get(row.productId)!.existingSource,
        targetTaxonId: row.taxonId,
      }))

    const executableRows = candidateRows.filter(
      (row) => !manualPrimaryConflicts.has(row.productId)
    )

    if (backfillPrimaryDemotions.size > 0) {
      await prisma.product_taxon_assignments.updateMany({
        where: {
          product_id: { in: [...backfillPrimaryDemotions] },
          source: 'taxonomy_v2_backfill',
          is_primary: true,
        },
        data: {
          is_primary: false,
          role: 'secondary',
        },
      })
    }

    const UPSERT_CHUNK_SIZE = 1000
    for (let index = 0; index < executableRows.length; index += UPSERT_CHUNK_SIZE) {
      const chunk = executableRows.slice(index, index + UPSERT_CHUNK_SIZE)
      const payload = JSON.stringify(
        chunk.map((row) => ({
          product_id: row.productId,
          taxon_id: row.taxonId,
          confidence: row.confidence,
          metadata: row.metadata,
        }))
      )

      await prisma.$executeRaw`
        WITH payload AS (
          SELECT *
          FROM jsonb_to_recordset(${payload}::jsonb)
            AS x(product_id int, taxon_id int, confidence int, metadata jsonb)
        )
        INSERT INTO product_taxon_assignments (
          product_id,
          taxon_id,
          is_primary,
          role,
          source,
          confidence,
          metadata,
          sort_order
        )
        SELECT
          product_id,
          taxon_id,
          true,
          'primary',
          'taxonomy_v2_backfill',
          confidence,
          metadata,
          0
        FROM payload
        ON CONFLICT (product_id, taxon_id) DO UPDATE
        SET
          is_primary = EXCLUDED.is_primary,
          role = EXCLUDED.role,
          source = EXCLUDED.source,
          confidence = EXCLUDED.confidence,
          metadata = EXCLUDED.metadata,
          sort_order = EXCLUDED.sort_order,
          updated_at = now()
      `
    }

    const after = await readExecuteSnapshot()
    const primaryViolationsAfter = await readPrimaryViolationsCount()
    const assignedCandidateCount = await prisma.product_taxon_assignments.count({
      where: {
        source: 'taxonomy_v2_backfill',
        is_primary: true,
        product_id: { in: executableRows.map((row) => row.productId) },
      },
    })
    const legacyCaseAssignedCount = await prisma.product_taxon_assignments.count({
      where: {
        source: 'taxonomy_v2_backfill',
        product_id: { in: finalDecisionLegacyCases.map((item) => item.productId) },
      },
    })

    executeResult = {
      executed: true,
      scope: 'assignment-only',
      confirmed: true,
      candidateCount: candidateRows.length,
      skippedDueToPrimaryConflictCount: manualPrimaryConflicts.size,
      demotedExistingBackfillPrimaryCount: backfillPrimaryDemotions.size,
      insertedOrUpdatedCount: executableRows.length,
      assignedCandidateCount,
      excludedLegacyMigrationCount: legacyDecisionBySku.size,
      excludedManualDecisionCount: manualDecisionBySku.size,
      excludedBlockedCount: blockedDecisionBySku.size,
      legacyCaseAssignedCount,
      primaryViolationsAfter,
      before,
      after,
      skippedPrimaryConflictSamples,
    }
  }

  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    summary,
    breakdowns,
    audits: {
      activeNullSubcategory,
      publicPdpNullSubcategory,
      crossCategoryIssues,
      listingEligibleRouteRisk: listingEligibleRouteRiskCases,
      publicPdpRouteRisk: publicPdpRouteRiskCases,
      reviewQueueCases,
      blockedCases,
      pdp404RiskSamples: riskySamples,
    },
    proposals,
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-plan.json'),
    JSON.stringify(jsonOutput, null, 2)
  )

  writeCsv(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-manual-review.csv'),
    manualReviewCases.map((proposal) => ({
      product_id: proposal.productId,
      sku: proposal.sku,
      name: proposal.name,
      brand: proposal.brand,
      category_slug: proposal.categorySlug,
      current_subcategory_slug: proposal.currentSubcategorySlug,
      product_type: proposal.productType,
      proposed_primary_taxon: proposal.proposedPrimaryTaxonSlug,
      proposed_secondary_taxon: proposal.proposedSecondaryTaxonSlug,
      confidence: proposal.confidence,
      scope: proposal.scope,
      root_fallback: proposal.rootFallback,
      low_confidence: proposal.lowConfidence,
      cross_root_move: proposal.crossRootMove,
      blocked: proposal.blocked,
      reasons: proposal.reasons.join('; '),
      source_url: proposal.sourceUrl,
    }))
  )

  writeCsv(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-active-null-subcategory.csv'),
    activeNullSubcategory.map((proposal) => ({
      product_id: proposal.productId,
      sku: proposal.sku,
      name: proposal.name,
      brand: proposal.brand,
      proposed_primary_taxon: proposal.proposedPrimaryTaxonSlug,
      proposed_secondary_taxon: proposal.proposedSecondaryTaxonSlug,
      confidence: proposal.confidence,
      scope: proposal.scope,
      accepted_auto_proposal: proposal.acceptedAutoProposal,
      manual_review: proposal.manualReview,
      blocked: proposal.blocked,
      root_fallback: proposal.rootFallback,
      low_confidence: proposal.lowConfidence,
      reasons: proposal.reasons.join('; '),
      source_url: proposal.sourceUrl,
    }))
  )

  writeCsv(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-public-pdp-null-subcategory-review.csv'),
    publicPdpNullSubcategory.map((proposal) => ({
      product_id: proposal.productId,
      sku: proposal.sku,
      name: proposal.name,
      brand: proposal.brand,
      scope: proposal.scope,
      proposed_primary_taxon: proposal.proposedPrimaryTaxonSlug,
      proposed_secondary_taxon: proposal.proposedSecondaryTaxonSlug,
      confidence: proposal.confidence,
      accepted_auto_proposal: proposal.acceptedAutoProposal,
      manual_review: proposal.manualReview,
      blocked: proposal.blocked,
      root_fallback: proposal.rootFallback,
      low_confidence: proposal.lowConfidence,
      cross_root_move: proposal.crossRootMove,
      reasons: proposal.reasons.join('; '),
      source_url: proposal.sourceUrl,
    }))
  )

  writeCsv(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-cross-category-issues.csv'),
    crossCategoryIssues.map((proposal) => ({
      product_id: proposal.productId,
      sku: proposal.sku,
      name: proposal.name,
      category_slug: proposal.categorySlug,
      current_subcategory_slug: proposal.currentSubcategorySlug,
      product_type: proposal.productType,
      proposed_primary_taxon: proposal.proposedPrimaryTaxonSlug,
      confidence: proposal.confidence,
      scope: proposal.scope,
      cross_root_move: proposal.crossRootMove,
      manual_review: proposal.manualReview,
      reasons: proposal.reasons.join('; '),
      source_url: proposal.sourceUrl,
    }))
  )

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-manual-review-resolution.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          listingEligibleWithoutAcceptedPrimaryTaxon: summary.futureListingEligibleWithoutAcceptedPrimaryTaxonCount,
          autoReadyCount: summary.autoReadyCount,
          manualReviewCount: summary.manualReviewCount,
          blockedCount: summary.blockedCount,
          requiresLegacyCategoryMigrationCount: resolutionCases.filter(
            (item) => item.resolution === 'requires_legacy_category_migration'
          ).length,
          unresolvedCount: unresolvedCases.length,
        },
        breakdown: resolutionBreakdown,
        cases: resolutionCases,
      },
      null,
      2
    )
  )

  writeCsv(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-manual-review-resolution.csv'),
    resolutionCases.map((item) => ({
      product_id: item.productId,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      scope: item.scope,
      category_slug: item.categorySlug,
      current_subcategory_slug: item.currentSubcategorySlug,
      product_type: item.productType,
      proposed_primary_taxon: item.proposedPrimaryTaxonSlug,
      proposed_primary_canonical_path: item.proposedPrimaryCanonicalPath,
      confidence: item.confidence,
      resolution: item.resolution,
      reason: item.reason,
      source_url: item.sourceUrl,
    }))
  )

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-final-unresolved-decisions.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          initialUnresolvedSetCount: finalDecisionCases.length,
          currentPlannerUnresolvedCount: summary.futureListingEligibleWithoutAcceptedPrimaryTaxonCount,
          goal3aCandidateCount: goal3aCandidates.length,
          safeForAssignmentOnlyCount: finalDecisionSafeCases.length,
          requiresLegacyCategoryMigrationCount: finalDecisionLegacyCases.length,
          needsManualBusinessDecisionCount: finalDecisionManualCases.length,
          excludedBlockedCount: blockedCases.filter((proposal) => proposal.scope === 'listing_eligible').length,
        },
        goal3a: {
          candidateCount: goal3aCandidates.length,
          criteria:
            'accepted primary taxon only; listing_eligible; no cross-root move; no root fallback; no low confidence; no blocked decision',
        },
        decisions: finalDecisionCases,
      },
      null,
      2
    )
  )

  writeCsv(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-final-unresolved-decisions.csv'),
    finalDecisionCases.map((item) => ({
      product_id: item.productId,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      current_legacy_category_slug: item.currentLegacyCategorySlug,
      current_legacy_subcategory_slug: item.currentLegacySubcategorySlug,
      target_taxon_slug: item.targetTaxonSlug,
      target_canonical_path: item.targetCanonicalPath,
      confidence: item.confidence,
      scope: item.scope,
      decision: item.decision,
      rationale: item.rationale,
      source_url: item.sourceUrl,
    }))
  )

  const mdSections = [
    '# Catalog Taxonomy v2 Backfill Dry-Run',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    buildMarkdownTable([
      ['Metric', 'Value'],
      ['Products scanned', String(summary.scannedProducts)],
      ['Public PDP products', String(summary.publicPdpCount)],
      ['Listing eligible products', String(summary.listingEligibleCount)],
      ['Search only products', String(summary.searchOnlyCount)],
      ['Hidden/private products', String(summary.hiddenOrPrivateCount)],
      ['Proposed primary taxon count', String(summary.proposedPrimaryTaxonCount)],
      ['Auto ready count', String(summary.autoReadyCount)],
      ['Manual review count', String(summary.manualReviewCount)],
      ['Blocked count', String(summary.blockedCount)],
      ['Root fallback count', String(summary.rootFallbackCount)],
      ['Low confidence count', String(summary.lowConfidenceCount)],
      ['Cross-root move count', String(summary.crossRootMoveCount)],
      ['Active null subcategory count', String(summary.activeNullSubcategoryCount)],
      ['Public PDP null subcategory count', String(summary.publicPdpNullSubcategoryCount)],
      ['Null subcategory route risk count', String(summary.nullSubcategoryRouteRiskCount)],
      ['Listing eligible route risk count', String(summary.listingEligibleRouteRiskCount)],
      ['Public PDP route risk count', String(summary.publicPdpRouteRiskCount)],
      ['Cross-category product_type issues', String(summary.crossCategoryProductTypeIssueCount)],
      ['Future listing eligible without accepted primary taxon', String(summary.futureListingEligibleWithoutAcceptedPrimaryTaxonCount)],
    ]),
    '',
    '## Top Breakdowns',
    '',
    '### By Category',
    '',
    buildMarkdownTable([
      ['Category', 'Count'],
      ...breakdowns.byCategory.slice(0, 12).map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '### By Brand',
    '',
    buildMarkdownTable([
      ['Brand', 'Count'],
      ...breakdowns.byBrand.slice(0, 12).map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '### By Current Subcategory',
    '',
    buildMarkdownTable([
      ['Current Subcategory', 'Count'],
      ...breakdowns.byCurrentSubcategory.slice(0, 12).map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '### By Product Type',
    '',
    buildMarkdownTable([
      ['Product Type', 'Count'],
      ...breakdowns.byProductType.slice(0, 15).map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '### Top Reasons',
    '',
    buildMarkdownTable([
      ['Reason', 'Count'],
      ...breakdowns.byReason.slice(0, 15).map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '### By Scope',
    '',
    buildMarkdownTable([
      ['Scope', 'Count'],
      ...breakdowns.byScope.map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '## 65 Active Null Subcategory Cases',
    '',
    buildMarkdownTable([
      ['SKU', 'Brand', 'Proposal', 'Confidence', 'Disposition', 'Reason'],
      ...activeNullSubcategory.slice(0, 25).map((proposal) => [
        proposal.sku,
        proposal.brand ?? '(null)',
        proposal.proposedPrimaryTaxonSlug ?? '(none)',
        String(proposal.confidence),
        proposal.blocked ? 'blocked' : proposal.manualReview ? 'manual_review' : proposal.acceptedAutoProposal ? 'auto_ready' : 'other',
        proposal.reasons[0] ?? '(none)',
      ]),
    ]),
    '',
    'Full CSV: `scripts/output/catalog-taxonomy-v2-backfill-active-null-subcategory.csv`',
    '',
    '### Public PDP Null Subcategory Disposition',
    '',
    buildMarkdownTable([
      ['Disposition', 'Count'],
      ...breakdowns.publicPdpNullSubcategoryByDisposition.map((row) => [row.key, String(row.count)]),
    ]),
    '',
    'Review CSV: `scripts/output/catalog-taxonomy-v2-backfill-public-pdp-null-subcategory-review.csv`',
    '',
    '## Cross-Category product_type Issues',
    '',
    buildMarkdownTable([
      ['SKU', 'Category', 'Product Type', 'Proposal', 'Confidence', 'Reason'],
      ...crossCategoryIssues.slice(0, 25).map((proposal) => [
        proposal.sku,
        proposal.categorySlug ?? '(null)',
        proposal.productType ?? '(null)',
        proposal.proposedPrimaryTaxonSlug ?? '(none)',
        String(proposal.confidence),
        proposal.reasons[0] ?? '(none)',
      ]),
    ]),
    '',
    'Full CSV: `scripts/output/catalog-taxonomy-v2-backfill-cross-category-issues.csv`',
    '',
    '### Cross-Root Move Groups',
    '',
    buildMarkdownTable([
      ['From -> To', 'Count'],
      ...breakdowns.crossRootMoveByTarget.map((row) => [row.key, String(row.count)]),
    ]),
    '',
    'Goal 3 note: taxonomy backfill may write only assignment tables. Legacy `category_id` / `subcategory_id` must not be changed until redirect/app compatibility is planned.',
    '',
    '## Risk Samples',
    '',
    buildMarkdownTable([
      ['SKU', 'Category', 'Subcategory', 'Proposal', 'Confidence', 'Manual Review'],
      ...riskySamples.slice(0, 20).map((proposal) => [
        proposal.sku,
        proposal.categorySlug ?? '(null)',
        proposal.currentSubcategorySlug ?? '(null)',
        proposal.proposedPrimaryTaxonSlug ?? '(none)',
        String(proposal.confidence),
        proposal.manualReview ? 'yes' : 'no',
      ]),
    ]),
  ]

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-plan.md'),
    mdSections.join('\n')
  )

  const resolutionMdSections = [
    '# Catalog Taxonomy v2 Manual Review Resolution',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Resolution Summary',
    '',
    buildMarkdownTable([
      ['Metric', 'Value'],
      ['Listing eligible without accepted primary taxon', String(summary.futureListingEligibleWithoutAcceptedPrimaryTaxonCount)],
      ['Auto ready count', String(summary.autoReadyCount)],
      ['Manual review count', String(summary.manualReviewCount)],
      ['Blocked count', String(summary.blockedCount)],
      ['Requires legacy category migration', String(resolutionCases.filter((item) => item.resolution === 'requires_legacy_category_migration').length)],
    ]),
    '',
    '## Resolution Breakdown',
    '',
    buildMarkdownTable([
      ['Resolution', 'Count'],
      ...resolutionBreakdown.map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '## Cases Still Not Safe To Auto-Execute',
    '',
    buildMarkdownTable([
      ['SKU', 'Category', 'Proposal', 'Confidence', 'Resolution', 'Reason'],
      ...unresolvedCases.slice(0, 40).map((item) => [
        item.sku,
        item.categorySlug ?? '(null)',
        item.proposedPrimaryTaxonSlug ?? '(none)',
        String(item.confidence),
        item.resolution,
        item.reason,
      ]),
    ]),
    '',
    'Cross-root proposals remain non-executable for Goal 3 until legacy category redirect/app compatibility planning exists.',
    '',
    'CSV: `scripts/output/catalog-taxonomy-v2-manual-review-resolution.csv`',
  ]

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-manual-review-resolution.md'),
    resolutionMdSections.join('\n')
  )

  const finalDecisionMdSections = [
    '# Catalog Taxonomy v2 Final Unresolved Decisions',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Final Decision Summary',
    '',
    buildMarkdownTable([
      ['Metric', 'Value'],
      ['Initial unresolved decision set', String(finalDecisionCases.length)],
      ['Current planner unresolved count', String(summary.futureListingEligibleWithoutAcceptedPrimaryTaxonCount)],
      ['Goal 3a candidate count', String(goal3aCandidates.length)],
      ['Safe for assignment only', String(finalDecisionSafeCases.length)],
      ['Requires legacy category migration', String(finalDecisionLegacyCases.length)],
      ['Needs manual business decision', String(finalDecisionManualCases.length)],
      ['Excluded blocked count', String(blockedCases.filter((proposal) => proposal.scope === 'listing_eligible').length)],
    ]),
    '',
    '## Decision Breakdown',
    '',
    buildMarkdownTable([
      ['Decision', 'Count'],
      ...finalDecisionBreakdown.map((row) => [row.key, String(row.count)]),
    ]),
    '',
    '## Safe For Assignment Only',
    '',
    buildMarkdownTable([
      ['SKU', 'Legacy Category', 'Target Taxon', 'Confidence', 'Rationale'],
      ...finalDecisionSafeCases.map((item) => [
        item.sku,
        item.currentLegacyCategorySlug ?? '(null)',
        item.targetCanonicalPath ?? item.targetTaxonSlug ?? '(none)',
        String(item.confidence),
        item.rationale,
      ]),
    ]),
    '',
    '## Requires Legacy Category Migration',
    '',
    buildMarkdownTable([
      ['SKU', 'Legacy Category', 'Legacy Subcategory', 'Target Taxon', 'Confidence'],
      ...finalDecisionLegacyCases.slice(0, 40).map((item) => [
        item.sku,
        item.currentLegacyCategorySlug ?? '(null)',
        item.currentLegacySubcategorySlug ?? '(null)',
        item.targetCanonicalPath ?? item.targetTaxonSlug ?? '(none)',
        String(item.confidence),
      ]),
    ]),
    '',
    'Goal 3b is required for these rows: app compatibility, redirects, and canonical-path planning must be in place before any legacy category_id/subcategory_id migration.',
    '',
    '## Manual Business Decisions',
    '',
    buildMarkdownTable([
      ['SKU', 'Legacy Category', 'Target Taxon', 'Confidence', 'Rationale'],
      ...finalDecisionManualCases.map((item) => [
        item.sku,
        item.currentLegacyCategorySlug ?? '(null)',
        item.targetCanonicalPath ?? item.targetTaxonSlug ?? '(none)',
        String(item.confidence),
        item.rationale,
      ]),
    ]),
    '',
    'CSV: `scripts/output/catalog-taxonomy-v2-final-unresolved-decisions.csv`',
  ]

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-final-unresolved-decisions.md'),
    finalDecisionMdSections.join('\n')
  )

  if (executeResult) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-assignment-execute-result.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          result: executeResult,
        },
        null,
        2
      )
    )

    const executeMdSections = [
      '# Catalog Taxonomy v2 Assignment Execute Result',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Execute Summary',
      '',
      buildMarkdownTable([
        ['Metric', 'Value'],
        ['Executed', executeResult.executed ? 'yes' : 'no'],
        ['Scope', executeResult.scope],
        ['Goal 3a candidates', String(executeResult.candidateCount)],
        ['Inserted or updated assignments', String(executeResult.insertedOrUpdatedCount)],
        ['Assigned candidate count', String(executeResult.assignedCandidateCount)],
        ['Skipped due to primary conflict', String(executeResult.skippedDueToPrimaryConflictCount)],
        ['Excluded legacy migration count', String(executeResult.excludedLegacyMigrationCount)],
        ['Excluded manual decision count', String(executeResult.excludedManualDecisionCount)],
        ['Excluded blocked count', String(executeResult.excludedBlockedCount)],
        ['Legacy case assigned count', String(executeResult.legacyCaseAssignedCount)],
        ['Primary violations after', String(executeResult.primaryViolationsAfter)],
      ]),
      '',
      '## Before / After',
      '',
      buildMarkdownTable([
        ['Metric', 'Before', 'After'],
        ['Products count', String(executeResult.before.productsCount), String(executeResult.after.productsCount)],
        ['Active products count', String(executeResult.before.activeProductsCount), String(executeResult.after.activeProductsCount)],
        ['Assignment count', String(executeResult.before.productTaxonAssignmentsCount), String(executeResult.after.productTaxonAssignmentsCount)],
        ['Primary assignment count', String(executeResult.before.primaryAssignmentsCount), String(executeResult.after.primaryAssignmentsCount)],
      ]),
      '',
      '## Primary Conflict Samples',
      '',
      buildMarkdownTable([
        ['Product ID', 'SKU', 'Existing Taxon ID', 'Existing Source', 'Target Taxon ID'],
        ...(
          executeResult.skippedPrimaryConflictSamples.length > 0
            ? executeResult.skippedPrimaryConflictSamples.map((item) => [
                String(item.productId),
                item.sku,
                String(item.existingTaxonId),
                item.existingSource,
                String(item.targetTaxonId),
              ])
            : [['(none)', '(none)', '(none)', '(none)', '(none)']]
        ),
      ]),
    ]

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-assignment-execute-result.md'),
      executeMdSections.join('\n')
    )
  }

  console.log(JSON.stringify(summary, null, 2))
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-plan.json')}`)
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-backfill-plan.md')}`)
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-manual-review-resolution.json')}`)
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-manual-review-resolution.md')}`)
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-final-unresolved-decisions.json')}`)
  console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-final-unresolved-decisions.md')}`)
  if (executeResult) {
    console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-assignment-execute-result.json')}`)
    console.log(`Wrote ${path.join(OUTPUT_DIR, 'catalog-taxonomy-v2-assignment-execute-result.md')}`)
    console.log(JSON.stringify(executeResult, null, 2))
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
