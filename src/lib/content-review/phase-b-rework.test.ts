import { describe, expect, it } from 'vitest'
import {
    PHASE_B_REWORK_SIZE,
    buildReworkCheckpointPackage,
    buildReworkDeterministicExport,
    buildReworkRecords,
    assertReworkCheckpointBinding,
    createReworkDashboardModel,
    selectReworkProducts,
} from './phase-b-rework'
import { renderPhaseBReworkDashboardHtml } from './phase-b-rework-dashboard'
import type { PhaseBProductSnapshot } from './phase-b'

function fixtureProducts(): PhaseBProductSnapshot[] {
    const sanitary = Array.from({ length: 20 }, (_, index) => product(index + 1, `S-${String(index + 1).padStart(2, '0')}`, 'thiet-bi-ve-sinh', index === 0))
    return [
        ...sanitary,
        product(21, '61-1361-VN', 'thiet-bi-bep'),
        product(22, 'K-1', 'thiet-bi-bep'),
        product(23, 'K-2', 'thiet-bi-bep'),
        product(24, '355SD/CMG-1B', 'gach-op-lat'),
    ]
}

function product(id: number, sku: string, categorySlug: string, duplicateGallery = false): PhaseBProductSnapshot {
    const media: PhaseBProductSnapshot['media'] = [{ kind: 'main' as const, sourceId: 'main', url: `https://cdn.dongphugia.com.vn/${id}.webp`, fingerprint: `fp-${id}`, host: 'Bunny CDN' as const }]
    if (duplicateGallery) {
        media.push({ kind: 'gallery' as const, sourceId: 'gallery:1', url: `https://cdn.dongphugia.com.vn/${id}.webp`, fingerprint: `fp-${id}`, host: 'Bunny CDN' as const })
        media.push({ kind: 'gallery' as const, sourceId: 'gallery:2', url: `https://cdn.dongphugia.com.vn/${id}-other.webp`, fingerprint: `fp-${id}-other`, host: 'Bunny CDN' as const })
    }
    return {
        id,
        sku,
        name: `Sản phẩm ${sku}`,
        brand: { id: 1, name: 'INAX', slug: 'inax' },
        category: { id, name: categorySlug, slug: categorySlug },
        updatedAt: '2026-08-05T00:00:00.000Z',
        descriptionHtml: `<p>${sku} có thông tin kích thước và cách dùng được ghi trong hồ sơ sản phẩm. Người mua nên đối chiếu trước khi lắp đặt và vệ sinh.</p>`,
        media,
    }
}

describe('LEO-493 Phase B rework checkpoint', () => {
    it('selects exactly 24 deterministic products with accepted overlap and category coverage', () => {
        const selected = selectReworkProducts(fixtureProducts())
        expect(selected).toHaveLength(PHASE_B_REWORK_SIZE)
        expect(selected.map(item => item.sku)).toContain('61-1361-VN')
        expect(selected.map(item => item.sku)).toContain('355SD/CMG-1B')
        expect(new Set(selected.map(item => item.sku)).size).toBe(24)
    })

    it('uses varied product-specific structures and separates pending media from the manual holdout', () => {
        const { records, manualHoldout } = buildReworkRecords(fixtureProducts(), new Map())
        expect(new Set(records.map(record => record.narrativeFamily)).size).toBeGreaterThanOrEqual(8)
        expect(new Set(records.map(record => record.structure.openingKey)).size).toBeGreaterThanOrEqual(20)
        expect(records.every(record => record.holdoutStatus === 'MANUALLY_REVIEWED')).toBe(true)
        expect(manualHoldout).toHaveLength(24)
        const pending = records.flatMap(record => record.media).filter(media => !media.manuallyReviewed)
        expect(pending.some(media => media.currentDecision === 'KEEP_TEMPORARY')).toBe(true)
        expect(pending.some(media => media.currentDecision === 'KEEP_PRODUCT')).toBe(false)
        expect(records.flatMap(record => record.media).some(media => media.kind === 'embedded' && media.placement === 'AFTER_INLINE')).toBe(false)
    })

    it('binds policy, snapshot, proposal, holdout and package hashes and rejects stale values', () => {
        const { records, manualHoldout } = buildReworkRecords(fixtureProducts(), new Map())
        const value = buildReworkCheckpointPackage(records, manualHoldout, 'policy', 'snapshot', 'commit', [])
        expect(() => assertReworkCheckpointBinding(value, 'policy', 'snapshot')).not.toThrow()
        expect(() => assertReworkCheckpointBinding({ ...value, sourceCommit: 'stale' }, 'policy', 'snapshot')).toThrow('proposal binding is stale')
        const model = createReworkDashboardModel(value, 'public')
        const exported = buildReworkDeterministicExport(model)
        expect(exported).toBe(buildReworkDeterministicExport(model))
        expect(exported).toContain('"policyHash": "policy"')
    })

    it('renders default Media Review, simple filters, technical disclosure, content modes and sanitized public media', () => {
        const { records, manualHoldout } = buildReworkRecords(fixtureProducts(), new Map())
        const value = buildReworkCheckpointPackage(records, manualHoldout, 'policy', 'snapshot', 'commit', [])
        const publicModel = createReworkDashboardModel(value, 'public')
        const privateModel = createReworkDashboardModel(value, 'private')
        const publicHtml = renderPhaseBReworkDashboardHtml(publicModel, 'public')
        const privateHtml = renderPhaseBReworkDashboardHtml(privateModel, 'private')
        expect(publicHtml).toContain('Media Review')
        expect(publicHtml).toContain('Chi tiết kỹ thuật')
        expect(publicHtml).toContain('Public artifact đã che URL media')
        expect(publicHtml).not.toContain('cdn.dongphugia.com.vn')
        expect(privateHtml).toContain('cdn.dongphugia.com.vn')
        expect(privateHtml).toContain('Hita chỉ mở thủ công')
    })
})
