import { describe, expect, it } from 'vitest'
import { buildPhaseDRecords, type PhaseDCohortProduct, type PhaseDSourceProduct } from './phase-d-checkpoint'

function source(): PhaseDSourceProduct {
    return {
        id: 10,
        sku: 'TEST-TOILET-10',
        name: 'Bồn cầu thử nghiệm',
        description: '<p>Thiết kế phù hợp không gian phòng tắm gia đình.</p><h2>Thông tin</h2><ul><li>Kích thước 680 mm</li><li>Vật liệu sứ</li></ul><p><img src="https://cdn.dongphugia.com.vn/test/technical.png" alt="Bản vẽ"></p>',
        features: null,
        specs: { kích_thước: '680 mm', vật_liệu: 'sứ' },
        updated_at: '2026-08-06T00:00:00.000Z',
        image_main_url: 'https://cdn.dongphugia.com.vn/test/packshot.png',
        brands: { id: 1, name: 'TOTO', slug: 'toto' },
        categories: { id: 1, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
        product_images: [],
    }
}

function cohort(): PhaseDCohortProduct {
    return { id: 10, sku: 'TEST-TOILET-10', name: 'Bồn cầu thử nghiệm', brand: { id: 1, name: 'TOTO', slug: 'toto' }, category: { id: 1, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' }, family: 'TOILET', descriptionHash: 'hash' }
}

describe('Phase D checkpoint generation', () => {
    it('keeps existing embedded assets inline and generates a grounded, non-empty narrative', () => {
        const [record] = buildPhaseDRecords([source()], [cohort()], 'worker-test')
        expect(record.generatedHtml).toContain('TEST-TOILET-10')
        expect(record.generatedHtml).toContain('chính hãng')
        expect(record.generatedHtml.match(/<img\b/gi)).toHaveLength(1)
        expect(record.media.filter(item => item.kind === 'embedded')).toHaveLength(1)
        expect(record.media.find(item => item.kind === 'embedded')?.placement).toBe('AFTER_INLINE')
        expect(record.generatedHtml).not.toMatch(/REPLACE_WITH_OFFICIAL|hita\.com\.vn/i)
        expect(record.editorial.ratio).toBeGreaterThan(0)
        expect(record.editorialStatus).toBe('HUMAN_REVIEW')
    })
})
