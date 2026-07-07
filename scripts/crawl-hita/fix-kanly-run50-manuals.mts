import fs from 'node:fs'
import { chromium } from 'playwright'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RUN_ID = 50
const BRAND = 'kanly'
const TARGET_SKUS = ['CHK033', 'CHK04', 'CHK05', 'CHK08', 'CHS13', 'CHS16', 'CHS17', 'GCS24B']
const DESCRIPTION_EXTRACTOR_SOURCE = `(() => {
    const abs = (value) => {
        if (!value) return ''
        try {
            return new URL(value, 'https://hita.com.vn').href
        } catch {
            return value
        }
    }

    const ownText = (node) => {
        if (!node) return ''
        return [...node.childNodes]
            .filter((child) => child.nodeType === Node.TEXT_NODE)
            .map((child) => child.textContent || '')
            .join(' ')
            .replace(/\\s+/g, ' ')
            .trim()
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
    const result = cleanDescription(cleanRoot)
    return {
        ...result,
        ownText: ownText(cleanRoot),
    }
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

function removeMissingDescriptionFlags(flags: unknown[]) {
    return flags
        .map(item => toDisplayValue(item))
        .filter(Boolean)
        .filter(item => !['missing_description_raw_html', 'missing_description_clean_html'].includes(item))
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

    const input = asObject(run.input)
    const sampleDir = toDisplayValue(input.sample_dir)
    const normalizedFile = sampleDir ? `${sampleDir}/sample-products.normalized.json` : ''
    if (!normalizedFile || !fs.existsSync(normalizedFile)) {
        throw new Error(`normalized file not found for run ${RUN_ID}: ${normalizedFile}`)
    }

    const decisions = await prisma.crawl_import_decisions.findMany({
        where: {
            decision: 'needs_manual_review',
            crawl_product_snapshots: {
                crawl_run_id: RUN_ID,
                source: run.source,
                sku: { in: TARGET_SKUS },
            },
        },
        include: { crawl_product_snapshots: true },
        orderBy: { id: 'asc' },
    })
    if (decisions.length !== TARGET_SKUS.length) {
        throw new Error(`Expected ${TARGET_SKUS.length} decisions, found ${decisions.length}`)
    }

    const normalizedProducts = JSON.parse(fs.readFileSync(normalizedFile, 'utf8')) as Record<string, any>[]
    const normalizedBySku = new Map(normalizedProducts.map((product) => [toDisplayValue(product.sku), product]))

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    const fixes: Array<{ sku: string; rawHtml: string | null; cleanHtml: string | null; issues: string[]; ownText: string }> = []

    try {
        for (const decision of decisions) {
            const payload = asObject(decision.crawl_product_snapshots.normalized_payload)
            const sku = toDisplayValue(payload.sku)
            const sourceUrl = toDisplayValue(payload.source_url)
            const extracted = await extractDescription(page, sourceUrl)
            fixes.push({
                sku,
                rawHtml: extracted.rawHtml,
                cleanHtml: extracted.cleanHtml,
                issues: extracted.issues,
                ownText: extracted.ownText,
            })
        }
    } finally {
        await browser.close()
    }

    for (const fix of fixes) {
        if (!fix.rawHtml || !fix.cleanHtml) {
            throw new Error(`Description extraction still missing for ${fix.sku}`)
        }
    }

    for (const decision of decisions) {
        const payload = asObject(decision.crawl_product_snapshots.normalized_payload)
        const sku = toDisplayValue(payload.sku)
        const fix = fixes.find((item) => item.sku === sku)
        if (!fix) throw new Error(`Missing fix for ${sku}`)

        const updatedPayload = {
            ...payload,
            description: fix.cleanHtml,
            description_raw_html: fix.rawHtml,
            description_clean_issues: fix.issues,
            qa: removeMissingDescriptionFlags(Array.isArray(payload.qa) ? payload.qa : []),
        }

        await prisma.crawl_product_snapshots.update({
            where: { id: decision.crawl_snapshot_id },
            data: {
                normalized_payload: updatedPayload as Prisma.InputJsonValue,
                qa_flags: removeMissingDescriptionFlags(Array.isArray(decision.crawl_product_snapshots.qa_flags) ? decision.crawl_product_snapshots.qa_flags as unknown[] : []),
            },
        })

        await prisma.crawl_import_decisions.update({
            where: { id: decision.id },
            data: {
                reason: removeMissingDescriptionFlags(toDisplayValue(decision.reason).split(',').map((item) => item.trim()).filter(Boolean)).join(',') || null,
                import_payload: updatedPayload as Prisma.InputJsonValue,
            },
        })

        const artifactRow = normalizedBySku.get(sku)
        if (artifactRow) {
            artifactRow.description = fix.cleanHtml
            artifactRow.description_raw_html = fix.rawHtml
            artifactRow.description_clean_issues = fix.issues
            artifactRow.qa = removeMissingDescriptionFlags(Array.isArray(artifactRow.qa) ? artifactRow.qa : [])
        }
    }

    fs.writeFileSync(normalizedFile, `${JSON.stringify(normalizedProducts, null, 2)}\n`)

    console.log(JSON.stringify({
        run_id: RUN_ID,
        fixed_skus: fixes.map((item) => item.sku),
        sample_dir: sampleDir,
        summary: fixes.map((item) => ({
            sku: item.sku,
            own_text_length: item.ownText.length,
            clean_issue_count: item.issues.length,
        })),
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
