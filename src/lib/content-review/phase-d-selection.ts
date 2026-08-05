import { hashObject } from './hash'
import type { ImportantFamily, PhaseCGate } from './phase-c-inventory'

export const PHASE_D_FAMILY_QUOTAS: Record<ImportantFamily, number> = {
    TOILET: 120,
    LAVABO: 55,
    BATHTUB: 30,
    TOILET_SEAT: 17,
    URINAL: 18,
}

export const PHASE_D_CHECKPOINT_QUOTAS: Record<ImportantFamily, number> = {
    TOILET: 15,
    LAVABO: 7,
    BATHTUB: 4,
    TOILET_SEAT: 2,
    URINAL: 2,
}

export const PHASE_D_BRAND_PRIORITY = ['toto', 'inax', 'viglacera', 'caesar', 'american-standard', 'duravit', 'moen', 'atmor'] as const

export type PhaseDInventoryRow = {
    id: number
    sku: string | null
    name: string | null
    brand: { id: number; name: string; slug: string } | null
    category: { id: number; name: string; slug: string } | null
    updatedAt: string
    descriptionHash: string
    visibleLength: number
    media: Array<{ kind: 'main' | 'gallery' | 'embedded'; sourceId: string; fingerprint: string; host: string }>
    classification: { gate: PhaseCGate; family: ImportantFamily | 'AMBIGUOUS' | 'OUTSIDE_APPROVED_FAMILY'; reasonCodes: string[]; blocker: string | null; embeddedCount: number; mediaRisk: string }
}

export type PhaseDSelectedRow = PhaseDInventoryRow & {
    selectionReasons: string[]
}

export type PhaseDSelectionResult = {
    selected: PhaseDSelectedRow[]
    blockers: string[]
    brandCounts: Record<string, number>
    familyCounts: Record<string, number>
}

function brandRank(slug: string): number {
    const index = PHASE_D_BRAND_PRIORITY.indexOf(slug as typeof PHASE_D_BRAND_PRIORITY[number])
    return index === -1 ? PHASE_D_BRAND_PRIORITY.length : index
}

function countBy<T extends string>(rows: PhaseDSelectedRow[], get: (row: PhaseDSelectedRow) => T): Record<string, number> {
    return Object.fromEntries([...rows.reduce((map, row) => map.set(get(row), (map.get(get(row)) || 0) + 1), new Map<string, number>())].sort(([left], [right]) => left.localeCompare(right)))
}

function compareRows(left: PhaseDInventoryRow, right: PhaseDInventoryRow, uniqueHashes: Set<string>, coveredBrands: Set<string>): number {
    const leftUnique = uniqueHashes.has(left.descriptionHash) ? 0 : 1
    const rightUnique = uniqueHashes.has(right.descriptionHash) ? 0 : 1
    if (leftUnique !== rightUnique) return leftUnique - rightUnique
    const leftNewBrand = coveredBrands.has(left.brand?.slug || 'UNKNOWN') ? 1 : 0
    const rightNewBrand = coveredBrands.has(right.brand?.slug || 'UNKNOWN') ? 1 : 0
    if (leftNewBrand !== rightNewBrand) return leftNewBrand - rightNewBrand
    if (left.visibleLength !== right.visibleLength) return right.visibleLength - left.visibleLength
    if (left.classification.embeddedCount !== right.classification.embeddedCount) return right.classification.embeddedCount - left.classification.embeddedCount
    const leftBrandRank = brandRank(left.brand?.slug || 'UNKNOWN')
    const rightBrandRank = brandRank(right.brand?.slug || 'UNKNOWN')
    if (leftBrandRank !== rightBrandRank) return leftBrandRank - rightBrandRank
    const leftSku = left.sku || ''
    const rightSku = right.sku || ''
    return leftSku.localeCompare(rightSku) || left.id - right.id
}

