import { describe, expect, it } from 'vitest'
import {
    PHASE_B_HOLDOUT_SIZE,
    assertPhaseBPackageBinding,
    buildPhaseBDeterministicExport,
    buildPhaseBPackage,
    buildPhaseBRecords,
    createPhaseBDashboardModel,
    type PhaseBProductSnapshot,
} from './phase-b'
import { renderPhaseBDashboardHtml } from './phase-b-dashboard'

function product(id: number, embedded = false): PhaseBProductSnapshot {
    const media = [
        { kind: 'main' as const, sourceId: 'main', url: `https://cdn.b-cdn.net/${id}/main.jpg`, fingerprint: `main-${id}`, host: 'Bunny CDN' as const },
        ...(embedded ? [{ kind: 'embedded' as const, sourceId: 'embedded:0', url: `https://cdn.b-cdn.net/${id}/diagram.jpg`, fingerprint: `diagram-${id}`, host: 'Bunny CDN' as const }] : []),
    ]
    return {
        id,
        sku: `INAX-TEST-${id}`,
        name: `Sản phẩm thử ${id}`,
        brand: { id: 1, name: 'INAX', slug: 'inax' },
        category: { id: 2, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
        updatedAt: '2026-08-05T00:00:00.000Z',
        descriptionHtml: `<p>Mô tả hiện có cho sản phẩm ${id} với thông tin sử dụng và lắp đặt.</p>`,
        media,
    }
}

describe('LEO-493 Phase B deterministic proposal contract', () => {
    it('keeps existing embedded assets contextual and never introduces replacement placeholders', () => {
        const record = buildPhaseBRecords([product(1, true)], new Map())[0]
        expect(record.generatedHtml).toContain('INAX-TEST-1')
        expect(record.generatedHtml).not.toContain('REPLACE_WITH_OFFICIAL')
        expect(record.media.find(media => media.kind === 'embedded')).toMatchObject({ placement: 'AFTER_INLINE', currentDecision: 'KEEP_TECHNICAL' })
        expect(record.generatedHtml).toContain('diagram.jpg')
    })

    it('binds the complete 240-product package and rejects stale proposal hashes', () => {
        const records = buildPhaseBRecords(Array.from({ length: 240 }, (_, index) => product(index + 1)), new Map())
        const packageValue = buildPhaseBPackage(records, 'policy-test', 'snapshot-test', 'source-test')
        expect(packageValue.records).toHaveLength(240)
        expect(packageValue.counts.holdout).toBe(PHASE_B_HOLDOUT_SIZE)
        expect(() => assertPhaseBPackageBinding(packageValue, 'policy-test', 'snapshot-test')).not.toThrow()
        const stale = { ...packageValue, proposalHash: 'stale' }
        expect(() => assertPhaseBPackageBinding(stale, 'policy-test', 'snapshot-test')).toThrow('binding is stale')
    })

    it('renders a scalable default Media Review and sanitized public artifact', () => {
        const records = buildPhaseBRecords(Array.from({ length: 240 }, (_, index) => product(index + 1)), new Map())
        const packageValue = buildPhaseBPackage(records, 'policy-test', 'snapshot-test', 'source-test')
        const model = createPhaseBDashboardModel(packageValue, 'public')
        const html = renderPhaseBDashboardHtml(model, 'public')
        expect(model.products).toHaveLength(240)
        expect(html).toContain('Media Review')
        expect(html).toContain('Import JSON')
        expect(html).toContain('page=1')
        expect(html).toContain('manual-load')
        expect(html).not.toContain('fetch(')
        expect(html).not.toContain('https://cdn.b-cdn.net')
        expect(html).not.toContain('REPLACE_WITH_OFFICIAL')
        expect(buildPhaseBDeterministicExport(model)).toBe(buildPhaseBDeterministicExport(model))
    })
})
