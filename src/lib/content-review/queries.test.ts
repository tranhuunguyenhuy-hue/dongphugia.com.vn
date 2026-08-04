import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateContentReviewProposal } from './proposal'

const mocks = vi.hoisted(() => ({
    requirePermission: vi.fn(),
    decisionFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/get-current-user', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({
    default: {
        crawl_import_decisions: { findMany: mocks.decisionFindMany },
    },
}))

import { getContentReviewQueue } from './queries'

describe('content review queue completeness', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requirePermission.mockResolvedValue({ id: 9, role: 'admin' })
    })

    it('makes all 300 proposals reachable through explicit pages without an omission cap', async () => {
        const base = await generateContentReviewProposal({
            id: 1,
            sku: 'QUEUE-1',
            name: 'Queue item',
            sourceUrl: 'https://hita.com.vn/queue/1',
            descriptionHtml: '<p>Queue</p>',
            imageMainUrl: 'https://cdn.dongphugia.com.vn/queue.jpg',
        })
        const rows = Array.from({ length: 300 }, (_, index) => ({
            id: index + 1,
            decision: 'needs_review',
            import_payload: {
                ...base,
                product: { ...base.product, id: index + 1, sku: `QUEUE-${index + 1}`, name: `Queue ${index + 1}` },
            },
            updated_at: new Date(1_700_000_000_000 + index),
        }))
        mocks.decisionFindMany.mockImplementation(async (args: { cursor?: { id: number } }) => {
            const after = args.cursor?.id || 0
            return rows.filter(row => row.id > after).slice(0, 100)
        })

        const pages = await Promise.all(
            Array.from({ length: 6 }, (_, index) => getContentReviewQueue({ page: index + 1, pageSize: 50 })),
        )
        const ids = pages.flatMap(page => page.items.map(item => item.id))

        expect(pages[0]).toMatchObject({ total: 300, page: 1, pageSize: 50, totalPages: 6 })
        expect(pages[5].items).toHaveLength(50)
        expect(new Set(ids).size).toBe(300)
        expect(ids.sort((left, right) => left - right)).toEqual(rows.map(row => row.id))
        expect(mocks.decisionFindMany.mock.calls.some(([args]) => args.take === 250)).toBe(false)
    })
})
