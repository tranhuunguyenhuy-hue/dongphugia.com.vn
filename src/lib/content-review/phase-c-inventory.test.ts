import { describe, expect, it } from 'vitest'
import { assertPhaseCInventoryBinding, classifyInventory, classifyPhaseCProduct, descriptionLengthBucket, mediaRisk } from './phase-c-inventory'

function product(overrides: Partial<Parameters<typeof classifyPhaseCProduct>[0]> = {}) {
    return {
        id: 1,
        sku: 'TEST-1',
        name: 'Bồn cầu một khối cao cấp',
        brand: { id: 1, name: 'INAX', slug: 'inax' },
        category: { id: 1, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
        updatedAt: '2026-08-06T00:00:00.000Z',
        descriptionHash: 'a'.repeat(64),
        visibleLength: 600,
        media: [{ kind: 'embedded' as const, sourceId: 'embedded:0', fingerprint: 'b'.repeat(64), host: 'Bunny CDN' as const }],
        ...overrides,
    }
}

describe('Phase C inventory gating', () => {
    it('requires both source evidence gates for rewrite', () => {
        expect(classifyPhaseCProduct(product()).gate).toBe('REWRITE_IMPORTANT')
        expect(classifyPhaseCProduct(product({ visibleLength: 499 })).gate).toBe('CONTENT_REVIEW_CANDIDATE')
        expect(classifyPhaseCProduct(product({ media: [] })).gate).toBe('CONTENT_REVIEW_CANDIDATE')
        expect(classifyPhaseCProduct(product({ visibleLength: 499, media: [] })).gate).toBe('KEEP_EXISTING_CONTENT')
    })

    it('excludes explicit mounting/accessory components even when product terms match', () => {
        const row = product({ name: 'Đế lắp đặt bồn cầu treo tường' })
        const result = classifyPhaseCProduct(row)
        expect(result.gate).toBe('KEEP_EXISTING_CONTENT')
        expect(result.reasonCodes).toContain('MOUNTING_OR_INSTALLATION_COMPONENT')
    })

    it('keeps a complete toilet seat in its own approved family', () => {
        const result = classifyPhaseCProduct(product({ name: 'Nắp bồn cầu điện tử', sku: 'SEAT-1' }))
        expect(result.family).toBe('TOILET_SEAT')
        expect(result.gate).toBe('REWRITE_IMPORTANT')
    })

    it('keeps sparse important products and outside-family products', () => {
        expect(classifyPhaseCProduct(product({ name: 'Lavabo tròn', visibleLength: 120, media: [] })).gate).toBe('KEEP_EXISTING_CONTENT')
        expect(classifyPhaseCProduct(product({ name: 'Vòi chậu rửa mặt', visibleLength: 900 })).gate).toBe('KEEP_EXISTING_CONTENT')
    })

    it('blocks missing and duplicate raw SKU instead of guessing identity', () => {
        const missing = classifyPhaseCProduct(product({ sku: null }))
        expect(missing.gate).toBe('CONTENT_REVIEW_CANDIDATE')
        expect(missing.blocker).toBe('MISSING_RAW_SKU')
        const duplicate = classifyInventory([product(), product({ id: 2, sku: 'TEST-1' })])
        expect(duplicate.every((row) => row.classification.blocker === 'DUPLICATE_RAW_SKU')).toBe(true)
    })

    it('uses deterministic length buckets and media risk', () => {
        expect(descriptionLengthBucket(0)).toBe('0')
        expect(descriptionLengthBucket(499)).toBe('300_499')
        expect(descriptionLengthBucket(500)).toBe('500_999')
        expect(mediaRisk([])).toBe('NO_MEDIA')
        expect(mediaRisk([{ kind: 'main', sourceId: 'main', fingerprint: 'a', host: 'Bunny CDN' }])).toBe('BUNNY_ONLY')
        expect(mediaRisk([{ kind: 'main', sourceId: 'main', fingerprint: 'a', host: 'Bunny CDN' }, { kind: 'gallery', sourceId: 'gallery:1', fingerprint: 'b', host: 'Hita' }])).toBe('MIXED')
    })

    it('fails closed on stale inventory binding', () => {
        const binding = { policyHash: 'policy', snapshotHash: 'snapshot', proposalHash: null, sourceCommit: 'commit', bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL' as const }
        expect(() => assertPhaseCInventoryBinding(binding, { policyHash: 'policy', snapshotHash: 'snapshot', sourceCommit: 'commit', bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL' })).not.toThrow()
        expect(() => assertPhaseCInventoryBinding(binding, { policyHash: 'stale', snapshotHash: 'snapshot', sourceCommit: 'commit', bindingStatus: 'INVENTORY_ONLY_NO_PROPOSAL' })).toThrow('Stale or invalid')
    })
})
