import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()
const args = process.argv.slice(2)

const sampleDir = readArg('--sample-dir=', 'scripts/crawl-hita/output/caesar/sample-bon-cau')
const oldPrefix = readArg('--old-prefix=', 'https://cdn.dongphugia.com.vn/hita/sample/')
const newPrefix = readArg('--new-prefix=', 'https://cdn.dongphugia.com.vn/migrated/sample/')
const execute = args.includes('--execute')
const outFile = readArg('--out=', path.join(sampleDir, 'repoint-bunny-migrated-report.json'))

const bunnyKey = process.env.BUNNY_STORAGE_API_KEY || ''
const bunnyZone = process.env.BUNNY_STORAGE_ZONE_NAME || ''
const bunnyHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'

function readArg(prefix: string, fallback: string) {
    const arg = args.find(item => item.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : fallback
}

function readJsonFile<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function storageUrlFromCdn(cdnUrl: string) {
    const pathname = new URL(cdnUrl).pathname.replace(/^\/+/, '')
    return `https://${bunnyHostname}/${bunnyZone}/${pathname}`
}

function replaceAllUrls(value: string | null | undefined, mapping: Map<string, string>) {
    if (!value) return value ?? null
    let next = value
    for (const [oldUrl, newUrl] of mapping.entries()) {
        next = next.split(oldUrl).join(newUrl)
    }
    return next
}

function collectCdnUrls(value: string | null | undefined) {
    if (!value) return []
    const escaped = oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = value.match(new RegExp(`${escaped}[^"'\\s<>)]+`, 'g')) || []
    return matches.map(item => item.replace(/&quot;$/, ''))
}

async function copyAndVerify(oldUrl: string, newUrl: string) {
    if (!bunnyKey || !bunnyZone) {
        return { copied: false, verified: false, status: 0, content_type: null, error: 'missing_bunny_env' }
    }

    try {
        const source = await fetch(oldUrl)
        if (!source.ok) throw new Error(`source_fetch_${source.status}`)
        const contentType = source.headers.get('content-type') || 'application/octet-stream'
        const buffer = await source.arrayBuffer()

        const upload = await fetch(storageUrlFromCdn(newUrl), {
            method: 'PUT',
            headers: {
                AccessKey: bunnyKey,
                'Content-Type': contentType,
            },
            body: buffer,
        })
        if (!upload.ok) throw new Error(`bunny_upload_${upload.status}`)

        const head = await fetch(newUrl, { method: 'HEAD' })
        const verified = head.status === 200 && (head.headers.get('content-type') || '').startsWith('image/')
        return {
            copied: true,
            verified,
            status: head.status,
            content_type: head.headers.get('content-type'),
            error: verified ? null : 'verify_failed',
        }
    } catch (error) {
        return {
            copied: false,
            verified: false,
            status: 0,
            content_type: null,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

async function main() {
    const sampleProducts = readJsonFile<Array<{ sku: string }>>(path.join(sampleDir, 'sample-products.normalized.json'))
    const skus = sampleProducts.map(product => product.sku).filter(Boolean)
    if (skus.length !== 20) throw new Error(`Expected 20 sample SKUs, found ${skus.length}`)

    const products = await prisma.products.findMany({
        where: { sku: { in: skus } },
        select: {
            id: true,
            sku: true,
            image_main_url: true,
            description: true,
            product_images: { select: { id: true, image_url: true } },
            product_descriptions: { select: { raw_html: true, clean_html: true } },
        },
        orderBy: { sku: 'asc' },
    })
    if (products.length !== skus.length) throw new Error(`Expected ${skus.length} DB products, found ${products.length}`)

    const urlSet = new Set<string>()
    for (const product of products) {
        collectCdnUrls(product.image_main_url).forEach(url => urlSet.add(url))
        collectCdnUrls(product.description).forEach(url => urlSet.add(url))
        collectCdnUrls(product.product_descriptions?.clean_html).forEach(url => urlSet.add(url))
        for (const image of product.product_images) collectCdnUrls(image.image_url).forEach(url => urlSet.add(url))
    }

    const mapping = new Map(Array.from(urlSet).map(oldUrl => [oldUrl, oldUrl.replace(oldPrefix, newPrefix)]))
    const copied = []
    for (const [oldUrl, newUrl] of mapping.entries()) {
        copied.push({ old_url: oldUrl, new_url: newUrl, upload: await copyAndVerify(oldUrl, newUrl) })
    }
    const failed = copied.filter(entry => !entry.upload.verified)
    if (failed.length > 0) {
        const report = { execute, skus, oldPrefix, newPrefix, total_urls: mapping.size, failed, copied }
        fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
        throw new Error(`Copy/verify failed for ${failed.length}/${mapping.size}; see ${outFile}`)
    }

    const before = {
        products_with_old_main: products.filter(product => product.image_main_url?.includes(oldPrefix)).length,
        product_image_rows_with_old: products.reduce((sum, product) => sum + product.product_images.filter(image => image.image_url.includes(oldPrefix)).length, 0),
        products_with_old_description: products.filter(product => product.description?.includes(oldPrefix)).length,
        clean_descriptions_with_old: products.filter(product => product.product_descriptions?.clean_html?.includes(oldPrefix)).length,
    }

    if (execute) {
        const productIds = products.map(product => product.id)
        await prisma.$executeRaw`
            UPDATE products
            SET
                image_main_url = replace(image_main_url, ${oldPrefix}, ${newPrefix}),
                description = replace(description, ${oldPrefix}, ${newPrefix}),
                updated_at = now()
            WHERE id = ANY(${productIds})
              AND (
                image_main_url LIKE ${`${oldPrefix}%`}
                OR description LIKE ${`%${oldPrefix}%`}
              )
        `
        await prisma.$executeRaw`
            UPDATE product_images
            SET image_url = replace(image_url, ${oldPrefix}, ${newPrefix})
            WHERE product_id = ANY(${productIds})
              AND image_url LIKE ${`${oldPrefix}%`}
        `
        await prisma.$executeRaw`
            UPDATE product_descriptions
            SET
                clean_html = replace(clean_html, ${oldPrefix}, ${newPrefix}),
                updated_at = now()
            WHERE product_id = ANY(${productIds})
              AND clean_html LIKE ${`%${oldPrefix}%`}
        `
    }

    const afterProducts = await prisma.products.findMany({
        where: { sku: { in: skus } },
        select: {
            id: true,
            sku: true,
            image_main_url: true,
            description: true,
            product_images: { select: { image_url: true } },
            product_descriptions: { select: { clean_html: true } },
        },
        orderBy: { sku: 'asc' },
    })
    const after = {
        products_with_old_main: afterProducts.filter(product => product.image_main_url?.includes(oldPrefix)).length,
        product_image_rows_with_old: afterProducts.reduce((sum, product) => sum + product.product_images.filter(image => image.image_url.includes(oldPrefix)).length, 0),
        products_with_old_description: afterProducts.filter(product => product.description?.includes(oldPrefix)).length,
        clean_descriptions_with_old: afterProducts.filter(product => product.product_descriptions?.clean_html?.includes(oldPrefix)).length,
        products_with_new_main: afterProducts.filter(product => product.image_main_url?.includes(newPrefix)).length,
        product_image_rows_with_new: afterProducts.reduce((sum, product) => sum + product.product_images.filter(image => image.image_url.includes(newPrefix)).length, 0),
        products_with_new_description: afterProducts.filter(product => product.description?.includes(newPrefix)).length,
        clean_descriptions_with_new: afterProducts.filter(product => product.product_descriptions?.clean_html?.includes(newPrefix)).length,
    }

    const report = {
        execute,
        generated_at: new Date().toISOString(),
        skus,
        oldPrefix,
        newPrefix,
        total_urls: mapping.size,
        copied_verified: copied.filter(entry => entry.upload.verified).length,
        before,
        after,
        copied,
    }
    fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
