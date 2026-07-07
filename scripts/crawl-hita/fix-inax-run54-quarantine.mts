import fs from 'node:fs'
import { chromium } from 'playwright'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RUN_ID = 54
const BRAND = 'inax'

const SKU_FIXES: Record<string, { product_type?: string }> = {
    'LFV-20SP': { product_type: 'voi-lanh' },
    'LFV-21SP': { product_type: 'voi-lanh' },
    'LFV-5010S': { product_type: 'voi-nong-lanh' },
    'AC-902VN/BW1': {},
}

const DESCRIPTION_EXTRACTOR_SOURCE = `(() => {
    const abs = (value) => {
        if (!value) return ''
        try {
            return new URL(value, 'https://hita.com.vn').href
        } catch {
            return value
        }
    }

    const materializeLazyImages = (root, issues) => {
        for (const img of [...root.querySelectorAll('img')]) {
            const lazySrc = abs(
                img.getAttribute('data-src')
                || img.getAttribute('data-lazy')
                || img.getAttribute('data-original')
                || img.getAttribute('data-zoom-image')
                || ''
            )
            const currentSrc = abs(img.getAttribute('src') || '')
            const currentLooksPlaceholder = !currentSrc || /placeholder|loading|spinner|original\\.jpg|blank|no-image/i.test(currentSrc)
            if (lazySrc && (currentLooksPlaceholder || lazySrc !== currentSrc)) {
                img.setAttribute('src', lazySrc)
                issues.push(\`rewrote_lazy_image:\${currentSrc || '(empty)'}->\${lazySrc}\`)
            }
        }
    }

    const findDescriptionRoot = () => {
        const selectors = [
            '#description-content .description-collapse',
            '#description-content',
            '.description-collapse',
            '#box-description',
            '#description',
            '.product-description',
            '.product-content',
            '.tab-content',
        ]

        const candidates = selectors
            .map((selector) => ({ selector, node: document.querySelector(selector) }))
            .filter((entry) => entry.node)
            .filter(({ selector, node }) => {
                const textLength = (node?.textContent || '').replace(/\\s+/g, ' ').trim().length
                const hasRichContent = Boolean(node?.querySelector('img, h2, h3, table, ul, ol, p'))
                const isDedicatedDescriptionSelector = /^#description-content|^\\.description-collapse/.test(selector)
                if (isDedicatedDescriptionSelector) return textLength > 0 || hasRichContent
                return textLength > 120 || hasRichContent
            })
            .map((entry) => entry.node)

        if (candidates.length === 0) return null
        return candidates.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0]
    }

    const findDescriptionCleanRoot = (root) => {
        if (!root) return null
        const selectors = [
            '#description-content .description-collapse',
            '.description-content .description-collapse',
            '.description-collapse.editor-content',
            '.description-collapse',
            '#description-content',
            '.description-content',
        ]

        for (const selector of selectors) {
            const candidate = root.matches?.(selector) ? root : root.querySelector(selector)
            const textLength = candidate ? (candidate.textContent || '').replace(/\\s+/g, ' ').trim().length : 0
            const hasRichContent = candidate ? Boolean(candidate.querySelector('img, h2, h3, table, ul, ol, p')) : false
            const isDedicatedDescriptionSelector = /^#description-content|^\\.description-collapse/.test(selector)
            if (candidate && ((isDedicatedDescriptionSelector && (textLength > 0 || hasRichContent)) || textLength > 120 || hasRichContent)) {
                return candidate
            }
        }

        return root
    }

    const cleanDescription = (root) => {
        if (!root) return { rawHtml: null, cleanHtml: null, issues: ['description_missing'] }

        const rawClone = root.cloneNode(true)
        materializeLazyImages(rawClone, [])
        for (const node of rawClone.querySelectorAll('script, style, noscript')) node.remove()

        const clone = root.cloneNode(true)
        const issues = []
        materializeLazyImages(clone, issues)
        for (const node of clone.querySelectorAll('script, style, noscript')) node.remove()

        for (const link of [...clone.querySelectorAll('a[href]')]) {
            const href = abs(link.getAttribute('href') || '')
            if (/hita\\.com\\.vn/i.test(href) && !/\\.pdf($|\\?)/i.test(href)) {
                issues.push(\`unwrapped_hita_link:\${href}\`)
                link.replaceWith(...link.childNodes)
            }
        }

        for (const node of [...clone.querySelectorAll('*')]) {
            for (const attr of [...node.attributes]) {
                if (/^data-sheets-/i.test(attr.name)) {
                    node.removeAttribute(attr.name)
                    issues.push(\`removed_sheets_metadata:\${attr.name}\`)
                }
            }
        }

        return {
            rawHtml: rawClone.innerHTML.trim() || null,
            cleanHtml: clone.innerHTML.trim() || null,
            issues,
        }
    }

    const root = findDescriptionRoot()
    const cleanRoot = findDescriptionCleanRoot(root)
    return cleanDescription(cleanRoot)
})()`

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function toDisplayValue(value: unknown) {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return value.map(toDisplayValue).filter(Boolean).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value).trim()
}

