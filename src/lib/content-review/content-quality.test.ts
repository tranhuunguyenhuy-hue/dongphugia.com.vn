import fs from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { describe, expect, it } from 'vitest'
import { getEditorialQualityMetrics } from './content-quality'
import { LEO_489_PILOT_MANIFEST } from './pilot-manifest'

function committedModel(): { products: Array<Record<string, unknown>>; manifestChecksum: string } {
    const html = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-dashboard.html'), 'utf8')
    const match = html.match(/const MODEL = (\{[\s\S]*?\});\nconst STORAGE_KEY/)
    if (!match) throw new Error('Committed dashboard model is missing')
    return JSON.parse(match[1]) as { products: Array<Record<string, unknown>>; manifestChecksum: string }
}

function topLevelStructure(html: string): string {
    const document = cheerio.load(`<root>${html}</root>`, {}, false)
    return document('root').children().toArray().map(node => node.tagName).join('>')
}

describe('LEO-489 editorial content audit', () => {
    it('covers the exact 20 manifest products and preserves the exact 160-media classification', () => {
        const model = committedModel()
        expect(model.products).toHaveLength(20)
        expect(model.products.map(product => product.sku)).toEqual([...LEO_489_PILOT_MANIFEST].sort((left, right) => left.id - right.id).map(entry => entry.sku))
        const media = model.products.flatMap(product => product.media as Array<Record<string, string>>)
        expect(media).toHaveLength(160)
        expect(media.filter(item => item.host === 'Hita' && item.decision === 'HUMAN_REVIEW')).toHaveLength(13)
        expect(media.filter(item => item.host === 'Bunny CDN' && item.decision === 'KEEP')).toHaveLength(147)
    })

    it('passes buyer-oriented quality checks, with sparse sources explicitly escalated', () => {
        const model = committedModel()
        const openings = new Set<string>()
        for (const product of model.products) {
            const afterHtml = String(product.afterHtml)
            const metrics = product.editorialQuality as {
                beforeCharacters: number
                afterCharacters: number
                ratio: number
                paragraphCount: number
                buyerBenefitSignals: number
                technicalTableDump: boolean
                repeatedOpeningKey: string
                shortSourceException: boolean
                flags: string[]
            }
            const permittedSparseException = metrics.shortSourceException
                && metrics.flags.length > 0
                && metrics.flags.every(flag => flag.startsWith('length_ratio_out_of_range'))
            expect(metrics.paragraphCount).toBeGreaterThanOrEqual(3)
            expect(metrics.buyerBenefitSignals).toBeGreaterThanOrEqual(2)
            expect(metrics.technicalTableDump).toBe(false)
            expect(afterHtml.toLocaleLowerCase()).toContain('chính hãng')
            expect(afterHtml).not.toMatch(/Thông tin nên đối chiếu|Thông tin đối chiếu/i)
            expect(metrics.flags.length === 0 || permittedSparseException).toBe(true)
            expect(product.editorialReview).toBe(permittedSparseException ? 'HUMAN_REVIEW' : 'PASS')
            if (permittedSparseException) expect(String(product.editorialReviewReason)).toMatch(/Sparse Before source/)
            expect(openings.has(metrics.repeatedOpeningKey)).toBe(false)
            openings.add(metrics.repeatedOpeningKey)
        }
    })

    it('detects dense label/value dumps inside paragraph markup', () => {
        const metrics = getEditorialQualityMetrics(
            '<p>Before text with enough context for the check.</p>',
            '<p>Sản phẩm chính hãng phù hợp cho gia đình.</p><p><strong>Thông tin:</strong> SKU: A; Chất liệu: B; Kích thước: C; Bảo hành: D</p><p>Kiểm tra vị trí trước khi lắp đặt.</p>',
        )
        expect(metrics.technicalTableDump).toBe(true)
        expect(metrics.flags).toContain('technical_table_dump')
    })

    it('keeps the four editorial checkpoint SKUs structurally distinct and places only safe media in context', () => {
        const model = committedModel()
        const checkpointSkus = ['SFV-900SX', 'MT5140', 'V93', 'A-SFV1013SX-1-1']
        const structures = new Set<string>()
        for (const sku of checkpointSkus) {
            const product = model.products.find(item => item.sku === sku)
            expect(product).toBeDefined()
            const afterHtml = String(product?.afterHtml)
            expect(afterHtml).not.toMatch(/Gợi ý chọn, lắp đặt và sử dụng/i)
            const headings = [...afterHtml.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]).join(' | ')
            structures.add(headings)
            const firstFigure = afterHtml.indexOf('<figure')
            expect(firstFigure).toBeGreaterThan(-1)
            expect(firstFigure).toBeLessThan(afterHtml.lastIndexOf('</p>'))
            const media = product?.media as Array<{ fingerprint: string; classification: { action: string } }>
            for (const item of media.filter(item => item.classification.action.startsWith('REMOVE_'))) {
                expect(afterHtml).not.toContain(item.fingerprint)
            }
        }
        expect(structures.size).toBe(4)
    })

    it('catches a universal closing and excessive structural concentration without a similarity gate', () => {
        const model = committedModel()
        const afterHtml = model.products.map(product => String(product.afterHtml))
        expect(afterHtml.filter(html => /Gợi ý chọn, lắp đặt và sử dụng/i.test(html))).toHaveLength(0)

        const structureCounts = new Map<string, number>()
        for (const html of afterHtml) {
            const signature = topLevelStructure(html)
            structureCounts.set(signature, (structureCounts.get(signature) || 0) + 1)
        }
        expect(Math.max(...structureCounts.values())).toBeLessThanOrEqual(3)
    })

    it('keeps every REMOVE media reference out of all 20 After descriptions and links safe placements to media decisions', () => {
        const model = committedModel()
        for (const product of model.products) {
            const afterHtml = String(product.afterHtml)
            const media = product.media as Array<{ sourceId: string; fingerprint: string; classification: { action: string } }>
            const bySourceId = new Map(media.map(item => [item.sourceId, item.classification.action]))
            const byFingerprint = new Map(media.map(item => [item.fingerprint, item.classification.action]))
            for (const item of media.filter(item => item.classification.action.startsWith('REMOVE_'))) {
                expect(afterHtml).not.toContain(item.fingerprint)
            }
            const placedSourceIds = [...afterHtml.matchAll(/data-media-source-id="([^"]+)"/g)].map(match => match[1])
            for (const sourceId of placedSourceIds) {
                expect(bySourceId.get(sourceId)).not.toMatch(/^REMOVE_/)
            }
            const placedFingerprints = [...afterHtml.matchAll(/data-media-fingerprint="([a-f0-9]{64})"/g)].map(match => match[1])
            for (const fingerprint of placedFingerprints) {
                expect(byFingerprint.get(fingerprint)).not.toMatch(/^REMOVE_/)
            }
        }
    })

    it('keeps the committed artifact sanitized and offline-only', () => {
        const html = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-dashboard.html'), 'utf8')
        expect(html).not.toMatch(/cdn\.hita\.com\.vn|cdn\.dongphugia\.com\.vn|www\.dongphugia\.vn/i)
        expect(html).not.toMatch(/<img\b[^>]*\bsrc=|<script\b[^>]*\bsrc=/i)
        expect(html).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|\/api\/|prisma|DATABASE_URL|BUNNY_STORAGE_API_KEY/i)
        expect(html).not.toMatch(/<a\b[^>]*href=/i)
    })
})
