import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    adminSessions: {
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        findUnique: vi.fn(),
    },
    adminUsers: {
        update: vi.fn(),
    },
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        admin_sessions: mocks.adminSessions,
        admin_users: mocks.adminUsers,
    },
}))

import { createSession, deleteSession, verifySession } from './session'

describe('Admin database session least-privilege query shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.adminSessions.create.mockResolvedValue({ id: 1 })
        mocks.adminSessions.delete.mockResolvedValue({ id: 1 })
        mocks.adminSessions.deleteMany.mockResolvedValue({ count: 0 })
        mocks.adminUsers.update.mockResolvedValue({ id: 7 })
    })

    it('creates a session and updates last_login_at with id-only RETURNING', async () => {
        const token = await createSession(7, '127.0.0.1', 'local-test-agent')

        expect(token).toHaveLength(64)
        expect(mocks.adminSessions.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                user_id: 7,
                token_hash: expect.any(String),
                ip_address: '127.0.0.1',
                user_agent: 'local-test-agent',
                expires_at: expect.any(Date),
            }),
            select: { id: true },
        }))
        expect(mocks.adminUsers.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { last_login_at: expect.any(Date) },
            select: { id: true },
        })
    })

    it('reads only session expiry and the fields needed to verify the user', async () => {
        mocks.adminSessions.findUnique.mockResolvedValue({
            expires_at: new Date(Date.now() + 60_000),
            user: {
                id: 7,
                email: 'fixture@example.invalid',
                name: 'Fixture Admin',
                role: 'admin',
                avatar_url: null,
                is_active: true,
            },
        })

        const user = await verifySession('fixture-token')

        expect(user).toMatchObject({ id: 7, role: 'admin', email: 'fixture@example.invalid' })
        expect(mocks.adminSessions.findUnique).toHaveBeenCalledWith({
            where: { token_hash: expect.any(String) },
            select: {
                expires_at: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        avatar_url: true,
                        is_active: true,
                    },
                },
            },
        })
    })

    it('keeps delete not-found behavior while returning only the session id', async () => {
        await deleteSession('fixture-token')

        expect(mocks.adminSessions.delete).toHaveBeenCalledWith({
            where: { token_hash: expect.any(String) },
            select: { id: true },
        })
    })
})
