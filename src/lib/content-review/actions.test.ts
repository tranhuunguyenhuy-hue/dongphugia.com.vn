import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateContentReviewProposal } from './proposal'

const mocks = vi.hoisted(() => ({
    requireRole: vi.fn(),
    revalidatePath: vi.fn(),
    transaction: vi.fn(),
    decisionFind: vi.fn(),
    decisionFindMany: vi.fn(),
    decisionUpdate: vi.fn(),
    auditCreate: vi.fn(),
    productsUpdate: vi.fn(),
    productImagesUpdate: vi.fn(),
    productDescriptionsUpdate: vi.fn(),
}))

vi.mock('@/lib/auth/get-current-user', () => ({ requireRole: mocks.requireRole }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/prisma', () => ({
    default: {
        $transaction: mocks.transaction,
        products: { update: mocks.productsUpdate },
        product_images: { update: mocks.productImagesUpdate },
        product_descriptions: { update: mocks.productDescriptionsUpdate },
    },
}))

import { saveProposalDescription, setProposalImageDecision, transitionContentReview } from './actions'

describe('content review mutations are isolated from public product tables', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        mocks.requireRole.mockResolvedValue({ id: 9, role: 'admin' })
        const proposal = await generateContentReviewProposal({
            id: 44,
            sku: 'SAFE-44',
            name: 'Safe proposal',
            sourceUrl: 'https://hita.com.vn/p/44',
            descriptionHtml: '<p>Before</p>',
            imageMainUrl: 'https://cdn.dongphugia.com.vn/products/safe.jpg',
        })
        mocks.decisionFind.mockResolvedValue({ id: 7, decision: 'needs_review', import_payload: proposal })
        mocks.decisionFindMany.mockResolvedValue([{ id: 7, import_payload: proposal }])
        mocks.decisionUpdate.mockResolvedValue({})
        mocks.auditCreate.mockResolvedValue({})
        mocks.transaction.mockImplementation(async callback => callback({
            crawl_import_decisions: {
                findFirst: mocks.decisionFind,
                findMany: mocks.decisionFindMany,
                update: mocks.decisionUpdate,
            },
            audit_logs: { create: mocks.auditCreate },
            products: { update: mocks.productsUpdate },
            product_images: { update: mocks.productImagesUpdate },
            product_descriptions: { update: mocks.productDescriptionsUpdate },
        }))
    })

    it('requires the admin role before starting any mutation', async () => {
        mocks.requireRole.mockRejectedValue(new Error('FORBIDDEN'))

        await expect(transitionContentReview(7, 'approve', 'PM approved')).resolves.toEqual({
            success: false,
            error: 'FORBIDDEN',
        })
        expect(mocks.transaction).not.toHaveBeenCalled()
    })

    it('approval writes only the review decision and audit log', async () => {
        await expect(transitionContentReview(7, 'approve', 'PM approved')).resolves.toEqual({ success: true })

        expect(mocks.decisionUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ decision: 'approved', reviewer_id: 9 }),
        }))
        expect(mocks.auditCreate).toHaveBeenCalledOnce()
        expect(mocks.productsUpdate).not.toHaveBeenCalled()
        expect(mocks.productImagesUpdate).not.toHaveBeenCalled()
        expect(mocks.productDescriptionsUpdate).not.toHaveBeenCalled()
    })

    it('editing increments version and invalidates prior approval without public writes', async () => {
        mocks.decisionFind.mockImplementation(async () => {
            const proposal = await generateContentReviewProposal({
                id: 44,
                sku: 'SAFE-44',
                name: 'Safe proposal',
                sourceUrl: 'https://hita.com.vn/p/44',
                descriptionHtml: '<p>Before</p>',
            })
            return { id: 7, decision: 'approved', import_payload: proposal }
        })

        await expect(saveProposalDescription(7, '<p>After</p>', 'PM edited copy')).resolves.toEqual({ success: true })
        const update = mocks.decisionUpdate.mock.calls[0][0]
        expect(update.data.decision).toBe('needs_review')
        expect(update.data.reviewer_id).toBeNull()
        expect(update.data.reviewed_at).toBeNull()
        expect(update.data.import_payload.version).toBe(2)
        expect(update.data.import_payload.proposalHash).not.toBe(update.data.import_payload.baseHash)
        expect(mocks.productsUpdate).not.toHaveBeenCalled()
        expect(mocks.productImagesUpdate).not.toHaveBeenCalled()
        expect(mocks.productDescriptionsUpdate).not.toHaveBeenCalled()
    })

    it('shares a hash decision across duplicate proposals while staying in review tables', async () => {
        const first = await generateContentReviewProposal({
            id: 44,
            sku: 'DUP-44',
            name: 'Duplicate one',
            sourceUrl: 'https://hita.com.vn/p/44',
            descriptionHtml: '<p>One</p>',
            imageMainUrl: 'https://cdn.hita.com.vn/storage/shared.jpg',
        })
        const second = await generateContentReviewProposal({
            id: 45,
            sku: 'DUP-45',
            name: 'Duplicate two',
            sourceUrl: 'https://hita.com.vn/p/45',
            descriptionHtml: '<p>Two</p>',
            imageMainUrl: 'https://cdn.hita.com.vn/storage/shared.jpg',
        })
        mocks.decisionFindMany.mockResolvedValue([
            { id: 7, import_payload: first },
            { id: 8, import_payload: second },
        ])

        await expect(setProposalImageDecision(
            7,
            first.after.images[0].fingerprint,
            'REMOVE',
            'Shared copyright image',
        )).resolves.toEqual({ success: true })

        expect(mocks.decisionUpdate).toHaveBeenCalledTimes(2)
        expect(mocks.auditCreate).toHaveBeenCalledTimes(2)
        for (const [call] of mocks.decisionUpdate.mock.calls) {
            expect(call.data.import_payload.after.images[0].decision).toBe('REMOVE')
            expect(call.data.decision).toBe('needs_review')
        }
        expect(mocks.productsUpdate).not.toHaveBeenCalled()
        expect(mocks.productImagesUpdate).not.toHaveBeenCalled()
        expect(mocks.productDescriptionsUpdate).not.toHaveBeenCalled()
    })

    it('requires explicit audited Resume before a paused proposal can be reviewed or edited', async () => {
        const proposal = await generateContentReviewProposal({
            id: 44,
            sku: 'PAUSED-44',
            name: 'Paused proposal',
            sourceUrl: 'https://hita.com.vn/p/44',
            descriptionHtml: '<p>Before</p>',
            imageMainUrl: 'https://cdn.dongphugia.com.vn/products/paused.jpg',
        })
        const pausedProposal = {
            ...proposal,
            workflow: { paused: true, pauseReason: 'Waiting for PM input' },
        }
        mocks.decisionFind.mockResolvedValue({ id: 7, decision: 'needs_review', import_payload: pausedProposal })

        await expect(transitionContentReview(7, 'approve', 'Attempt while paused')).resolves.toMatchObject({
            success: false,
            error: expect.stringContaining('paused'),
        })
        await expect(transitionContentReview(7, 'ready', 'Attempt ready while paused')).resolves.toMatchObject({
            success: false,
        })
        await expect(saveProposalDescription(7, '<p>Blocked edit</p>', 'Attempt while paused')).resolves.toMatchObject({
            success: false,
            error: expect.stringContaining('Resume'),
        })
        expect(mocks.decisionUpdate).not.toHaveBeenCalled()
        expect(mocks.auditCreate).not.toHaveBeenCalled()

        await expect(transitionContentReview(7, 'resume', 'PM resumed review')).resolves.toEqual({ success: true })
        expect(mocks.decisionUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                decision: 'needs_review',
                import_payload: expect.objectContaining({ workflow: { paused: false } }),
            }),
        }))
        expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'CONTENT_REVIEW_RESUME' }),
        }))
    })

    it('updates every shared fingerprint proposal beyond 500 rows without partial omission', async () => {
        const proposal = await generateContentReviewProposal({
            id: 44,
            sku: 'MANY-44',
            name: 'Shared asset',
            sourceUrl: 'https://hita.com.vn/p/44',
            descriptionHtml: '<p>Shared</p>',
            imageMainUrl: 'https://cdn.hita.com.vn/storage/shared.jpg',
        })
        const candidates = Array.from({ length: 501 }, (_, index) => ({
            id: index + 1,
            import_payload: {
                ...proposal,
                product: { ...proposal.product, id: index + 1, sku: `MANY-${index + 1}` },
            },
        }))
        mocks.decisionFindMany.mockImplementation(async (args: { cursor?: { id: number } }) => {
            const after = args.cursor?.id || 0
            return candidates.filter(candidate => candidate.id > after).slice(0, 100)
        })

        await expect(setProposalImageDecision(
            1,
            proposal.after.images[0].fingerprint,
            'REMOVE',
            'Remove shared Hita asset',
        )).resolves.toEqual({ success: true })

        expect(mocks.decisionUpdate).toHaveBeenCalledTimes(501)
        expect(mocks.auditCreate).toHaveBeenCalledTimes(501)
        expect(mocks.productsUpdate).not.toHaveBeenCalled()
        expect(mocks.productImagesUpdate).not.toHaveBeenCalled()
        expect(mocks.productDescriptionsUpdate).not.toHaveBeenCalled()
    })
})
