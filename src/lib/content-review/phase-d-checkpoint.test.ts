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
        expect(record.generatedHtml).not.toMatch(/\.\.\.|…/u)
        expect(record.semanticFlags).toEqual([])
        expect(record.generatedHtml).not.toMatch(/\b(?:documents|name|type)\b|Dữ liệu liên quan|Mã sản phẩm/iu)
        expect(record.generatedHtml.match(/<h[23]\b/gi)).toHaveLength(record.generatedHtml.match(/<p\b/gi)?.length ?? 0)
        expect([...record.generatedHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].every(match => match[1].replace(/<[^>]+>/g, '').trim().length >= 70)).toBe(true)
        expect(record.editorial.ratio).toBeGreaterThan(0)
        expect(record.editorialStatus).toBe('HUMAN_REVIEW')
    })

    it('filters unsupported commercial source claims without removing the buyer positioning', () => {
        const candidate = source()
        candidate.description = '<p>Giá bán và chiết khấu cần được xác nhận riêng trước khi người mua quyết định chọn sản phẩm này.</p><p>Thiết kế phù hợp không gian phòng tắm gia đình.</p>'
        const [record] = buildPhaseDRecords([candidate], [cohort()], 'worker-test')
        expect(record.removedUnsupportedClaimCount).toBe(1)
        expect(record.generatedHtml).toContain('chính hãng')
        expect(record.generatedHtml).not.toMatch(/giá bán|chiết khấu/iu)
    })

    it('hard-fails parser metadata and malformed source fragments instead of emitting them', () => {
        const candidate = source()
        candidate.description = '<p>documents name type Dữ liệu liên quan</p><p>Công nghệ men phủ giúp bề mặt dễ lau chùi trong sử dụng hằng ngày.</p>'
        const [record] = buildPhaseDRecords([candidate], [cohort()], 'worker-test')
        expect(record.semanticFlags).toEqual([])
        expect(record.generatedHtml).not.toMatch(/documents|Dữ liệu liên quan/iu)
        expect(record.generatedHtml).not.toMatch(/<h[23][^>]*>Từ\s+\S+/iu)
    })
})
