import { describe, expect, it } from 'vitest'
import { PHASE_D_CHECKPOINT_QUOTAS, PHASE_D_FAMILY_QUOTAS, phaseDSelectionHash, selectPhaseDCohort, type PhaseDInventoryRow } from './phase-d-selection'

function row(id: number, family: PhaseDInventoryRow['classification']['family'], brand: string, descriptionHash = `hash-${id}`): PhaseDInventoryRow {
    return {
        id, sku: `${brand}-${id}`, name: `${family}-${id}`, brand: { id, name: brand, slug: brand }, category: { id, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' }, updatedAt: '2026-08-06T00:00:00.000Z', descriptionHash, visibleLength: 800 - id, media: [{ kind: 'embedded', sourceId: `embedded:${id}`, fingerprint: `fingerprint-${id}`, host: 'Bunny CDN' }], classification: { gate: 'REWRITE_IMPORTANT', family, reasonCodes: [], blocker: null, embeddedCount: 1, mediaRisk: 'BUNNY_ONLY' },
    }
}

describe('Phase D deterministic cohort selection', () => {
    it('selects exact family quotas and excludes non-rewrite rows', () => {
        const rows = [
            ...Array.from({ length: 6 }, (_, index) => row(index + 1, 'TOILET', index % 2 ? 'toto' : 'inax')),
            ...Array.from({ length: 3 }, (_, index) => row(index + 20, 'LAVABO', 'viglacera')),
            ...Array.from({ length: 2 }, (_, index) => row(index + 30, 'BATHTUB', 'caesar')),
            row(40, 'TOILET_SEAT', 'toto'), row(41, 'TOILET_SEAT', 'moen'), row(50, 'URINAL', 'viglacera'),
        ]
        const quotas = { TOILET: 2, LAVABO: 1, BATHTUB: 1, TOILET_SEAT: 1, URINAL: 1 } as const
        const result = selectPhaseDCohort(rows, quotas, 6)
        expect(result.selected).toHaveLength(6)
        expect(result.familyCounts).toEqual({ BATHTUB: 1, LAVABO: 1, TOILET: 2, TOILET_SEAT: 1, URINAL: 1 })
        expect(phaseDSelectionHash(result)).toBe(phaseDSelectionHash(selectPhaseDCohort(rows, quotas, 6)))
        expect(result.brandCounts.toto || 0).toBeLessThanOrEqual(Math.floor(6 * 0.45))
    })

    it('declares the production quotas and checkpoint quotas deterministically', () => {
        expect(Object.values(PHASE_D_FAMILY_QUOTAS).reduce((sum, value) => sum + value, 0)).toBe(240)
        expect(Object.values(PHASE_D_CHECKPOINT_QUOTAS).reduce((sum, value) => sum + value, 0)).toBe(30)
    })
})
