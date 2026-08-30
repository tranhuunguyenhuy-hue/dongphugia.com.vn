import { createHash } from 'node:crypto'

export const LEO562_SOURCE_SHA256 = '86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1'
export const LEO562_SOURCE_CAPTURED_AT = '2026-08-29T19:19:02.000Z'

export const QUARANTINE_REASONS = [
  'IDENTITY_AMBIGUITY',
  'BRAND_AMBIGUITY',
  'CATEGORY_AMBIGUITY',
  'PRICE_MISSING_OR_AMBIGUOUS',
  'PROVENANCE_INSUFFICIENT',
  'MANUFACTURER_FACT_CONFLICT',
  'FAMILY_AMBIGUITY',
  'INVALID_TYPED_VALUE',
  'UNIT_NORMALIZATION_FAILURE',
  'MEDIA_READINESS_GAP',
  'UNSUPPORTED_LEGACY_STRUCTURE',
] as const

export type QuarantineReason = (typeof QUARANTINE_REASONS)[number]

export const SECTOR_BY_LEGACY_ROOT_SLUG = {
  'thiet-bi-ve-sinh': 'sanitary',
  'gach-op-lat': 'tile',
  'vat-lieu-nuoc': 'water',
  'thiet-bi-bep': 'kitchen',
} as const

export const ROOT_ID_BY_SECTOR = {
  sanitary: '10000000-0000-4000-8000-000000000001',
  tile: '10000000-0000-4000-8000-000000000002',
  water: '10000000-0000-4000-8000-000000000003',
  kitchen: '10000000-0000-4000-8000-000000000004',
} as const

export type Sector = keyof typeof ROOT_ID_BY_SECTOR

export const MS885_GROUPS = {
  ecowasher: ['MS885DE2#XW', 'MS885DE4#XW'],
  'soft-close': ['MS885DT2#XW', 'MS885DT3#XW', 'MS885DT8#XW'],
  'electronic-washlet': [
    'MS885DW6#XW', 'MS885DW7#XW', 'MS885DW11#XW', 'MS885DW14#XW',
    'MS885DW16#XW', 'MS885CDW12#XW', 'MS885CDW15#XW', 'MS885CDW17#XW',
    'MS885CDW23#XW', 'MS885CDW24#XW', 'MS885CDW25#XW', 'MS885DW24#XW',
    'MS885DW25#XW',
  ],
} as const

export const MS885_CATALOGUE_GAPS = ['MS885DW4#XW', 'MS885DW18#XW'] as const
export const MS885_DEFERRED_OUTSIDE_FAMILY = 'MS885DE6#XW'

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export function stableUuid(namespace: string, key: string) {
  const bytes = Buffer.from(sha256(`${namespace}\0${key}`).slice(0, 32), 'hex')
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function slugify(value: string) {
  return value
    .replace(/đ/gi, (letter) => (letter === 'Đ' ? 'D' : 'd'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

export function attributeKey(value: string, legacyId: number) {
  const normalized = slugify(value).replace(/-/g, '_')
  return normalized && /^[a-z]/.test(normalized)
    ? `legacy_${legacyId}_${normalized}`
    : `legacy_${legacyId}_attribute`
}

export function optionKey(value: string, legacyId: number) {
  const normalized = slugify(value).replace(/-/g, '_')
  return normalized || `option_${legacyId}`
}

export function normalizeIdentity(value: string) {
  return value.trim().normalize('NFKC').toUpperCase()
}

export function normalizeUnit(value: string | null) {
  if (value === null || value.trim() === '') return { unit: null, dimension: null }
  const normalized = value.trim().toLowerCase().replace('²', '2').replace('³', '3')
  const units: Record<string, { unit: string; dimension: string }> = {
    mm: { unit: 'mm', dimension: 'length' },
    cm: { unit: 'mm', dimension: 'length' },
    m: { unit: 'mm', dimension: 'length' },
    l: { unit: 'l', dimension: 'volume' },
    liter: { unit: 'l', dimension: 'volume' },
    w: { unit: 'W', dimension: 'power' },
    kw: { unit: 'W', dimension: 'power' },
    bar: { unit: 'bar', dimension: 'pressure' },
    'l/min': { unit: 'l/min', dimension: 'flow' },
    '%': { unit: '%', dimension: 'ratio' },
    m2: { unit: 'm2', dimension: 'area' },
  }
  return units[normalized] ?? null
}

export function convertNumberToCanonical(value: number, sourceUnit: string | null) {
  const unit = sourceUnit?.trim().toLowerCase().replace('²', '2').replace('³', '3') ?? null
  if (unit === 'cm') return value * 10
  if (unit === 'm') return value * 1000
  if (unit === 'kw') return value * 1000
  return value
}

export function mapAvailability(value: string) {
  if (value === 'in_stock') return 'IN_STOCK' as const
  if (value === 'discontinued') return 'DISCONTINUED' as const
  return 'CONTACT' as const
}

export function mapExplicitRetailPrice(product: {
  price: string | number | null
  price_state: string
  price_source: string
  price_confidence: string
}) {
  const price = product.price === null ? null : Number(product.price)
  const observedCandidate = product.price_state === 'priced'
    && product.price_confidence === 'high'
    && price !== null
    && Number.isFinite(price)
    && price > 0
  return {
    retailPrice: null,
    disposition: observedCandidate
      ? `withheld:legacy-products.price:${product.price_source}:not-v1-authority`
      : 'withheld:no-explicit-dpg-owned-retail-price',
  }
}

export function classifyDocumentKind(documentType: string, fileExt: string | null) {
  const ext = fileExt?.trim().toLowerCase()
  if (documentType.toUpperCase() === 'IMAGE' && ['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
    return 'IMAGE' as const
  }
  return 'DOCUMENT' as const
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`
}

export function deterministicChecksum(value: unknown) {
  return sha256(canonicalJson(value))
}

export function assertLoopbackDatabaseUrl(raw: string, label: string) {
  const url = new URL(raw)
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`${label}_MUST_BE_LOOPBACK`)
  }
  if (!url.pathname || url.pathname === '/') throw new Error(`${label}_DATABASE_REQUIRED`)
  return url
}
