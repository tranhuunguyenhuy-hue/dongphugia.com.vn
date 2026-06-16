import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()
const args = process.argv.slice(2)

const brand = readArg('--brand=', 'caesar')
const execute = args.includes('--execute')
const outputDir = readArg(
    '--output-dir=',
    path.resolve(process.cwd(), `scripts/crawl-hita/output/description-image-migration/${brand}`)
)
const batchName = readArg('--batch=', brand)

const bunnyKey = process.env.BUNNY_STORAGE_API_KEY || ''
const bunnyZone = process.env.BUNNY_STORAGE_ZONE_NAME || ''
const bunnyHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const bunnyCdn = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

type FieldName = 'products.description' | 'product_descriptions.clean_html' | 'product_descriptions.raw_html'

type ImageHit = {
    product_id: number
    sku: string
    brand: string
    field: FieldName
    url: string
    prefix: string
}

type MappingEntry = {
    old_url: string
    new_url: string
    storage_path: string
    refs: number
    products: string[]
    fields: FieldName[]
}

type UploadResult = {
    old_url: string
    new_url: string
    storage_path: string
    refs: number
    products: string[]
    fields: FieldName[]
    copied: boolean
    verified: boolean
    source_status: number
    upload_status: number
    verify_status: number
    content_type: string | null
    bytes: number
    error: string | null
}

function readArg(prefix: string, fallback: string) {
    const arg = args.find(item => item.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : fallback
}

function extractImgSrcs(html: string | null | undefined) {
    if (!html) return []
    const urls: string[] = []
    const regex = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null) {
        const value = match[2]?.trim()
        if (value) urls.push(value)
    }
    return urls
}

function extractCandidateUrls(html: string | null | undefined) {
    if (!html) return []
    const urls = new Set(extractImgSrcs(html))
    const regex = /https:\/\/(?:cdn\.hita\.com\.vn\/storage\/products|hita\.com\.vn\/public\/upload|hita\.com\.vn\/tinymce\/uploads)\/[^"'<>)\s]+/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null) {
        urls.add(match[0].replace(/&(?:quot|apos);?$/i, ''))
    }
    return [...urls]
}

function parseUrl(rawUrl: string) {
    try {
        return new URL(rawUrl)
    } catch {
        return null
    }
}

function isWhitelistedSource(rawUrl: string) {
    const url = parseUrl(rawUrl)
    if (!url) return false

    if (url.hostname === bunnyCdn && url.pathname.startsWith('/migrated/sample/')) return false
    if (url.hostname === 'hita.com.vn' && url.pathname === '/images/icon-pdf.png') return false
    if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/storage/comments/')) return false
    if (url.hostname === 'img.youtube.com') return false

    if (url.hostname === 'cdn.hita.com.vn' && url.pathname.startsWith('/storage/products/')) return true
    if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/public/upload/')) return true
    if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/tinymce/uploads/')) return true

    return false
}

function prefixFor(rawUrl: string) {
    const url = parseUrl(rawUrl)
    if (!url) return '(invalid-url)'
    if (url.hostname === 'cdn.hita.com.vn' && url.pathname.startsWith('/storage/products/')) {
        return 'cdn.hita.com.vn/storage/products'
    }
    if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/public/upload/')) {
        return 'hita.com.vn/public/upload'
    }
    if (url.hostname === 'hita.com.vn' && url.pathname.startsWith('/tinymce/uploads/')) {
        return 'hita.com.vn/tinymce/uploads'
    }
    return `${url.hostname}${url.pathname}`
}

function extensionFromUrl(rawUrl: string) {
    const url = parseUrl(rawUrl)
    const ext = url ? path.extname(decodeURIComponent(url.pathname)).toLowerCase() : ''
    if (/^\.(jpe?g|png|gif|webp|avif|svg)$/.test(ext)) return ext
    return '.jpg'
}