export function selectPhaseDCohort(rows: PhaseDInventoryRow[], familyQuotas: Record<ImportantFamily, number>, targetTotal = Object.values(familyQuotas).reduce((total, value) => total + value, 0)): PhaseDSelectionResult {
    const eligible = rows.filter((row) => row.classification.gate === 'REWRITE_IMPORTANT' && row.classification.family in familyQuotas && !row.classification.blocker && row.sku?.trim())
    const blockers = rows.filter((row) => row.classification.gate === 'REWRITE_IMPORTANT' && (!row.sku?.trim() || row.classification.blocker)).map((row) => `IDENTITY_BLOCKER:${row.id}`)
    const selected: PhaseDSelectedRow[] = []
    const brandCounts = new Map<string, number>()
    const globalBrandCap = Math.floor(targetTotal * 0.45)
    const remaining = new Map(Object.entries(familyQuotas) as Array<[ImportantFamily, number]>)
    const pool = [...eligible]
    const uniqueHashesByFamily = new Map<ImportantFamily, Set<string>>()
    for (const family of Object.keys(familyQuotas) as ImportantFamily[]) {
        const familyRows = eligible.filter((row) => row.classification.family === family)
        const hashCounts = new Map<string, number>()
        for (const row of familyRows) hashCounts.set(row.descriptionHash, (hashCounts.get(row.descriptionHash) || 0) + 1)
        uniqueHashesByFamily.set(family, new Set([...hashCounts.entries()].filter(([, count]) => count === 1).map(([hash]) => hash)))
        if (familyRows.length < (familyQuotas[family] || 0)) throw new Error(`Phase D quota cannot be met for ${family}: need ${familyQuotas[family]}, found ${familyRows.length}`)
    }
    while (selected.length < targetTotal) {
        const available = pool.filter((row) => (remaining.get(row.classification.family as ImportantFamily) || 0) > 0)
        if (available.length === 0) throw new Error('Phase D selection exhausted eligible rows before quotas were met')
        const canPreserveBrandCap = (candidate: PhaseDInventoryRow): boolean => {
            const candidateBrand = candidate.brand?.slug || 'UNKNOWN'
            const nextBrandCount = (brandCounts.get(candidateBrand) || 0) + 1
            if (candidateBrand !== 'toto' && (brandCounts.get('toto') || 0) > globalBrandCap) return false
            const nextRemaining = new Map(remaining)
            const family = candidate.classification.family as ImportantFamily
            nextRemaining.set(family, (nextRemaining.get(family) || 0) - 1)
            const nextPool = pool.filter((row) => row.id !== candidate.id)
            let minimumTotoNeeded = nextBrandCount > globalBrandCap ? Number.POSITIVE_INFINITY : 0
            for (const [familyName, quota] of nextRemaining) {
                if (quota <= 0) continue
                const nonTotoAvailable = nextPool.filter((row) => row.classification.family === familyName && (row.brand?.slug || 'UNKNOWN') !== 'toto').length
                minimumTotoNeeded += Math.max(0, quota - nonTotoAvailable)
            }
            return nextBrandCount <= globalBrandCap || candidateBrand !== 'toto'
                ? (brandCounts.get('toto') || 0) + (candidateBrand === 'toto' ? 1 : 0) + minimumTotoNeeded <= globalBrandCap
                : false
        }
        const capPreservingCandidates = available.filter(canPreserveBrandCap)
        const underCapAlternatives = available.filter((row) => (brandCounts.get(row.brand?.slug || 'UNKNOWN') || 0) < globalBrandCap)
        const coveredBrands = new Set(brandCounts.keys())
        const sortable = capPreservingCandidates.length > 0 ? capPreservingCandidates : available
        const sorted = [...sortable].sort((left, right) => {
            const leftBrand = left.brand?.slug || 'UNKNOWN'
            const rightBrand = right.brand?.slug || 'UNKNOWN'
            const leftAtCap = (brandCounts.get(leftBrand) || 0) >= globalBrandCap && underCapAlternatives.some((row) => (row.brand?.slug || 'UNKNOWN') !== leftBrand)
            const rightAtCap = (brandCounts.get(rightBrand) || 0) >= globalBrandCap && underCapAlternatives.some((row) => (row.brand?.slug || 'UNKNOWN') !== rightBrand)
            if (leftAtCap !== rightAtCap) return leftAtCap ? 1 : -1
            const uniqueHashes = uniqueHashesByFamily.get(left.classification.family as ImportantFamily) || new Set<string>()
            return compareRows(left, right, uniqueHashes, coveredBrands)
        })
        const chosen = sorted[0]
        const chosenBrand = chosen.brand?.slug || 'UNKNOWN'
        const family = chosen.classification.family as ImportantFamily
        const uniqueHashes = uniqueHashesByFamily.get(family) || new Set<string>()
        const reasons = ['FAMILY_QUOTA', uniqueHashes.has(chosen.descriptionHash) ? 'UNIQUE_DESCRIPTION_HASH' : 'DESCRIPTION_HASH_TIEBREAK', 'SOURCE_EVIDENCE_VISIBLE_LENGTH', 'SOURCE_EVIDENCE_EMBEDDED_IMAGES']
        if (!coveredBrands.has(chosenBrand)) reasons.push('BRAND_COVERAGE')
        if ((brandCounts.get(chosenBrand) || 0) >= globalBrandCap) reasons.push('BRAND_CAP_EXCEPTION_NO_QUALIFIED_ALTERNATIVE')
        selected.push({ ...chosen, selectionReasons: reasons })
        brandCounts.set(chosenBrand, (brandCounts.get(chosenBrand) || 0) + 1)
        remaining.set(family, (remaining.get(family) || 0) - 1)
        pool.splice(pool.indexOf(chosen), 1)
    }
    if (selected.length !== targetTotal) throw new Error(`Phase D selection total mismatch: ${selected.length} !== ${targetTotal}`)
    return { selected: selected.sort((left, right) => left.id - right.id), blockers, brandCounts: countBy(selected, (row) => row.brand?.slug || 'UNKNOWN'), familyCounts: countBy(selected, (row) => row.classification.family) }
}

export function phaseDSelectionHash(result: PhaseDSelectionResult): string {
    return hashObject(result.selected.map((row) => ({ id: row.id, sku: row.sku, descriptionHash: row.descriptionHash, family: row.classification.family, selectionReasons: row.selectionReasons })))
}
