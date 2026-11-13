import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
    productCreate: vi.fn(),
    blogCreate: vi.fn(),
    partnerCreate: vi.fn(),
    projectCreate: vi.fn(),
    orderFindUnique: vi.fn(),
    orderFindMany: vi.fn(),
    orderCount: vi.fn(),
    orderUpdate: vi.fn(),
}))

vi.mock('@/lib/auth/get-current-user', () => ({
    requireAuth: mocks.requireAuth,
    requirePermission: mocks.requirePermission,
    getCurrentUser: vi.fn(),
}))

vi.mock('next/cache', () => ({
    revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/utils', () => ({
    slugify: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
    generateOrderNumber: () => 'DPG-TEST-000001',
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        products: { create: mocks.productCreate },
        blog_posts: { create: mocks.blogCreate },
        partners: { create: mocks.partnerCreate },
        projects: { create: mocks.projectCreate },
        orders: {
            findUnique: mocks.orderFindUnique,
            findMany: mocks.orderFindMany,
            count: mocks.orderCount,
            update: mocks.orderUpdate,
        },
    },
}))

import { createProduct } from './product-actions'
import { createBlogPost } from './blog-actions'
import { createPartner } from './partner-actions'
import { createProject } from './project-actions'
import { getAdminOrders, updateOrderStatus } from './order-actions'

describe('admin Server Action authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps Product and Blog mutations authenticated and denies deferred CMS modules', async () => {
        mocks.requirePermission.mockRejectedValue(new Error('UNAUTHORIZED'))

        await expect(createProduct({})).rejects.toThrow('UNAUTHORIZED')
        await expect(createBlogPost({})).rejects.toThrow('UNAUTHORIZED')
        await expect(createPartner({} as never)).rejects.toThrow('ADMIN_LAUNCH_SCOPE_DENIED')
        await expect(createProject({} as never)).rejects.toThrow('ADMIN_LAUNCH_SCOPE_DENIED')

        expect(mocks.productCreate).not.toHaveBeenCalled()
        expect(mocks.blogCreate).not.toHaveBeenCalled()
        expect(mocks.partnerCreate).not.toHaveBeenCalled()
        expect(mocks.projectCreate).not.toHaveBeenCalled()
    })

    it('denies the deferred Orders module before authentication or reads', async () => {
        await expect(getAdminOrders({})).rejects.toThrow('ADMIN_LAUNCH_SCOPE_DENIED')

        expect(mocks.requireAuth).not.toHaveBeenCalled()
        expect(mocks.orderFindMany).not.toHaveBeenCalled()
        expect(mocks.orderCount).not.toHaveBeenCalled()
    })

    it('denies order mutations before permission or assignment checks', async () => {
        mocks.requirePermission.mockResolvedValue({ id: 7, role: 'sale' })
        await expect(updateOrderStatus(123, 'confirmed')).rejects.toThrow('ADMIN_LAUNCH_SCOPE_DENIED')
        expect(mocks.requirePermission).not.toHaveBeenCalled()
        expect(mocks.orderFindUnique).not.toHaveBeenCalled()
        expect(mocks.orderUpdate).not.toHaveBeenCalled()
    })
})
