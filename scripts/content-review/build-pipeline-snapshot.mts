import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
const { extractEmbeddedImageUrls } = require('../../src/lib/content-review/cleanup.ts') as typeof import('../../src/lib/content-review/cleanup')
const { isBunnyAsset, isHitaHostedAsset, normalizeImageUrl } = require('../../src/lib/content-review/images.ts') as typeof import('../../src/lib/content-review/images')
const { hashObject, sha256 } = require('../../src/lib/content-review/hash.ts') as typeof import('../../src/lib/content-review/hash')
const { POLICY_CONTRACT, POLICY_HASH } = require('../../src/lib/content-review/policy-contract.ts') as typeof import('../../src/lib/content-review/policy-contract')

const TARGET_SIZE = 240
const PRIORITY_BRANDS = ['inax', 'toto', 'american-standard', 'caesar', 'viglacera'] as const
const privatePath = path.join(process.cwd(), 'scripts/content-review/private/leo-493-pipeline-v3-1-snapshot.json')
const publicPath = path.join(process.cwd(), 'docs/review-bundles/leo-493-pipeline-v3-1-manifest.json')

type DbProduct = {
    id: number
    sku: string | null
    name: string | null
    description: string | null
    updated_at: Date | string
    image_main_url: string | null
    brands: { id: number; name: string; slug: string } | null
    categories: { id: number; name: string; slug: string } | null
    product_images: Array<{ id: number; image_url: string; alt_text: string | null; image_type: string; sort_order: number }>
}

type SnapshotMeta = {
    active_count: number
    missing_raw_sku: number
    missing_required_identity: number
    duplicate_raw_sku_groups: number
    eligible_count: number
}

type RawSnapshotRow = Omit<DbProduct, 'updated_at' | 'brands' | 'categories'> & {
    updated_at: string
    brand: DbProduct['brands']
    category: DbProduct['categories']
}

type RawSnapshot = {
    schemaVersion: number
    acquiredAt: string
    query: string
    meta: SnapshotMeta
    blockerRows: IdentityBlocker[]
    products: RawSnapshotRow[]
}

type IdentityBlocker = {
    id: number
    sku: string | null
    name: string | null
    brand: string | null
    category: string | null
    reason: string
}

type PrivateMedia = {
    kind: 'main' | 'gallery' | 'embedded'
    sourceId: string
    url: string
    fingerprint: string
    host: 'Bunny CDN' | 'Hita' | 'External'
}

type PrivateProduct = {
    id: number
    sku: string
    name: string
    brand: { id: number; name: string; slug: string }
    category: { id: number; name: string; slug: string }
    updatedAt: string
    descriptionHtml: string
    media: PrivateMedia[]
}

function hostForUrl(url: string): PrivateMedia['host'] {
    if (isBunnyAsset(url)) return 'Bunny CDN'
    if (isHitaHostedAsset(url)) return 'Hita'
    return 'External'
}

function buildMedia(row: DbProduct): PrivateMedia[] {
    const media: PrivateMedia[] = []
    if (row.image_main_url) {
        const normalized = normalizeImageUrl(row.image_main_url)
        media.push({ kind: 'main', sourceId: 'main', url: row.image_main_url, fingerprint: sha256(normalized), host: hostForUrl(row.image_main_url) })
    }
    for (const image of [...row.product_images].sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)) {
        const normalized = normalizeImageUrl(image.image_url)
        media.push({ kind: 'gallery', sourceId: `gallery:${image.id}`, url: image.image_url, fingerprint: sha256(normalized), host: hostForUrl(image.image_url) })
    }
    for (const [index, url] of extractEmbeddedImageUrls(row.description || '').entries()) {
        const normalized = normalizeImageUrl(url)
        media.push({ kind: 'embedded', sourceId: `embedded:${index}`, url, fingerprint: sha256(normalized), host: hostForUrl(url) })
    }
    return media
}

function rawSkuBlockers(rows: DbProduct[]): { missing: number; duplicate: number; duplicateSkus: string[] } {
    const missing = rows.filter(row => !row.sku?.trim()).length
    const seen = new Map<string, number>()
    for (const row of rows) {
        const sku = row.sku?.trim()
        if (sku) seen.set(sku, (seen.get(sku) || 0) + 1)
    }
    const duplicateSkus = [...seen.entries()].filter(([, count]) => count > 1).map(([sku]) => sku).sort()
    return { missing, duplicate: duplicateSkus.length, duplicateSkus }
}