async function extractDescription(page: any, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    return page.evaluate((source) => eval(source), DESCRIPTION_EXTRACTOR_SOURCE)
}

async function main() {
    const run = await prisma.crawl_runs.findUnique({
        where: { id: RUN_ID },
        select: { input: true, source: true, brand_slug: true },
    })
    if (!run) throw new Error(`crawl_run ${RUN_ID} not found`)
    if (run.brand_slug !== BRAND) throw new Error(`crawl_run ${RUN_ID} brand mismatch: ${run.brand_slug}`)

    const sampleDir = toDisplayValue(asObject(run.input).sample_dir)
    const normalizedFile = sampleDir ? `${sampleDir}/sample-products.normalized.json` : ''
    if (!normalizedFile || !fs.existsSync(normalizedFile)) throw new Error(`normalized file not found: ${normalizedFile}`)

    const skuList = Object.keys(SKU_FIXES)
    const decisions = await prisma.crawl_import_decisions.findMany({
        where: {
            crawl_product_snapshots: {
                crawl_run_id: RUN_ID,
                source: run.source,
                sku: { in: skuList },
            },
        },
        include: { crawl_product_snapshots: true },
        orderBy: { id: 'asc' },
    })
    if (decisions.length !== skuList.length) throw new Error(`Expected ${skuList.length} decision rows, found ${decisions.length}`)

    const normalizedProducts = JSON.parse(fs.readFileSync(normalizedFile, 'utf8')) as Record<string, any>[]
    const normalizedBySku = new Map(normalizedProducts.map((row) => [toDisplayValue(row.sku), row]))

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    try {
        for (const decision of decisions) {
            const payload = asObject(decision.crawl_product_snapshots.normalized_payload)
            const sku = toDisplayValue(payload.sku)
            const fix = SKU_FIXES[sku]
            if (!fix) throw new Error(`Missing fix config for ${sku}`)

            const updatedPayload: Record<string, any> = {
                ...payload,
                qa: [],
            }

            if (fix.product_type) {
                updatedPayload.product_type = fix.product_type
                updatedPayload.product_sub_type = null
            }

            if (sku === 'LFV-5010S') {
                const extracted = await extractDescription(page, toDisplayValue(payload.source_url))
                if (!extracted.rawHtml || !extracted.cleanHtml) {
                    throw new Error(`LFV-5010S description extraction still missing`)
                }
                updatedPayload.description = extracted.cleanHtml
                updatedPayload.description_raw_html = extracted.rawHtml
                updatedPayload.description_clean_issues = extracted.issues
            }

            await prisma.crawl_product_snapshots.update({
                where: { id: decision.crawl_snapshot_id },
                data: {
                    normalized_payload: updatedPayload as Prisma.InputJsonValue,
                    qa_flags: [],
                },
            })

            await prisma.crawl_import_decisions.update({
                where: { id: decision.id },
                data: {
                    decision: 'approved',
                    reason: null,
                    import_payload: updatedPayload as Prisma.InputJsonValue,
                    import_result: Prisma.DbNull,
                },
            })

            const artifactRow = normalizedBySku.get(sku)
            if (artifactRow) Object.assign(artifactRow, updatedPayload)
        }
    } finally {
        await browser.close()
    }

    fs.writeFileSync(normalizedFile, `${JSON.stringify(normalizedProducts, null, 2)}\n`)

    console.log(JSON.stringify({
        run_id: RUN_ID,
        fixed_skus: skuList,
        sample_dir: sampleDir,
        approved_after_fix: skuList.length,
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