function basenameFromUrl(rawUrl: string) {
    const url = parseUrl(rawUrl)
    const rawBase = url ? path.basename(decodeURIComponent(url.pathname), path.extname(url.pathname)) : 'image'
    const slug = rawBase
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
    return slug || 'image'
}

function destinationFor(rawUrl: string) {
    const hash = crypto.createHash('sha256').update(rawUrl).digest('hex').slice(0, 12)
    const ext = extensionFromUrl(rawUrl)
    const basename = basenameFromUrl(rawUrl)
    const storagePath = `migrated/descriptions/${brand}/${hash}-${basename}${ext}`
    return {
        storage_path: storagePath,
        new_url: `https://${bunnyCdn}/${storagePath}`,
    }
}

function storageUploadUrl(storagePath: string) {
    return `https://${bunnyHostname}/${bunnyZone}/${storagePath}`
}

function replaceAllUrls(value: string | null | undefined, mapping: Map<string, string>) {
    if (!value) return value ?? null
    let next = value
    for (const [oldUrl, newUrl] of mapping.entries()) {
        next = next.split(oldUrl).join(newUrl)
    }
    return next
}

function countByPrefix(hits: ImageHit[]) {
    const counts = new Map<string, { refs: number; unique_urls: Set<string>; products: Set<number> }>()
    for (const hit of hits) {
        const current = counts.get(hit.prefix) || { refs: 0, unique_urls: new Set<string>(), products: new Set<number>() }
        current.refs += 1
        current.unique_urls.add(hit.url)
        current.products.add(hit.product_id)
        counts.set(hit.prefix, current)
    }
    return [...counts.entries()]
        .map(([prefix, item]) => ({
            prefix,
            refs: item.refs,
            unique_urls: item.unique_urls.size,
            products: item.products.size,
        }))
        .sort((a, b) => b.refs - a.refs || a.prefix.localeCompare(b.prefix))
}

