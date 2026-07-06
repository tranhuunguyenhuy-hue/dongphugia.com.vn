import { Prisma, PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import pLimit from 'p-limit'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const brand = readArg('--brand=', 'caesar')
const source = readArg('--source=', 'hita-sample')
const runIdArg = readArg('--run-id=', '')
const execute = args.includes('--execute')
const activate = args.includes('--activate')
const forceInactive = args.includes('--force-inactive')
const requireBunnyImages = args.includes('--require-bunny-images')
const rewriteDescriptionImages = args.includes('--rewrite-description-images')
const replaceRawHtml = args.includes('--replace-raw-html')
const includeNeedsManualReview = args.includes('--include-needs-manual-review')
const concurrency = Math.max(1, Math.min(8, Number(readArg('--concurrency=', '3')) || 3))
const sampleDir = readArg('--sample-dir=', '')
const imageManifestArg = readArg('--image-manifest=', '')
const requireCount = Number(readArg('--require-count=', '0')) || 0
const onlySkusArg = readArg('--only-skus=', '')

const RESERVED_SPEC_KEYS = new Set(['documents', 'Phụ kiện đi kèm', 'technologies'])

function readArg(prefix: string, fallback: string) {
    const arg = args.find(item => item.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : fallback
}

function slugify(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function normalizeUrl(value: string) {
    try {
        const parsed = new URL(value.trim(), 'https://hita.com.vn')
        const vid = parsed.searchParams.get('vid')
        parsed.hash = ''
        parsed.search = ''
        const canonical = parsed.href.replace(/\/$/, '')
        return vid ? `${canonical}?vid=${encodeURIComponent(vid)}` : canonical
    } catch {
        return value.trim().replace(/\/$/, '')
    }
}

function hitaProductId(value: string) {
    try {
        const parsed = new URL(value.trim(), 'https://hita.com.vn')
        const vid = parsed.searchParams.get('vid')
        if (vid) return vid
    } catch {
        // Fall through to canonical PDP id extraction.
    }
    return normalizeUrl(value).split('?')[0].match(/-(\d+)\.html$/)?.[1] || null
}

function humanizeSlug(slug: string) {
    return slug.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toDisplayValue(value: unknown) {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return value.map(toDisplayValue).filter(Boolean).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value).trim()
}

function inferDocType(url: string, name = '') {
    const lower = `${url} ${name}`.toLowerCase()
    if (/\.dwg|\.dxf|cad/.test(lower)) return 'CAD'
    if (/\.(jpg|jpeg|png|webp)|bản vẽ|ban-ve/.test(lower)) return 'IMAGE'
    if (/\.pdf/.test(lower)) return 'PDF'
    return 'DOCUMENT'
}

async function latestRunId() {
    const run = await prisma.crawl_runs.findFirst({
        where: { source, brand_slug: brand },
        orderBy: { started_at: 'desc' },
        select: { id: true },
    })
    if (!run) throw new Error(`No crawl_run found for ${source}/${brand}`)
    return run.id
}

async function ensureProductType(subcategoryId: number | null, slug: string | null | undefined) {
    if (!subcategoryId || !slug) return null
    return prisma.product_types.upsert({
        where: { subcategory_id_slug: { subcategory_id: subcategoryId, slug } },
        create: {
            subcategory_id: subcategoryId,
            slug,
            name: humanizeSlug(slug),
            filter_policy: {},
        },
        update: { updated_at: new Date() },
        select: { id: true },
    })
}

async function ensureProductSubType(productTypeId: number | null | undefined, slug: string | null | undefined) {
    if (!productTypeId || !slug) return null
    return prisma.product_sub_types.upsert({
        where: { product_type_id_slug: { product_type_id: productTypeId, slug } },
        create: {
            product_type_id: productTypeId,
            slug,
            name: humanizeSlug(slug),
        },
        update: {},
        select: { id: true },
    })
}

async function ensureVariantGroup(groupKey: string | null | undefined, product: any, siblingCount: number) {
    if (!groupKey || siblingCount < 2) return null
    const axes = normalizedVariantAxes(product)
    return prisma.product_variant_groups.upsert({
        where: { group_key: groupKey },
        create: {
            group_key: groupKey,
            base_sku: groupKey,
            variant_type: product.variant_type || 'variant',
            label: product.variant_group_label || groupKey,
            axes: axes as Prisma.InputJsonValue,
            source,
            confidence: 'high',
        },
        update: {
            variant_type: product.variant_type || 'variant',
            label: product.variant_group_label || groupKey,
            axes: axes as Prisma.InputJsonValue,
            updated_at: new Date(),
        },
        select: { id: true },
    })
}

async function ensureVariantGroupForImport(groupKey: string | null | undefined, product: any, siblingCount: number) {
    if (!groupKey) return null
    const axes = normalizedVariantAxes(product)
    if (siblingCount < 2) {
        return prisma.product_variant_groups.findUnique({
            where: { group_key: groupKey },
            select: { id: true },
        })
    }
    return prisma.product_variant_groups.upsert({
        where: { group_key: groupKey },
        create: {
            group_key: groupKey,
            base_sku: groupKey,
            variant_type: product.variant_type || 'variant',
            label: product.variant_group_label || groupKey,
            axes: axes as Prisma.InputJsonValue,
            source,
            confidence: 'high',
        },
        update: {
            variant_type: product.variant_type || 'variant',
            label: product.variant_group_label || groupKey,
            axes: axes as Prisma.InputJsonValue,
            updated_at: new Date(),
        },
        select: { id: true },
    })
}

function normalizedVariantAxes(product: any) {
    const payloadAxes = Array.isArray(product.variant_axes) ? product.variant_axes : []
    if (payloadAxes.length > 0) return payloadAxes.map((axis: any) => ({
        key: toDisplayValue(axis.key),
        label: toDisplayValue(axis.label) || axisLabel(toDisplayValue(axis.key)),
    })).filter((axis: any) => axis.key)

    const options = normalizedVariantOptions(product)
    return options.map((option: any) => option.axis)
        .filter((axis: string, index: number, all: string[]) => axis && all.indexOf(axis) === index)
        .map((axis: string) => ({ key: axis, label: axisLabel(axis) }))
}

function normalizedVariantOptions(product: any) {
    const options = Array.isArray(product.variant_options) ? product.variant_options : []
    const normalized = options.map((option: any) => ({
        axis: toDisplayValue(option.axis),
        value: toDisplayValue(option.value),
        ...(toDisplayValue(option.label) ? { label: toDisplayValue(option.label) } : {}),
        ...(toDisplayValue(option.product_id) ? { product_id: toDisplayValue(option.product_id) } : {}),
        ...(toDisplayValue(option.image_url) ? { image_url: toDisplayValue(option.image_url) } : {}),
        ...(toDisplayValue(option.price_text) ? { price_text: toDisplayValue(option.price_text) } : {}),
    })).filter((option: any) => option.axis && option.value)

    if (normalized.length > 0) return normalized
    if (toDisplayValue(product.variant_label)) return [{ axis: 'config', value: toDisplayValue(product.variant_label), label: 'Cấu hình' }]
    return []
}

function axisLabel(axis: string) {
    if (axis === 'config') return 'Cấu hình'
    if (axis === 'color') return 'Màu sắc'
    return axis
}

async function ensureSpecDefinition(key: string, filterable: boolean) {
    return prisma.spec_definitions.upsert({
        where: { key },
        create: {
            key,
            label: key,
            data_type: 'text',
            is_filterable: filterable,
            is_pdp_visible: !RESERVED_SPEC_KEYS.has(key),
            normalize_rule: {},
        },
        update: {
            is_filterable: filterable ? true : undefined,
            is_pdp_visible: !RESERVED_SPEC_KEYS.has(key),
            updated_at: new Date(),
        },
        select: { id: true },
    })
}

async function ensureSpecOption(specDefinitionId: number, value: string) {
    if (!value || value.length > 200) return null
    const slug = slugify(value)
    if (!slug) return null

    return prisma.spec_options.upsert({
        where: { spec_definition_id_slug: { spec_definition_id: specDefinitionId, slug } },
        create: {
            spec_definition_id: specDefinitionId,
            value,
            slug,
        },
        update: { value },
        select: { id: true },
    })
}

async function resolveExistingProduct(product: any, brandId: number) {
    const sourceUrl = normalizeUrl(toDisplayValue(product.source_url))
    const sourceProductId = toDisplayValue(product.hita_product_id) || hitaProductId(sourceUrl)
    const sku = toDisplayValue(product.sku)

    if (sourceProductId) {
        const byHitaId = await prisma.products.findFirst({
            where: { brand_id: brandId, hita_product_id: sourceProductId },
            select: { id: true },
        })
        if (byHitaId) return byHitaId

        const bySourceMappingId = await prisma.product_source_mappings.findFirst({
            where: { source, source_product_id: sourceProductId },
            select: { product_id: true },
        })
        if (bySourceMappingId?.product_id) return { id: bySourceMappingId.product_id }
    }

    if (sourceUrl) {
        const bySourceUrl = await prisma.products.findFirst({
            where: { brand_id: brandId, source_url: sourceUrl },
            select: { id: true },
        })
        if (bySourceUrl) return bySourceUrl

        const bySourceMappingUrl = await prisma.product_source_mappings.findFirst({
            where: { source, source_url: sourceUrl },
            select: { product_id: true },
        })
        if (bySourceMappingUrl?.product_id) return { id: bySourceMappingUrl.product_id }
    }

    if (sku) {
        const bySku = await prisma.products.findFirst({
            where: { brand_id: brandId, sku },
            select: { id: true },
        })
        if (bySku) return bySku

        return prisma.products.findFirst({
            where: { sku },
            select: { id: true },
        })
    }

    return null
}

function cloneProductPayload(product: Record<string, unknown>) {
    return JSON.parse(JSON.stringify(product || {}))
}

function importSafeSlug(product: any, sourceUrl: string | null, hitaId: string | null) {
    const baseSlug = toDisplayValue(product.slug) || slugify(toDisplayValue(product.name) || toDisplayValue(product.sku))
    if (!baseSlug || !sourceUrl?.includes('?vid=')) return baseSlug

    const suffix = slugify(toDisplayValue(product.sku) || toDisplayValue(hitaId) || 'variant')
    if (!suffix || baseSlug.endsWith(`-${suffix}`)) return baseSlug
    return `${baseSlug}-${suffix}`
}

function readJsonFile<T = unknown>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function sampleProductPath() {
    if (!sampleDir) return ''
    return path.join(sampleDir, 'sample-products.normalized.json')
}

function manifestPath() {
    if (imageManifestArg) return imageManifestArg
    if (!sampleDir) return ''
    return path.join(sampleDir, 'image-migration-manifest.json')
}

function loadOnlySkus() {
    const fromArg = onlySkusArg
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    if (fromArg.length > 0) return new Set(fromArg)

    const filePath = sampleProductPath()
    if (!filePath || !fs.existsSync(filePath)) return null

    const products = readJsonFile<Array<Record<string, unknown>>>(filePath)
    return new Set(products.map(product => toDisplayValue(product.sku)).filter(Boolean))
}

function loadVerifiedBunnyMap() {
    const filePath = manifestPath()
    if (!filePath) return { map: new Map<string, string>(), brokenSourceUrls: new Set<string>() }
    if (!fs.existsSync(filePath)) throw new Error(`Image manifest not found: ${filePath}`)

    const raw = readJsonFile<any>(filePath)
    const entries = Array.isArray(raw) ? raw : Array.isArray(raw.manifest) ? raw.manifest : []
    const mapping = new Map<string, string>()
    const brokenSourceUrls = new Set<string>()

    for (const entry of entries) {
        const sourceUrl = toDisplayValue(entry.source_url)
        const bunnyUrl = toDisplayValue(entry.upload?.bunny_url || entry.bunny_url)
        if (!sourceUrl || !bunnyUrl) continue
        if (entry.upload?.verified) {
            mapping.set(sourceUrl, bunnyUrl)
            continue
        }
        if (entry.upload?.broken_source || ['source_fetch_404', 'source_fetch_410'].includes(toDisplayValue(entry.upload?.error))) {
            brokenSourceUrls.add(sourceUrl)
        }
    }

    return { map: mapping, brokenSourceUrls }
}

function rewriteUrl(value: unknown, imageState: { map: Map<string, string>; brokenSourceUrls: Set<string> }, context: string) {
    const url = toDisplayValue(value)
    if (!url) return ''
    const rewritten = imageState.map.get(url)
    if (rewritten) return rewritten
    if (imageState.brokenSourceUrls.has(url)) return ''
    if (requireBunnyImages && isWhitelistedHitaDescriptionAssetUrl(url)) {
        throw new Error(`Missing verified Bunny mapping for ${context}: ${url}`)
    }
    return url
}

function rewriteProductMediaUrl(value: unknown, imageState: { map: Map<string, string>; brokenSourceUrls: Set<string> }, context: string) {
    const url = toDisplayValue(value)
    if (!url) return ''
    const rewritten = imageState.map.get(url)
    if (rewritten) return rewritten
    if (imageState.brokenSourceUrls.has(url)) return ''
    if (requireBunnyImages && isAnyHitaAssetUrl(url)) {
        throw new Error(`Missing verified Bunny mapping for ${context}: ${url}`)
    }
    return url
}

function isAnyHitaAssetUrl(url: string) {
    try {
        const parsed = new URL(url)
        return parsed.hostname === 'hita.com.vn' || parsed.hostname === 'cdn.hita.com.vn'
    } catch {
        return false
    }
}

function isWhitelistedHitaDescriptionAssetUrl(url: string) {
    try {
        const parsed = new URL(url)
        if (parsed.hostname === 'cdn.hita.com.vn' && parsed.pathname.startsWith('/storage/products/')) return true
        if (parsed.hostname === 'hita.com.vn' && parsed.pathname.startsWith('/public/upload/')) return true
        if (parsed.hostname === 'hita.com.vn' && parsed.pathname.startsWith('/tinymce/uploads/')) return true
        return false
    } catch {
        return false
    }
}

function rewriteHtmlImageUrls(html: unknown, imageState: { map: Map<string, string>; brokenSourceUrls: Set<string> }) {
    let output = toDisplayValue(html)
    if (!output || imageState.map.size === 0) return output
    for (const [sourceUrl, bunnyUrl] of imageState.map.entries()) {
        output = output.split(sourceUrl).join(bunnyUrl)
    }
    for (const sourceUrl of imageState.brokenSourceUrls) {
        output = output.split(sourceUrl).join('')
    }
    return output
}

function applyImageManifest(product: any, imageState: { map: Map<string, string>; brokenSourceUrls: Set<string> }) {
    if (imageState.map.size === 0 && imageState.brokenSourceUrls.size === 0) return product

    product.image_main_url = rewriteProductMediaUrl(product.image_main_url, imageState, `${product.sku}.image_main_url`) || null
    product.product_images = Array.isArray(product.product_images)
        ? product.product_images.map((image: any, index: number) => ({
            ...image,
            url: rewriteProductMediaUrl(image.url || image.image_url, imageState, `${product.sku}.product_images[${index}]`),
            image_url: image.image_url ? rewriteProductMediaUrl(image.image_url, imageState, `${product.sku}.product_images[${index}].image_url`) : undefined,
        }))
        : []

    if (rewriteDescriptionImages) {
        product.description = rewriteHtmlImageUrls(product.description, imageState) || null
    }

    return product
}

function isPromotionalAssetUrl(url: string) {
    return /\/storage\/banner\/|\/banner\/|\/widget\/|icon-|logo|brand|placeholder|loading|spinner/i.test(url)
}

function isSafeDocument(doc: unknown) {
    const document = asObject(doc)
    const url = toDisplayValue(document.url)
    if (!url || isPromotionalAssetUrl(url)) return false
    return /\.(pdf|dwg|dxf|jpg|jpeg|png|webp)(\?|#|$)|cad|ban-ve|bản vẽ/i.test(url)
}

function normalizePackageLabel(value: unknown) {
    return toDisplayValue(value).replace(/\s+/g, ' ').trim()
}

function hasSkuLikeToken(value: string) {
    return /\b[A-Z0-9][A-Z0-9#./()_-]{2,}\b/i.test(value) && /\d/.test(value)
}

function isPackageItemLabel(value: string) {
    if (!value || value.length > 160) return false
    if (/^(sản phẩm bao gồm|nguyên hộp|bao gồm)\s*:?\s*$/i.test(value)) return false
    if (/^(danh mục|mã sản phẩm|vị trí lắp|chat lieu|chất liệu(?:\s+[^:]+)?|màu sắc(?:\s+[^:]+)?|size(?:\s+[^:]+)?|kích thước(?:\s+[^:]+)?|dung lượng(?:\s+[^:]+)?|công nghệ|nguồn điện|công suất|thông số|thiết kế|bản lề|chậu sứ|áp lực nước|tâm thoát|kiểu thoát|kiểu xả|lượng nước xả|hệ thống xả|điện áp|nguồn nước)\s*:/i.test(value)) return false
    if (/(rimless|aqua-?jet|sấy khô|bệ ngồi|kháng khuẩn|khử mùi|massage|bọt khí|phát sáng|bảo vệ an toàn|dễ vệ sinh|hạn chế bám bẩn)/i.test(value)) return false
    if (!hasSkuLikeToken(value) && /,/.test(value)) return false
    if (!hasSkuLikeToken(value) && /(sang trọng|dễ dàng vệ sinh|thiết kế|bền bỉ|thân thiện|không gian|lưu trữ|phong cách|không gây tiếng ồn|lắp đặt đơn giản)/i.test(value)) return false
    return true
}

function childSkuCandidateFromPackageLabel(label: string) {
    const matches = label.match(/\b[A-Z0-9][A-Z0-9#./()_-]{2,}\b/gi) || []
    const sku = matches
        .map(item => item.replace(/\s+/g, '').trim())
        .find(item => /\d/.test(item) && /^[A-Z0-9][A-Z0-9#./()_-]{2,}$/i.test(item))
    return sku || null
}

function relationshipCandidatesFromPackageItems(items: string[]) {
    return items.map(label => ({
        label,
        component_type: 'included_item',
        relationship_type: 'component',
        resolution_status: childSkuCandidateFromPackageLabel(label) ? 'needs_resolve_after_import' : 'needs_manual_review',
        child_sku_candidate: childSkuCandidateFromPackageLabel(label),
    }))
}

function normalizedStringList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map(item => toDisplayValue(item)).filter(Boolean)
}

function sanitizeImportPayload(rawProduct: Record<string, unknown>) {
    const product = cloneProductPayload(rawProduct) as any
    const sourceText = `${product.source_url || ''} ${product.name || ''}`.toLowerCase()

    if (product.subcategory_id === 'tu-chau' || /tu-chau|tu-ke-nha-tam|cabinet/.test(sourceText)) {
        product.subcategory_id = 'lavabo'
        product.product_type = 'tu-chau'
        product.product_sub_type = null
    }

    const specs = asObject(product.specs)
    const documents = Array.isArray(specs.documents) ? specs.documents.filter(isSafeDocument) : []
    const packageItems = Array.isArray(specs['Phụ kiện đi kèm'])
        ? specs['Phụ kiện đi kèm']
            .map(normalizePackageLabel)
            .filter(isPackageItemLabel)
        : []

    product.specs = {
        ...specs,
        documents,
        'Phụ kiện đi kèm': packageItems,
    }

    product.relationship_candidates = relationshipCandidatesFromPackageItems(packageItems)

    return product
}

async function main() {
    const runId = runIdArg ? Number(runIdArg) : await latestRunId()
    if (!Number.isFinite(runId)) throw new Error(`Invalid --run-id=${runIdArg}`)
    if (activate && forceInactive) throw new Error('Use only one of --activate or --force-inactive')

    const onlySkus = loadOnlySkus()
    const imageMap = loadVerifiedBunnyMap()

    const allDecisions = await prisma.crawl_import_decisions.findMany({
        where: {
            decision: includeNeedsManualReview ? { in: ['approved', 'needs_manual_review'] } : 'approved',
            crawl_product_snapshots: { crawl_run_id: runId, source },
        },
        include: {
            crawl_product_snapshots: true,
        },
        orderBy: { id: 'asc' },
    })
    const selectedDecisions = onlySkus
        ? allDecisions.filter(decision => {
            const payload = asObject(decision.import_payload || decision.crawl_product_snapshots.normalized_payload)
            return onlySkus.has(toDisplayValue(payload.sku))
        })
        : allDecisions
    const pendingDecisions = selectedDecisions.filter(decision => !decision.import_result)

    if (onlySkus) {
        const found = new Set(selectedDecisions.map(decision => {
            const payload = asObject(decision.import_payload || decision.crawl_product_snapshots.normalized_payload)
            return toDisplayValue(payload.sku)
        }))
        const missing = Array.from(onlySkus).filter(sku => !found.has(sku))
        if (missing.length > 0) {
            throw new Error(`SKU guard failed: expected ${onlySkus.size}, found ${found.size}, missing=${missing.join(', ')}`)
        }
    }
    if (requireCount > 0 && selectedDecisions.length !== requireCount) {
        throw new Error(`Count guard failed: expected ${requireCount}, found ${selectedDecisions.length}`)
    }

    const variantCounts = new Map<string, number>()
    for (const decision of selectedDecisions) {
        const payload = applyImageManifest(sanitizeImportPayload(asObject(decision.import_payload || decision.crawl_product_snapshots.normalized_payload)), imageMap)
        const group = toDisplayValue(payload.variant_group)
        if (group) variantCounts.set(group, (variantCounts.get(group) || 0) + 1)
    }

    if (!execute) {
        console.log('[dry-run] Would import approved snapshots')
        console.log(JSON.stringify({
            run_id: runId,
            source,
            brand,
            approved_snapshots: selectedDecisions.length,
            pending_snapshots: pendingDecisions.length,
            already_imported_snapshots: selectedDecisions.length - pendingDecisions.length,
            only_skus: onlySkus ? Array.from(onlySkus) : null,
            variant_groups_multi_item: Array.from(variantCounts.entries()).filter(([, count]) => count > 1).length,
            activate,
            force_inactive: forceInactive,
            concurrency,
            image_manifest_entries: imageMap.size,
            require_bunny_images: requireBunnyImages,
            rewrite_description_images: rewriteDescriptionImages,
            include_needs_manual_review: includeNeedsManualReview,
        }, null, 2))
        return
    }

    const brandRow = await prisma.brands.findFirst({ where: { slug: brand }, select: { id: true } })
    if (!brandRow) throw new Error(`Brand not found: ${brand}`)

    let imported = 0
    let failed = 0
    const limit = pLimit(concurrency)

    await Promise.all(pendingDecisions.map(decision => limit(async () => {
        const product = applyImageManifest(
            sanitizeImportPayload(asObject(decision.import_payload || decision.crawl_product_snapshots.normalized_payload)),
            imageMap,
        )

        try {
            const category = await prisma.categories.findFirst({
                where: { slug: product.category_id },
                select: { id: true },
            })
            const subcategory = await prisma.subcategories.findFirst({
                where: { slug: product.subcategory_id },
                select: { id: true },
            })

            if (!category) throw new Error(`Category not found: ${product.category_id}`)

            const productType = await ensureProductType(subcategory?.id ?? null, product.product_type)
            const productSubType = await ensureProductSubType(productType?.id, product.product_sub_type)
            const variantGroup = await ensureVariantGroupForImport(product.variant_group, product, variantCounts.get(product.variant_group) || 0)
            const variantOptions = normalizedVariantOptions(product)
            const specs = asObject(product.specs)
            const existingProduct = await resolveExistingProduct(product, brandRow.id)
            const sourceUrl = toDisplayValue(product.source_url) || null
            const hitaId = toDisplayValue(product.hita_product_id) || hitaProductId(sourceUrl || '') || null
            const productData = {
                sku: product.sku,
                name: product.name,
                slug: importSafeSlug(product, sourceUrl, hitaId),
                category_id: category.id,
                subcategory_id: subcategory?.id ?? null,
                brand_id: brandRow.id,
                price: product.price ?? null,
                original_price: product.original_price ?? null,
                online_discount_amount: product.online_discount_amount ?? null,
                price_display: product.price_display ?? null,
                stock_status: product.stock_status || 'in_stock',
                description: product.description || null,
                specs: specs as Prisma.InputJsonValue,
                image_main_url: product.image_main_url || null,
                source_url: sourceUrl,
                hita_product_id: hitaId,
                product_type: product.product_type || null,
                product_sub_type: product.product_sub_type || null,
                product_type_id: productType?.id ?? null,
                product_sub_type_id: productSubType?.id ?? null,
                variant_group: variantGroup ? product.variant_group : null,
                variant_group_id: variantGroup?.id ?? null,
                variant_type: product.variant_type || null,
                variant_label: product.variant_label || null,
                variant_options: variantOptions as Prisma.InputJsonValue,
                is_master: product.is_master ?? true,
                is_combo: product.is_combo ?? false,
            }
            const upserted = existingProduct
                ? await prisma.products.update({
                    where: { id: existingProduct.id },
                    data: {
                        ...productData,
                        ...(forceInactive ? { is_active: false } : {}),
                        updated_at: new Date(),
                    },
                    select: { id: true },
                })
                : await prisma.products.create({
                    data: {
                        ...productData,
                        is_active: forceInactive ? false : activate,
                    },
                    select: { id: true },
                })

            await prisma.product_images.deleteMany({ where: { product_id: upserted.id } })
            const imageRows = (product.product_images || [])
                .map((image: any, index: number) => ({
                    product_id: upserted.id,
                    image_url: image.url || image.image_url,
                    alt_text: image.alt || product.name,
                    image_type: index === 0 ? 'primary' : 'gallery',
                    sort_order: image.sort_order ?? index,
                }))
                .filter((image: any) => image.image_url)
            if (imageRows.length > 0) await prisma.product_images.createMany({ data: imageRows })

            await prisma.product_secondary_subcategories.deleteMany({ where: { product_id: upserted.id } })
            const secondarySubcategorySlugs = normalizedStringList(product.secondary_subcategory_ids)
                .filter(slug => slug !== product.subcategory_id)
            for (const [index, slug] of secondarySubcategorySlugs.entries()) {
                const secondarySubcategory = await prisma.subcategories.findFirst({
                    where: { slug },
                    select: { id: true },
                })
                if (!secondarySubcategory) continue
                await prisma.product_secondary_subcategories.upsert({
                    where: {
                        product_id_subcategory_id: {
                            product_id: upserted.id,
                            subcategory_id: secondarySubcategory.id,
                        },
                    },
                    create: {
                        product_id: upserted.id,
                        subcategory_id: secondarySubcategory.id,
                        sort_order: index,
                    },
                    update: {
                        sort_order: index,
                    },
                })
            }

            await prisma.product_descriptions.upsert({
                where: { product_id: upserted.id },
                create: {
                    product_id: upserted.id,
                    raw_html: product.description_raw_html || null,
                    clean_html: product.description || null,
                    clean_issues: product.description_clean_issues || [],
                    source,
                },
                update: {
                    clean_html: product.description || null,
                    clean_issues: product.description_clean_issues || [],
                    source,
                    ...(replaceRawHtml ? { raw_html: product.description_raw_html || null } : {}),
                    updated_at: new Date(),
                },
            })

            await prisma.product_documents.deleteMany({ where: { product_id: upserted.id } })
            const documents = Array.isArray(specs.documents) ? specs.documents : []
            for (const [index, doc] of documents.entries()) {
                const url = toDisplayValue((doc as any).url)
                if (!url) continue
                await prisma.product_documents.create({
                    data: {
                        product_id: upserted.id,
                        name: toDisplayValue((doc as any).name) || 'Tài liệu',
                        url,
                        source_url: toDisplayValue((doc as any).source_url) || url,
                        document_type: (doc as any).type || inferDocType(url, toDisplayValue((doc as any).name)),
                        file_ext: url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase() || null,
                        sort_order: index,
                    },
                })
            }

            await prisma.product_package_items.deleteMany({ where: { product_id: upserted.id } })
            const packageItems = Array.isArray(specs['Phụ kiện đi kèm']) ? specs['Phụ kiện đi kèm'] : []
            for (const [index, item] of packageItems.entries()) {
                const label = toDisplayValue(item)
                if (!label) continue
                await prisma.product_package_items.create({
                    data: {
                        product_id: upserted.id,
                        label,
                        component_type: 'included_item',
                        sort_order: index,
                    },
                })
            }

            await prisma.product_spec_values.deleteMany({ where: { product_id: upserted.id } })
            const filterSpecs = asObject(product.filter_specs)
            for (const [key, rawValue] of Object.entries(specs)) {
                if (RESERVED_SPEC_KEYS.has(key)) continue
                const valueText = toDisplayValue(rawValue)
                if (!valueText) continue
                const specDefinition = await ensureSpecDefinition(key, Object.prototype.hasOwnProperty.call(filterSpecs, key))
                const option = Object.prototype.hasOwnProperty.call(filterSpecs, key)
                    ? await ensureSpecOption(specDefinition.id, valueText)
                    : null
                await prisma.product_spec_values.create({
                    data: {
                        product_id: upserted.id,
                        spec_definition_id: specDefinition.id,
                        option_id: option?.id ?? null,
                        value_text: valueText,
                        raw_key: key,
                        raw_value: valueText,
                        source,
                        confidence: 'high',
                    },
                })
            }

            await prisma.product_relationships.deleteMany({
                where: { parent_id: upserted.id, source },
            })
            const relationships = Array.isArray(product.relationship_candidates) ? product.relationship_candidates : []
            for (const [index, relationship] of relationships.entries()) {
                const relationshipType = relationship.relationship_type || 'component'
                const childSku = relationship.child_sku_candidate || relationship.child_sku || relationship.label || null
                if (!childSku) continue

                await prisma.product_relationships.upsert({
                    where: {
                        uq_product_rel: {
                            parent_id: upserted.id,
                            child_sku: childSku,
                            relationship_type: relationshipType,
                        },
                    },
                    create: {
                        parent_id: upserted.id,
                        relationship_type: relationshipType,
                        component_type: relationship.component_type || 'component',
                        child_sku: childSku,
                        sort_order: index,
                        resolution_status: relationship.resolution_status || 'unresolved',
                        source,
                    },
                    update: {
                        component_type: relationship.component_type || 'component',
                        sort_order: index,
                        resolution_status: relationship.resolution_status || 'unresolved',
                        source,
                    },
                })
            }

            const existingMapping = await prisma.product_source_mappings.findFirst({
                where: { source, source_url: product.source_url },
                select: { id: true },
            })
            if (existingMapping) {
                await prisma.product_source_mappings.update({
                    where: { id: existingMapping.id },
                    data: {
                        product_id: upserted.id,
                        source_product_id: hitaId,
                        sku: product.sku,
                        last_seen_at: new Date(),
                        last_crawl_run_id: runId,
                        status: 'active',
                    },
                })
            } else {
                await prisma.product_source_mappings.create({
                    data: {
                        product_id: upserted.id,
                        source,
                        source_product_id: hitaId,
                        source_url: product.source_url,
                        sku: product.sku,
                        last_crawl_run_id: runId,
                        status: 'active',
                    },
                })
            }

            await prisma.crawl_import_decisions.update({
                where: { id: decision.id },
                data: {
                    decision: 'imported',
                    target_product_id: upserted.id,
                    import_payload: product as Prisma.InputJsonValue,
                    reviewed_at: new Date(),
                    import_result: {
                        product_id: upserted.id,
                        activate,
                        force_inactive: forceInactive,
                        image_manifest_entries: imageMap.size,
                        rewrite_description_images: rewriteDescriptionImages,
                        replace_raw_html: replaceRawHtml,
                        include_needs_manual_review: includeNeedsManualReview,
                    } as Prisma.InputJsonValue,
                    updated_at: new Date(),
                },
            })

            imported += 1
            console.log(`imported ${product.sku}`)
        } catch (error) {
            failed += 1
            await prisma.crawl_import_decisions.update({
                where: { id: decision.id },
                data: {
                    decision: 'needs_manual_review',
                    reason: error instanceof Error ? error.message.slice(0, 200) : 'import_failed',
                    import_result: { error: String(error) } as Prisma.InputJsonValue,
                    updated_at: new Date(),
                },
            })
        }
    })))

    const run = await prisma.crawl_runs.findUnique({
        where: { id: runId },
        select: { summary: true },
    })
    const previousSummary = asObject(run?.summary)
    const totalImported = await prisma.crawl_import_decisions.count({
        where: {
            decision: 'imported',
            crawl_snapshot_id: { in: selectedDecisions.map(decision => decision.crawl_snapshot_id) },
        },
    })
    const totalFailed = await prisma.crawl_import_decisions.count({
        where: {
            decision: 'needs_manual_review',
            crawl_snapshot_id: { in: selectedDecisions.map(decision => decision.crawl_snapshot_id) },
        },
    })
    await prisma.crawl_runs.update({
        where: { id: runId },
        data: {
            status: failed > 0 ? 'completed_with_import_errors' : 'completed',
            summary: {
                ...previousSummary,
                imported: totalImported,
                failed: totalFailed,
                activate,
                force_inactive: forceInactive,
                image_manifest_entries: imageMap.size,
                rewrite_description_images: rewriteDescriptionImages,
                replace_raw_html: replaceRawHtml,
                concurrency,
                include_needs_manual_review: includeNeedsManualReview,
            } as Prisma.InputJsonValue,
        },
    })

    console.log(JSON.stringify({
        run_id: runId,
        imported,
        failed,
        activate,
        force_inactive: forceInactive,
        concurrency,
        image_manifest_entries: imageMap.size,
        rewrite_description_images: rewriteDescriptionImages,
        replace_raw_html: replaceRawHtml,
        include_needs_manual_review: includeNeedsManualReview,
    }, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