function selectionRank(row: DbProduct): [number, string, string, number] {
    const priority = PRIORITY_BRANDS.indexOf(row.brands?.slug as typeof PRIORITY_BRANDS[number])
    return [priority === -1 ? PRIORITY_BRANDS.length : priority, row.brands?.slug || 'unknown', row.sku?.trim() || '', row.id]
}

function sortRows(rows: DbProduct[]): DbProduct[] {
    return [...rows].sort((left, right) => {
        const a = selectionRank(left)
        const b = selectionRank(right)
        for (let index = 0; index < a.length; index += 1) {
            if (a[index] < b[index]) return -1
            if (a[index] > b[index]) return 1
        }
        return 0
    })
}

function countBy<T extends string>(values: T[]): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
        counts[value] = (counts[value] || 0) + 1
        return counts
    }, {})
}

function riskForMedia(media: PrivateMedia[]): 'HITA_HOSTED' | 'BUNNY_ONLY' | 'MIXED' | 'NO_MEDIA' {
    const hosts = new Set(media.map(item => item.host))
    if (hosts.has('Hita') && hosts.has('Bunny CDN')) return 'MIXED'
    if (hosts.has('Hita')) return 'HITA_HOSTED'
    if (hosts.has('Bunny CDN')) return 'BUNNY_ONLY'
    return 'NO_MEDIA'
}

function toPrivateProduct(row: DbProduct): PrivateProduct {
    if (!row.sku?.trim() || !row.brands || !row.categories || !row.name || !row.description) {
        throw new Error(`Snapshot blocker row ${row.id}: missing identity/content field`)
    }
    return {
        id: row.id,
        sku: row.sku.trim(),
        name: row.name,
        brand: row.brands,
        category: row.categories,
        updatedAt: new Date(row.updated_at).toISOString(),
        descriptionHtml: row.description,
        media: buildMedia(row),
    }
}

function normalizeRawRow(row: RawSnapshotRow): DbProduct {
    return {
        ...row,
        updated_at: new Date(row.updated_at),
        brands: row.brand,
        categories: row.category,
    }
}

async function loadSnapshotInput(db: PrismaClient | undefined): Promise<{ rows: DbProduct[]; meta?: SnapshotMeta; blockerRows: IdentityBlocker[]; rawInputHash?: string }> {
    const inputPath = process.env.LEO_493_RAW_SNAPSHOT_PATH
    if (inputPath) {
        const rawBytes = await fs.readFile(inputPath)
        const raw = JSON.parse(rawBytes.toString('utf8')) as RawSnapshot
        if (!Array.isArray(raw.products) || !raw.meta || !Array.isArray(raw.blockerRows)) throw new Error('Invalid canonical snapshot input')
        return { rows: raw.products.map(normalizeRawRow), meta: raw.meta, blockerRows: raw.blockerRows, rawInputHash: sha256(rawBytes.toString('utf8')) }
    }
    if (!db) throw new Error('Database client is required when no raw snapshot input is provided')
    const rows = await db.products.findMany({
        where: { is_active: true },
        select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            updated_at: true,
            image_main_url: true,
            brands: { select: { id: true, name: true, slug: true } },
            categories: { select: { id: true, name: true, slug: true } },
            product_images: { select: { id: true, image_url: true, alt_text: true, image_type: true, sort_order: true }, orderBy: { sort_order: 'asc' } },
        },
    }) as DbProduct[]
    return { rows, blockerRows: [] }
}

