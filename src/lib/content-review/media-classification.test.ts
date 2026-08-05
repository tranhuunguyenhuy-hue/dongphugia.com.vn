import { describe, expect, it } from 'vitest'
import { classifyMediaAsset, assertValidMediaClassification } from './media-classification'

function classify(sku: string, sourceId: string, host: 'Bunny CDN' | 'Hita' = 'Bunny CDN', fingerprint = `fingerprint-${sourceId}`) {
    return classifyMediaAsset({ sku, kind: sourceId === 'main' ? 'main' : 'gallery', sourceId, host, fingerprint })
}

describe('LEO-489 media visual classification v2.1', () => {
    it('matches the approved SFV-900SX golden case and propagates asset decisions', () => {
        const refs = [
            'main', ...Array.from({ length: 20 }, (_, index) => `gallery:${310870 + index}`), 'embedded:0', 'embedded:1', 'embedded:2',
        ]
        const fingerprints = new Map<string, string>([
            ['main', 'asset-main'], ['gallery:310870', 'asset-main'], ['gallery:310881', 'asset-2529'], ['gallery:310883', 'asset-b789'], ['gallery:310884', 'asset-2570'], ['embedded:0', 'asset-2570'], ['embedded:1', 'asset-b789'], ['embedded:2', 'asset-2529'],
        ])
        const decisions = refs.map(sourceId => classify('SFV-900SX', sourceId, 'Bunny CDN', fingerprints.get(sourceId)).action)
        expect(refs).toHaveLength(24)
        expect(new Set(refs.map(sourceId => fingerprints.get(sourceId) || `asset-${sourceId}`))).toHaveLength(20)
        expect(decisions.filter(value => value === 'REMOVE_CONFIRMED_HITA')).toHaveLength(10)
        expect(decisions.filter(value => value === 'REMOVE_UNVERIFIED_THIRD_PARTY')).toHaveLength(5)
        expect(classify('SFV-900SX', 'main').action).toBe('KEEP_VERIFIED')
        expect(classify('SFV-900SX', 'gallery:310881').action).toBe('KEEP_VERIFIED')
        expect(classify('SFV-900SX', 'gallery:310885').action).toBe('REMOVE_UNVERIFIED_THIRD_PARTY')
        expect(classify('SFV-900SX', 'gallery:310871').action).toBe('REMOVE_CONFIRMED_HITA')
    })

    it('fails closed for KEEP and preserves main-image safety', () => {
        const unknown = classify('UNVERIFIED-SKU', 'main')
        expect(unknown.action).toBe('REPLACE_WITH_OFFICIAL')
        expect(unknown.action).not.toBe('KEEP_VERIFIED')
        expect(classify('HITA-SKU', 'main', 'Hita').action).toBe('REPLACE_WITH_OFFICIAL')
        expect(() => assertValidMediaClassification({ ...unknown, action: 'KEEP_VERIFIED', origin: 'UNKNOWN', officialSourceVerification: 'NOT_VERIFIED' })).toThrow('KEEP_VERIFIED')
    })

    it('does not use host alone to keep Bunny assets and does not request any media', () => {
        const bunny = classify('UNVERIFIED-SKU', 'gallery:1', 'Bunny CDN')
        const hita = classify('UNVERIFIED-SKU', 'gallery:2', 'Hita')
        expect(bunny.action).not.toBe('KEEP_VERIFIED')
        expect(hita.action).toBe('REMOVE_CONFIRMED_HITA')
        expect(JSON.stringify({ bunny, hita })).not.toMatch(/https?:\/\//i)
    })
})