async function uploadAndVerify(entry: MappingEntry): Promise<UploadResult> {
    if (!bunnyKey || !bunnyZone) {
        return {
            ...entry,
            copied: false,
            verified: false,
            source_status: 0,
            upload_status: 0,
            verify_status: 0,
            content_type: null,
            bytes: 0,
            error: 'missing_bunny_env',
        }
    }

    try {
        const source = await fetch(entry.old_url)
        const sourceStatus = source.status
        if (!source.ok) throw new Error(`source_fetch_${source.status}`)

        const contentType = source.headers.get('content-type') || 'application/octet-stream'
        const buffer = await source.arrayBuffer()

        const upload = await fetch(storageUploadUrl(entry.storage_path), {
            method: 'PUT',
            headers: {
                AccessKey: bunnyKey,
                'Content-Type': contentType,
            },
            body: buffer,
        })
        if (!upload.ok) throw new Error(`bunny_upload_${upload.status}`)

        let verifyStatus = 0
        let verifyContentType: string | null = null
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const head = await fetch(entry.new_url, { method: 'HEAD' })
            verifyStatus = head.status
            verifyContentType = head.headers.get('content-type')
            if (verifyStatus === 200 && (verifyContentType || '').startsWith('image/')) break
            await new Promise(resolve => setTimeout(resolve, 750))
        }

        const verified = verifyStatus === 200 && (verifyContentType || '').startsWith('image/')
        return {
            ...entry,
            copied: true,
            verified,
            source_status: sourceStatus,
            upload_status: upload.status,
            verify_status: verifyStatus,
            content_type: verifyContentType,
            bytes: buffer.byteLength,
            error: verified ? null : 'verify_failed',
        }
    } catch (error) {
        return {
            ...entry,
            copied: false,
            verified: false,
            source_status: 0,
            upload_status: 0,
            verify_status: 0,
            content_type: null,
            bytes: 0,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

async function main() {
    fs.mkdirSync(outputDir, { recursive: true })

    const products = await prisma.products.findMany({
        where: {
            brands: { slug: brand },
            OR: [
                { description: { contains: '<img', mode: 'insensitive' } },
                { product_descriptions: { raw_html: { contains: '<img', mode: 'insensitive' } } },
                { product_descriptions: { clean_html: { contains: '<img', mode: 'insensitive' } } },
            ],
        },
        select: {
            id: true,
            sku: true,
            is_active: true,
            description: true,
            product_descriptions: {
                select: {
                    raw_html: true,
                    clean_html: true,
                },
            },
            brands: { select: { slug: true } },
        },
        orderBy: [{ brand_id: 'asc' }, { sku: 'asc' }],
    })

    const hits: ImageHit[] = []
    const seen = new Set<string>()
    for (const product of products) {
        const fields: Array<[FieldName, string | null | undefined]> = [
            ['products.description', product.description],
            ['product_descriptions.clean_html', product.product_descriptions?.clean_html],
            ['product_descriptions.raw_html', product.product_descriptions?.raw_html],
        ]

        for (const [field, html] of fields) {
            for (const src of extractCandidateUrls(html)) {
                const parsed = parseUrl(src)
                const normalized = parsed ? parsed.toString() : src
                const key = `${product.id}|${field}|${normalized}`
                if (seen.has(key)) continue
                seen.add(key)
                hits.push({
                    product_id: product.id,
                    sku: product.sku,
                    brand: product.brands?.slug || '(no-brand)',
                    field,
                    url: normalized,
                    prefix: prefixFor(normalized),
                })
            }
        }
    }

    const whitelistedHits = hits.filter(hit => isWhitelistedSource(hit.url))
    const skippedHits = hits.filter(hit => !isWhitelistedSource(hit.url))
    const mutableHits = whitelistedHits.filter(hit => hit.field !== 'product_descriptions.raw_html')
    const rawOnlyUrls = new Set(
        whitelistedHits
            .filter(hit => hit.field === 'product_descriptions.raw_html')
            .map(hit => hit.url)
    )
    const mutableUrlSet = new Set(mutableHits.map(hit => hit.url))
    const rawOnlyWhitelistedUrls = [...rawOnlyUrls].filter(url => !mutableUrlSet.has(url))

    const mappings = [...mutableUrlSet].sort().map(oldUrl => {
        const matchingHits = mutableHits.filter(hit => hit.url === oldUrl)
        const destination = destinationFor(oldUrl)
        return {
            old_url: oldUrl,
            new_url: destination.new_url,
            storage_path: destination.storage_path,
            refs: matchingHits.length,
            products: [...new Set(matchingHits.map(hit => hit.sku))].sort(),
            fields: [...new Set(matchingHits.map(hit => hit.field))].sort() as FieldName[],
        }
    })

    const mappingMap = new Map(mappings.map(item => [item.old_url, item.new_url]))
    const uploads: UploadResult[] = []
    for (const mapping of mappings) {
        uploads.push(await uploadAndVerify(mapping))
        if (uploads.length % 50 === 0) {
            console.log(`uploaded_verified_progress=${uploads.filter(item => item.verified).length}/${uploads.length}/${mappings.length}`)
        }
    }

    const failed = uploads.filter(item => !item.verified)
    const before = {
        products_scanned: products.length,
        products_active: products.filter(product => product.is_active).length,
        img_refs_total: hits.length,
        whitelisted_refs_total: whitelistedHits.length,
        mutable_whitelisted_refs: mutableHits.length,
        skipped_refs_total: skippedHits.length,
        mutable_unique_urls: mutableUrlSet.size,
        raw_only_whitelisted_unique_urls: rawOnlyWhitelistedUrls.length,
        by_whitelisted_prefix: countByPrefix(whitelistedHits),
        by_skipped_prefix: countByPrefix(skippedHits),
    }

    let changedProducts = 0
    let changedDescriptions = 0
    let changedCleanHtml = 0

    if (failed.length === 0 && execute) {
        const productIds = products.map(product => product.id)
        await prisma.$transaction(async tx => {
            for (const product of products) {
                const nextDescription = replaceAllUrls(product.description, mappingMap)
                const nextCleanHtml = replaceAllUrls(product.product_descriptions?.clean_html, mappingMap)
                const descriptionChanged = nextDescription !== (product.description ?? null)
                const cleanHtmlChanged = nextCleanHtml !== (product.product_descriptions?.clean_html ?? null)

                if (descriptionChanged) {
                    await tx.products.update({
                        where: { id: product.id },
                        data: { description: nextDescription, updated_at: new Date() },
                    })
                    changedProducts += 1
                    changedDescriptions += 1
                }

                if (cleanHtmlChanged) {
                    await tx.product_descriptions.update({
                        where: { product_id: product.id },
                        data: { clean_html: nextCleanHtml, updated_at: new Date() },
                    })
                    changedCleanHtml += 1
                }
            }

            const activeAfter = await tx.products.count({
                where: { id: { in: productIds }, is_active: true },
            })
            if (activeAfter !== before.products_active) {
                throw new Error(`is_active_count_changed_before_${before.products_active}_after_${activeAfter}`)
            }
        }, { timeout: 120_000 })
    }

    const afterProducts = await prisma.products.findMany({
        where: { brands: { slug: brand } },
        select: {
            id: true,
            sku: true,
            is_active: true,
            description: true,
            product_descriptions: { select: { raw_html: true, clean_html: true } },
        },
        orderBy: { sku: 'asc' },
    })

    const afterMutableHits: ImageHit[] = []
    for (const product of afterProducts) {
        const fields: Array<[FieldName, string | null | undefined]> = [
            ['products.description', product.description],
            ['product_descriptions.clean_html', product.product_descriptions?.clean_html],
        ]
        for (const [field, html] of fields) {
            for (const src of extractCandidateUrls(html)) {
                const parsed = parseUrl(src)
                const normalized = parsed ? parsed.toString() : src
                afterMutableHits.push({
                    product_id: product.id,
                    sku: product.sku,
                    brand,
                    field,
                    url: normalized,
                    prefix: prefixFor(normalized),
                })
            }
        }
    }

    const after = {
        products_total: afterProducts.length,
        products_active: afterProducts.filter(product => product.is_active).length,
        mutable_old_whitelist_refs_remaining: afterMutableHits.filter(hit => isWhitelistedSource(hit.url)).length,
        mutable_new_refs: afterMutableHits.filter(hit => hit.url.startsWith(`https://${bunnyCdn}/migrated/descriptions/${brand}/`)).length,
        changed_products: changedProducts,
        changed_products_description_rows: changedDescriptions,
        changed_product_descriptions_clean_html_rows: changedCleanHtml,
    }

    const report = {
        execute,
        batch: batchName,
        brand,
        generated_at: new Date().toISOString(),
        destination_prefix: `https://${bunnyCdn}/migrated/descriptions/${brand}/`,
        before,
        upload: {
            attempted: uploads.length,
            copied_verified: uploads.filter(item => item.verified).length,
            failed: failed.length,
            bytes: uploads.reduce((sum, item) => sum + item.bytes, 0),
        },
        after,
        raw_html_policy: {
            product_descriptions_raw_html_updated: false,
            raw_only_whitelisted_unique_urls_not_migrated: rawOnlyWhitelistedUrls.length,
        },
        guardrails: {
            updates_product_images: false,
            updates_product_spec_values: false,
            updates_product_documents: false,
            updates_is_active: false,
        },
        failed,
        mappings,
        uploads,
    }

    const reportFile = path.join(outputDir, `${batchName}-description-image-migration-report.json`)
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)

    if (failed.length > 0) {
        console.log(JSON.stringify({ reportFile, execute, before, upload: report.upload, after, failed: failed.slice(0, 10) }, null, 2))
        throw new Error(`Upload/verify failed for ${failed.length}/${uploads.length}; DB replace was not executed.`)
    }

    console.log(JSON.stringify({ reportFile, execute, before, upload: report.upload, after, raw_html_policy: report.raw_html_policy, guardrails: report.guardrails }, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
