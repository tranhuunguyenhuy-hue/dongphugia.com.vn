import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()
const args = process.argv.slice(2)

const sampleDir = readArg('--sample-dir=', 'scripts/crawl-hita/output/caesar/sample-bon-cau')
const label = readArg('--label=', new Date().toISOString())
const outArg = readArg('--out=', '')
const activeSku = readArg('--active-sku=', '')

function readArg(prefix: string, fallback: string) {
    const arg = args.find(item => item.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : fallback
}

function readJsonFile<T = unknown>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function toNumber(value: unknown) {
    if (value === null || value === undefined) return null
    return Number(value)
}

function containsHita(value: string | null | undefined) {
    return Boolean(value && /cdn\.hita\.com\.vn/i.test(value))
}

function containsBunny(value: string | null | undefined) {
    return Boolean(value && /cdn\.dongphugia\.com\.vn/i.test(value))
}

async function main() {
    const products = readJsonFile<Array<{ sku: string }>>(path.join(sampleDir, 'sample-products.normalized.json'))
    const skus = products.map(product => product.sku).filter(Boolean)

    const rows = await prisma.products.findMany({
        where: { sku: { in: skus } },
        select: {
            id: true,
            sku: true,
            name: true,
            slug: true,
            price: true,
            original_price: true,
            online_discount_amount: true,
            price_display: true,
            image_main_url: true,
            source_url: true,
            is_active: true,
            description: true,
            product_images: {
                select: { image_url: true },
                orderBy: [{ image_type: 'asc' }, { sort_order: 'asc' }],
            },
            product_documents: { select: { id: true, url: true, document_type: true } },
            product_spec_values: { select: { id: true } },
        },
        orderBy: { sku: 'asc' },
    })

    const catalogCounts = {
        products: await prisma.products.count(),
        active_products: await prisma.products.count({ where: { is_active: true } }),
        product_images: await prisma.product_images.count(),
        product_documents: await prisma.product_documents.count(),
        product_spec_values: await prisma.product_spec_values.count(),
    }

    const perSku = rows.map(row => {
        const productUrl = `/thiet-bi-ve-sinh/bon-cau/${row.slug}`
        const imageUrls = [row.image_main_url, ...row.product_images.map(image => image.image_url)].filter(Boolean) as string[]
        return {
            sku: row.sku,
            id: row.id,
            name: row.name,
            slug: row.slug,
            pdp_path: productUrl,
            is_active: row.is_active,
            price: toNumber(row.price),
            original_price: toNumber(row.original_price),
            online_discount_amount: toNumber(row.online_discount_amount),
            price_display: row.price_display,
            source_url: row.source_url,
            source_url_present: Boolean(row.source_url),
            image_main_url: row.image_main_url,
            image_rows: row.product_images.length,
            bunny_image_rows: imageUrls.filter(containsBunny).length,
            hita_image_rows: imageUrls.filter(containsHita).length,
            document_rows: row.product_documents.length,
            pdf_rows: row.product_documents.filter(doc => doc.document_type === 'PDF' || /\.pdf(\?|#|$)/i.test(doc.url)).length,
            spec_rows: row.product_spec_values.length,
            description_length: row.description?.length || 0,
            description_hita_images: containsHita(row.description),
            description_bunny_images: containsBunny(row.description),
        }
    })

    const summary = {
        label,
        generated_at: new Date().toISOString(),
        sample_dir: sampleDir,
        expected_skus: skus.length,
        found_skus: rows.length,
        missing_skus: skus.filter(sku => !rows.some(row => row.sku === sku)),
        active_sample_skus: perSku.filter(row => row.is_active).map(row => row.sku),
        active_sku: activeSku,
        catalog_counts: catalogCounts,
        sample_totals: {
            image_rows: perSku.reduce((sum, row) => sum + row.image_rows, 0),
            bunny_image_refs: perSku.reduce((sum, row) => sum + row.bunny_image_rows, 0),
            hita_image_refs: perSku.reduce((sum, row) => sum + row.hita_image_rows, 0),
            document_rows: perSku.reduce((sum, row) => sum + row.document_rows, 0),
            pdf_rows: perSku.reduce((sum, row) => sum + row.pdf_rows, 0),
            spec_rows: perSku.reduce((sum, row) => sum + row.spec_rows, 0),
            source_url_present: perSku.filter(row => row.source_url_present).length,
        },
        per_sku: perSku,
    }

    if (outArg) {
        fs.mkdirSync(path.dirname(outArg), { recursive: true })
        fs.writeFileSync(outArg, `${JSON.stringify(summary, null, 2)}\n`)
    }

    console.log(JSON.stringify(summary, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
