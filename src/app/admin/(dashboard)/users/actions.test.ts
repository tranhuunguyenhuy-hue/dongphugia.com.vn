import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    hashPassword: vi.fn(),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
    transaction: vi.fn(),
    updateUser: vi.fn(),
    deleteSessions: vi.fn(),
    findUser: vi.fn(),
    countUsers: vi.fn(),
    findUserByEmail: vi.fn(),
    createUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        $transaction: mocks.transaction,
        admin_users: {
            update: mocks.updateUser,
            findUnique: mocks.findUser,
            findFirst: mocks.findUserByEmail,
            count: mocks.countUsers,
            create: mocks.createUser,
        },
        admin_sessions: {
            deleteMany: mocks.deleteSessions,
        },
    },
}))

vi.mock('@/lib/auth/get-current-user', () => ({
    requirePermission: mocks.requirePermission,
    getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/auth/password', () => ({
    hashPassword: mocks.hashPassword,
}))

vi.mock('next/cache', () => ({
    revalidatePath: mocks.revalidatePath,
}))

import { saveUser } from './actions'

const activeAdmin = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    password: undefined,
    role: 'admin' as const,
    is_active: true,
}

describe('saveUser session invalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getCurrentUser.mockResolvedValue({ role: 'admin' })
        mocks.hashPassword.mockResolvedValue('hashed-password')
        mocks.updateUser.mockReturnValue({ operation: 'update-user' })
        mocks.deleteSessions.mockReturnValue({ operation: 'delete-sessions' })
        mocks.transaction.mockResolvedValue([])
    })

    it('updates the password and invalidates sessions in one transaction', async () => {
        const result = await saveUser({ ...activeAdmin, password: 'new-password' })

        expect(result).toEqual({ success: true })
        expect(mocks.updateUser).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: activeAdmin.id },
            data: expect.objectContaining({ password_hash: 'hashed-password' }),
        }))
        expect(mocks.deleteSessions).toHaveBeenCalledWith({
            where: { user_id: activeAdmin.id },
        })
        expect(mocks.transaction).toHaveBeenCalledWith([
            { operation: 'update-user' },
            { operation: 'delete-sessions' },
        ])
    })

    it('does not invalidate sessions for a profile-only update', async () => {
        const result = await saveUser(activeAdmin)

        expect(result).toEqual({ success: true })
        expect(mocks.updateUser).toHaveBeenCalledOnce()
        expect(mocks.deleteSessions).not.toHaveBeenCalled()
        expect(mocks.transaction).not.toHaveBeenCalled()
    })

    it('invalidates sessions when a user is deactivated', async () => {
        mocks.findUser.mockResolvedValue({ role: 'sale' })

        const result = await saveUser({
            ...activeAdmin,
            role: 'sale',
            is_active: false,
        })

        expect(result).toEqual({ success: true })
        expect(mocks.deleteSessions).toHaveBeenCalledWith({
            where: { user_id: activeAdmin.id },
        })
        expect(mocks.transaction).toHaveBeenCalledOnce()
    })
})
