import prisma from '@/lib/prisma'
import { getPublishingPrisma } from '@/lib/publishing/database'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        await prisma.products.count({ where: { is_active: true } })
        await prisma.categories.count()
        const expectedDatabaseIdentity = process.env.EXPECTED_DATABASE_IDENTITY?.trim()
        if (expectedDatabaseIdentity) {
            const identityRows = await prisma.$queryRaw<Array<{ marker: string | null }>>`
                SELECT shobj_description(oid, 'pg_database') AS marker
                FROM pg_database
                WHERE datname = current_database()
            `
            if (identityRows[0]?.marker !== expectedDatabaseIdentity) {
                throw Object.assign(new Error('database target attestation failed'), { code: 'TARGET_MISMATCH' })
            }
        }
        const expectedPublishingDatabaseIdentity = process.env.EXPECTED_PUBLISHING_DATABASE_IDENTITY?.trim()
        if (expectedPublishingDatabaseIdentity) {
            const publishingPrisma = getPublishingPrisma()
            const publishingIdentityRows = await publishingPrisma.$queryRaw<Array<{ marker: string | null }>>`
                SELECT shobj_description(oid, 'pg_database') AS marker
                FROM pg_database
                WHERE datname = current_database()
            `
            if (publishingIdentityRows[0]?.marker !== expectedPublishingDatabaseIdentity) {
                throw Object.assign(new Error('publishing database target attestation failed'), { code: 'PUBLISHING_TARGET_MISMATCH' })
            }
        }
    } catch (error: unknown) {
        const prismaCode = error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : undefined

        console.error(JSON.stringify({
            event: 'health_check_failed',
            prismaCode,
        }))

        return Response.json(
            { ok: false, error: 'service_unavailable' },
            { status: 503 },
        )
    }

    return Response.json(
        { ok: true },
        { status: 200 },
    )
}
