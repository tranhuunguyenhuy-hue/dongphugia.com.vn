import { describe, expect, it } from 'vitest'
import { deriveSemanticVariantLabel, getPreferredVariantLabel } from '@/lib/variant-labels'

describe('variant labels', () => {
    it('derives richer labels for MT5140 bath variants', () => {
        expect(deriveSemanticVariantLabel('Bồn tắm xây đặt góc 1m4 massage Caesar MT5140A', 'MT5140A')).toBe('Chân yếm, Massage')
        expect(deriveSemanticVariantLabel('Bồn tắm chân yếm đặt góc 1m4 Caesar AT5140A', 'AT5140A')).toBe('Chân yếm')
    })

    it('derives semantic labels for CS988 variants', () => {
        expect(deriveSemanticVariantLabel('Bồn cầu thông minh Neorest TOTO CS988PVT', 'CS988PVT#NW1/TCF9575Z#NW1')).toBe('Neorest DH (Thoát ngang)')
        expect(deriveSemanticVariantLabel('Bồn cầu thông minh Neorest TOTO CS988VT kèm TCF9575Z (T53P100VR)', 'CS988VT#NW1/TCF9575Z#NW1/T53P100VR')).toBe('Neorest DH (Thoát sàn)')
    })

    it('prefers inferred labels when explicit labels are suspicious', () => {
        expect(getPreferredVariantLabel({
            explicitLabel: 'Bồn xây',
            name: 'Bồn tắm xây đặt góc 1m4 massage Caesar MT5140A',
            sku: 'MT5140A',
        })).toBe('Chân yếm, Massage')

        expect(getPreferredVariantLabel({
            explicitLabel: 'Nắp điện tử C9201',
            name: 'Nắp rửa điện tử COTTO C9204',
            sku: 'C9204',
        })).toBe('Nắp điện tử C9204')
    })

    it('falls back to explicit labels when they are already valid', () => {
        expect(getPreferredVariantLabel({
            explicitLabel: 'Nắp điện tử KB22',
            name: 'Bồn cầu 1 khối nắp điện tử INAX AC-902 + CW-KB22AVN',
            sku: 'AC-902+CW-KB22AVN/BW1',
        })).toBe('Nắp điện tử KB22')
    })
})
