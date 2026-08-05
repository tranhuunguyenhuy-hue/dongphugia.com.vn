import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEO_489_PILOT_MANIFEST } from './pilot-manifest'

function committedModel(): { products: Array<Record<string, unknown>>; manifestChecksum: string } {
    const html = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-dashboard.html'), 'utf8')
    const match = html.match(/const MODEL = (\{[\s\S]*?\});\nconst STORAGE_KEY/)
    if (!match) throw new Error('Committed dashboard model is missing')
    return JSON.parse(match[1]) as { products: Array<Record<string, unknown>>; manifestChecksum: string }
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
            expect(metrics.flags.length === 0 || permittedSparseException).toBe(true)
            expect(product.editorialReview).toBe(permittedSparseException ? 'HUMAN_REVIEW' : 'PASS')
            if (permittedSparseException) expect(String(product.editorialReviewReason)).toMatch(/Sparse Before source/)
            expect(openings.has(metrics.repeatedOpeningKey)).toBe(false)
            openings.add(metrics.repeatedOpeningKey)
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
