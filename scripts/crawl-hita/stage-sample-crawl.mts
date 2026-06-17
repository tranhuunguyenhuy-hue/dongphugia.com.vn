import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const brand = readArg('--brand=', 'caesar')
const source = readArg('--source=', 'hita-sample')
const sampleDir = readArg('--sample-dir=', path.resolve(process.cwd(), `scripts/crawl-hita/output/${brand}/sample`))
const execute = args.includes('--execute')

function readArg(prefix: string, fallback: string) {
    const arg = args.find(item => item.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : fallback
}

function readJsonFile<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function hashPayload(payload: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function asString(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function isBlockingDescriptionIssue(issue: unknown) {
    const value = asString(issue)
    if (!value) return false
    return !/^(rewrote_lazy_image|unwrapped_hita_link|needs_cdn_rewrite):/i.test(value)
}

function decideImport(product: any) {
    const reasons: string[] = []
    const qaFlags = Array.isArray(product?.qa) ? product.qa.map(String) : []

    if (!asString(product?.sku)) reasons.push('missing_sku')
    if (!asString(product?.name)) reasons.push('missing_name')
    if (!asString(product?.slug)) reasons.push('missing_slug')
    if (!asString(product?.subcategory_id)) reasons.push('missing_subcategory')
    if (!asString(product?.image_main_url)) reasons.push('missing_real_image')

    if (reasons.length > 0) {
        return {
            snapshotStatus: 'skipped',
            decision: 'skipped',
            reason: reasons.join(','),
            qaFlags: [...qaFlags, ...reasons],
        }
    }

    const quarantine: string[] = []
    if (!asString(product?.product_type)) quarantine.push('low_taxonomy_confidence')
    if (asString(product?.variant_group) && !asString(product?.variant_type)) quarantine.push('variant_group_missing_type')
    const blockingDescriptionIssues = Array.isArray(product?.description_clean_issues)
        ? product.description_clean_issues.filter(isBlockingDescriptionIssue)
        : []
    if (blockingDescriptionIssues.length > 8) {
        quarantine.push('description_many_clean_issues')
    }

    if (quarantine.length > 0) {
        return {
            snapshotStatus: 'quarantine',
            decision: 'quarantine',
            reason: quarantine.join(','),
            qaFlags: [...qaFlags, ...quarantine],
        }
    }

    return {
        snapshotStatus: 'crawled',
        decision: qaFlags.length > 0 ? 'needs_manual_review' : 'approved',
        reason: qaFlags.join(',') || null,
        qaFlags,
    }
}

async function main() {
    const normalizedFile = path.join(sampleDir, 'sample-products.normalized.json')
    const rawFile = path.join(sampleDir, 'sample-products.raw.json')

    const normalizedProducts = readJsonFile<any[]>(normalizedFile, [])
    const rawProducts = readJsonFile<any[]>(rawFile, [])
    const rawByUrl = new Map(rawProducts.map(product => [asString(product.source_url || product.url), product]))

    if (normalizedProducts.length === 0) {
        throw new Error(`No normalized products found at ${normalizedFile}`)
    }

    const decisions = normalizedProducts.map(product => decideImport(product))
    const summary = {
        products: normalizedProducts.length,
        approved: decisions.filter(item => item.decision === 'approved').length,
        quarantine: decisions.filter(item => item.decision === 'quarantine').length,
        skipped: decisions.filter(item => item.decision === 'skipped').length,
        needs_manual_review: decisions.filter(item => item.decision === 'needs_manual_review').length,
    }

    if (!execute) {
        console.log('[dry-run] Would create crawl_run and snapshots')
        console.log(JSON.stringify({ brand, source, sampleDir, summary }, null, 2))
        return
    }

    const run = await prisma.crawl_runs.create({
        data: {
            source,
            brand_slug: brand,
            status: 'running',
            input: {
                sample_dir: sampleDir,
                normalized_file: normalizedFile,
                raw_file: fs.existsSync(rawFile) ? rawFile : null,
            } as Prisma.InputJsonValue,
        },
    })

    for (const [index, product] of normalizedProducts.entries()) {
        const decision = decisions[index]
        const sourceUrl = asString(product.source_url)
        const rawPayload = rawByUrl.get(sourceUrl) || product

        const snapshot = await prisma.crawl_product_snapshots.create({
            data: {
                crawl_run_id: run.id,
                source,
                source_url: sourceUrl || `sample://${brand}/${product.sku || index}`,
                source_product_id: product.hita_product_id ? String(product.hita_product_id) : null,
                brand_slug: product.brand_slug || brand,
                sku: product.sku || null,
                raw_payload: rawPayload as Prisma.InputJsonValue,
                normalized_payload: product as Prisma.InputJsonValue,
                content_hash: hashPayload(product),
                status: decision.snapshotStatus,
                skipped_reason: decision.decision === 'skipped' ? decision.reason : null,
                qa_flags: decision.qaFlags,
            },
        })

        await prisma.crawl_import_decisions.create({
            data: {
                crawl_snapshot_id: snapshot.id,
                decision: decision.decision,
                reason: decision.reason,
                taxonomy_confidence: product.product_type ? 'high' : 'low',
                price_confidence: product.price || product.price_display ? 'medium' : 'low',
                media_confidence: product.image_main_url ? 'high' : 'low',
                specs_confidence: product.specs && Object.keys(product.specs).length > 0 ? 'medium' : 'low',
                import_payload: product as Prisma.InputJsonValue,
            },
        })
    }

    await prisma.crawl_runs.update({
        where: { id: run.id },
        data: {
            status: 'completed',
            finished_at: new Date(),
            summary: summary as Prisma.InputJsonValue,
        },
    })

    console.log(JSON.stringify({ crawl_run_id: run.id, summary }, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
