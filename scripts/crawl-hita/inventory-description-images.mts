import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultBrands = [
    'caesar',
    'american-standard',
    'cotto',
    'grohe',
    'viglacera',
    'atmor',
    'moen',
]

const args = process.argv.slice(2)
const brands = readArg('--brands=', defaultBrands.join(',')).split(',').map(item => item.trim()).filter(Boolean)
const outputDir = readArg('--output-dir=', path.resolve(process.cwd(), 'scripts/crawl-hita/output/description-image-inventory'))

type ImageHit = {
    brand: string
    sku: string
    product_id: number
    field: 'products.description' | 'product_descriptions.raw_html' | 'product_descriptions.clean_html'
    url: string
    host: string
    pathname: string
    prefix: string
    isWhitelistedCandidate: boolean
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

function normalizeUrl(rawUrl: string) {
    try {
        return new URL(rawUrl)
    } catch {
        return null
    }
}

function getPrefix(url: URL) {
    const parts = url.pathname.split('/').filter(Boolean)
    if (url.hostname === 'cdn.hita.com.vn' && parts[0] === 'storage' && parts[1] === 'products') {
        return `${url.hostname}/storage/products`
    }
    if (url.hostname === 'cdn.dongphugia.com.vn') {
        return `${url.hostname}/${parts.slice(0, 3).join('/') || '(root)'}`
    }
    return `${url.hostname}/${parts.slice(0, 2).join('/') || '(root)'}`
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
    const counts = new Map<string, number>()
    for (const item of items) {
        const key = keyFn(item)
        counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...counts.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

function sampleHits(items: ImageHit[], limit = 8) {
    return items.slice(0, limit).map(item => ({
        brand: item.brand,
        sku: item.sku,
        field: item.field,
        url: item.url,
    }))
}

function formatTable(headers: string[], rows: Array<Array<string | number>>) {
    return [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.join(' | ')} |`),
    ].join('\n')
}

async function main() {
    fs.mkdirSync(outputDir, { recursive: true })

    const products = await prisma.products.findMany({
        where: {
            brands: { slug: { in: brands } },
            OR: [
                { description: { contains: '<img', mode: 'insensitive' } },
                { product_descriptions: { raw_html: { contains: '<img', mode: 'insensitive' } } },
                { product_descriptions: { clean_html: { contains: '<img', mode: 'insensitive' } } },
            ],
        },
        select: {
            id: true,
            sku: true,
            brands: { select: { slug: true } },
            description: true,
            product_descriptions: {
                select: {
                    raw_html: true,
                    clean_html: true,
                },
            },
        },
        orderBy: [{ brand_id: 'asc' }, { sku: 'asc' }],
    })

    const hits: ImageHit[] = []
    const seen = new Set<string>()

    for (const product of products) {
        const fields: Array<[ImageHit['field'], string | null | undefined]> = [
            ['products.description', product.description],
            ['product_descriptions.raw_html', product.product_descriptions?.raw_html],
            ['product_descriptions.clean_html', product.product_descriptions?.clean_html],
        ]

        for (const [field, html] of fields) {
            for (const src of extractImgSrcs(html)) {
                const parsed = normalizeUrl(src)
                const normalized = parsed ? parsed.toString() : src
                const key = `${product.id}|${field}|${normalized}`
                if (seen.has(key)) continue
                seen.add(key)

                const host = parsed?.hostname || '(invalid-url)'
                const pathname = parsed?.pathname || src
                hits.push({
                    brand: product.brands?.slug || '(no-brand)',
                    sku: product.sku,
                    product_id: product.id,
                    field,
                    url: normalized,
                    host,
                    pathname,
                    prefix: parsed ? getPrefix(parsed) : '(invalid-url)',
                    isWhitelistedCandidate: host === 'cdn.hita.com.vn' && pathname.startsWith('/storage/products/'),
                })
            }
        }
    }

    const uniqueUrls = new Set(hits.map(item => item.url))
    const riskyHits = hits.filter(item => !item.isWhitelistedCandidate)
    const whitelistHits = hits.filter(item => item.isWhitelistedCandidate)

    const byBrand = brands.map(brand => {
        const brandHits = hits.filter(item => item.brand === brand)
        const brandRisky = brandHits.filter(item => !item.isWhitelistedCandidate)
        const brandWhitelist = brandHits.filter(item => item.isWhitelistedCandidate)
        return {
            brand,
            products_with_img: new Set(brandHits.map(item => item.product_id)).size,
            img_refs: brandHits.length,
            unique_urls: new Set(brandHits.map(item => item.url)).size,
            whitelist_refs: brandWhitelist.length,
            risky_refs: brandRisky.length,
            risky_unique_urls: new Set(brandRisky.map(item => item.url)).size,
        }
    })

    const byPrefix = countBy(hits, item => item.prefix).map(item => {
        const prefixHits = hits.filter(hit => hit.prefix === item.key)
        return {
            prefix: item.key,
            refs: item.count,
            unique_urls: new Set(prefixHits.map(hit => hit.url)).size,
            products: new Set(prefixHits.map(hit => hit.product_id)).size,
            brands: [...new Set(prefixHits.map(hit => hit.brand))].sort().join(', '),
            whitelist_candidate: prefixHits.every(hit => hit.isWhitelistedCandidate),
        }
    })

    const byField = countBy(hits, item => item.field)
    const byRiskyPrefix = countBy(riskyHits, item => item.prefix).map(item => {
        const prefixHits = riskyHits.filter(hit => hit.prefix === item.key)
        return {
            prefix: item.key,
            refs: item.count,
            unique_urls: new Set(prefixHits.map(hit => hit.url)).size,
            products: new Set(prefixHits.map(hit => hit.product_id)).size,
            brands: [...new Set(prefixHits.map(hit => hit.brand))].sort().join(', '),
            samples: sampleHits(prefixHits, 5),
        }
    })

    const report = {
        generated_at: new Date().toISOString(),
        scope: { brands },
        summary: {
            products_scanned_with_img: products.length,
            img_refs: hits.length,
            unique_urls: uniqueUrls.size,
            whitelist_candidate_refs: whitelistHits.length,
            whitelist_candidate_unique_urls: new Set(whitelistHits.map(item => item.url)).size,
            risky_or_non_whitelist_refs: riskyHits.length,
            risky_or_non_whitelist_unique_urls: new Set(riskyHits.map(item => item.url)).size,
        },
        by_brand: byBrand,
        by_field: byField,
        by_prefix: byPrefix,
        risky_or_non_whitelist_by_prefix: byRiskyPrefix,
        risky_or_non_whitelist_samples: sampleHits(riskyHits, 30),
    }

    const jsonFile = path.join(outputDir, 'description-image-inventory.json')
    fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`)

    const markdown = [
        '# Description Image Inventory — 7 Hita Brands',
        '',
        `Generated: ${report.generated_at}`,
        '',
        '## Summary',
        '',
        formatTable(
            ['Metric', 'Value'],
            [
                ['Products with description images', report.summary.products_scanned_with_img],
                ['Image refs', report.summary.img_refs],
                ['Unique image URLs', report.summary.unique_urls],
                ['Whitelist candidate refs', report.summary.whitelist_candidate_refs],
                ['Whitelist candidate unique URLs', report.summary.whitelist_candidate_unique_urls],
                ['Risky/non-whitelist refs', report.summary.risky_or_non_whitelist_refs],
                ['Risky/non-whitelist unique URLs', report.summary.risky_or_non_whitelist_unique_urls],
            ]
        ),
        '',
        '## By Brand',
        '',
        formatTable(
            ['Brand', 'Products', 'Refs', 'Unique URLs', 'Whitelist refs', 'Risky refs', 'Risky unique'],
            byBrand.map(item => [
                item.brand,
                item.products_with_img,
                item.img_refs,
                item.unique_urls,
                item.whitelist_refs,
                item.risky_refs,
                item.risky_unique_urls,
            ])
        ),
        '',
        '## By Prefix',
        '',
        formatTable(
            ['Prefix', 'Refs', 'Unique URLs', 'Products', 'Brands', 'Whitelist?'],
            byPrefix.map(item => [
                item.prefix,
                item.refs,
                item.unique_urls,
                item.products,
                item.brands,
                item.whitelist_candidate ? 'yes' : 'no',
            ])
        ),
        '',
        '## Risky / Non-whitelist Prefixes',
        '',
        byRiskyPrefix.length === 0
            ? 'No risky/non-whitelist description image URLs found.'
            : formatTable(
                ['Prefix', 'Refs', 'Unique URLs', 'Products', 'Brands'],
                byRiskyPrefix.map(item => [
                    item.prefix,
                    item.refs,
                    item.unique_urls,
                    item.products,
                    item.brands,
                ])
            ),
        '',
        '## Proposed Whitelist',
        '',
        '- Migrate only description image URLs on `cdn.hita.com.vn/storage/products/...`.',
        '- Do not migrate paths outside that whitelist until Tech Lead explicitly approves them.',
        '- Current Bunny URLs are already migrated assets and should not be re-migrated by the full Hita description-image pass.',
        '',
    ].join('\n')

    const markdownFile = path.join(outputDir, 'description-image-inventory.md')
    fs.writeFileSync(markdownFile, `${markdown}\n`)

    console.log(JSON.stringify({
        jsonFile,
        markdownFile,
        summary: report.summary,
        byBrand,
        riskyPrefixes: byRiskyPrefix.map(item => ({
            prefix: item.prefix,
            refs: item.refs,
            unique_urls: item.unique_urls,
            products: item.products,
            brands: item.brands,
        })),
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