async function main() {
    const db = process.env.LEO_493_RAW_SNAPSHOT_PATH ? undefined : new PrismaClient()
    try {
        const input = await loadSnapshotInput(db)
        const rows = input.rows
        const computedBlockers = rawSkuBlockers(rows)
        const blockers = {
            missing: input.meta?.missing_raw_sku ?? computedBlockers.missing,
            duplicate: input.meta?.duplicate_raw_sku_groups ?? computedBlockers.duplicate,
            duplicateSkus: computedBlockers.duplicateSkus,
            missingRequiredIdentity: input.meta?.missing_required_identity ?? 0,
            identityRows: input.blockerRows,
        }
        const eligible = rows.filter(row => row.sku?.trim() && row.name && row.description && row.brands && row.categories)
        const uniqueBySku = new Map(eligible.map(row => [row.sku!.trim(), row]))
        const uniqueRows = sortRows([...uniqueBySku.values()])
        if (blockers.missing || blockers.duplicate) throw new Error(`Raw SKU blocker: missing=${blockers.missing}; duplicate=${blockers.duplicate}`)
        if (input.meta && input.meta.eligible_count < 200) throw new Error(`Canonical active inventory has only ${input.meta.eligible_count} eligible unique products; target requires 200–300`)
        if (uniqueRows.length < 200) throw new Error(`Canonical active inventory has only ${uniqueRows.length} eligible unique products; target requires 200–300`)
        const selectedRows = uniqueRows.slice(0, Math.min(TARGET_SIZE, 300))
        if (selectedRows.length < 200) throw new Error(`Selected inventory is below 200 products: ${selectedRows.length}`)
        const selected = selectedRows.map(toPrivateProduct)
        const selectionInput = {
            algorithm: 'active_products_v3_1_brand_priority_then_category_sku_id',
            target: TARGET_SIZE,
            priorityBrands: PRIORITY_BRANDS,
            sourceFilter: 'is_active=true; non-empty unique raw SKU; non-empty name/description/brand/category',
        }
        const privateValue = {
            schemaVersion: 1,
            contractVersion: POLICY_CONTRACT.version,
            policyHash: POLICY_HASH,
            sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
            selection: selectionInput,
            blockers: { missingRawSku: blockers.missing, duplicateRawSku: blockers.duplicate, duplicateSkus: blockers.duplicateSkus, missingRequiredIdentity: blockers.missingRequiredIdentity, identityRows: blockers.identityRows },
            rawInputHash: input.rawInputHash,
            products: selected,
        }
        const snapshotHash = hashObject(privateValue)
        const publicProducts = selected.map(product => ({
            id: product.id,
            sku: product.sku,
            brand: product.brand.slug,
            category: product.category.slug,
            updatedAt: product.updatedAt,
            descriptionHash: sha256(product.descriptionHtml),
            media: product.media.map(media => ({ kind: media.kind, sourceId: media.sourceId, fingerprint: media.fingerprint, host: media.host })),
        }))
        const publicValue = {
            schemaVersion: 1,
            contractVersion: POLICY_CONTRACT.version,
            policyHash: POLICY_HASH,
            snapshotHash,
            sourceCommit: privateValue.sourceCommit,
            selection: selectionInput,
            blockers: { missingRawSku: blockers.missing, duplicateRawSku: blockers.duplicate, missingRequiredIdentity: blockers.missingRequiredIdentity, identityRows: blockers.identityRows },
            rawInputHash: input.rawInputHash,
            counts: {
                products: selected.length,
                media: selected.reduce((total, product) => total + product.media.length, 0),
                byBrand: countBy(selected.map(product => product.brand.slug)),
                byCategory: countBy(selected.map(product => product.category.slug)),
                byRisk: countBy(selected.map(product => riskForMedia(product.media))),
            },
            products: publicProducts,
        }
        await fs.mkdir(path.dirname(privatePath), { recursive: true })
        await fs.mkdir(path.dirname(publicPath), { recursive: true })
        await fs.writeFile(privatePath, `${JSON.stringify({ ...privateValue, snapshotHash }, null, 2)}\n`, 'utf8')
        await fs.writeFile(publicPath, `${JSON.stringify(publicValue, null, 2)}\n`, 'utf8')
        console.log(JSON.stringify({
            products: publicValue.counts.products,
            media: publicValue.counts.media,
            policyHash: POLICY_HASH,
            snapshotHash,
            sourceCommit: privateValue.sourceCommit,
            byBrand: publicValue.counts.byBrand,
            byCategory: publicValue.counts.byCategory,
            byRisk: publicValue.counts.byRisk,
            blockers: publicValue.blockers,
            databaseWrites: false,
            remoteFetches: false,
        }))
    } finally {
        await db?.$disconnect()
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Snapshot failed')
    process.exitCode = 1
})
