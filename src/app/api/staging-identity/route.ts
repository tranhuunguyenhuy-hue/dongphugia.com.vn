import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STAGING_SITE_URL = 'https://dongphugia-staging.47-131-92-97.sslip.io'

type IsolationAggregate = {
    database_name: string
    server_address: string
    server_port: number
    table_count: bigint
    synthetic_products: bigint
    canonical_synthetic_products: bigint
    sensitive_rows: bigint
}

export async function GET() {
    if (
        process.env.DPG_STAGING_PREVIEW !== 'true'
        || process.env.NEXT_PUBLIC_SITE_URL !== STAGING_SITE_URL
    ) {
        return Response.json(
            { ok: false, error: 'not_found' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
    }

    try {
        const [aggregate] = await prisma.$queryRaw<IsolationAggregate[]>`
            SELECT
                current_database()::text AS database_name,
                COALESCE(inet_server_addr()::text, 'local') AS server_address,
                inet_server_port()::integer AS server_port,
                (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS table_count,
                (SELECT count(*) FROM products WHERE sku LIKE 'STG-DEMO-%') AS synthetic_products,
                (
                    SELECT count(*)
                    FROM products p
                    JOIN categories c ON c.id = p.category_id
                    WHERE p.sku LIKE 'STG-DEMO-%'
                      AND c.slug IN ('thiet-bi-ve-sinh', 'thiet-bi-bep')
                ) AS canonical_synthetic_products,
                (
                    (SELECT count(*) FROM admin_users)
                    + (SELECT count(*) FROM admin_sessions)
                    + (SELECT count(*) FROM customers)
                    + (SELECT count(*) FROM orders)
                    + (SELECT count(*) FROM quote_requests)
                ) AS sensitive_rows
        `

        if (!aggregate) {
            throw new Error('missing_aggregate')
        }

        const databaseFingerprintSha256 = createHash('sha256')
            .update(`${aggregate.database_name}|${aggregate.server_address}|${aggregate.server_port}`)
            .digest('hex')
        const tableCount = Number(aggregate.table_count)
        const syntheticProducts = Number(aggregate.synthetic_products)
        const canonicalSyntheticProducts = Number(aggregate.canonical_synthetic_products)
        const sensitiveRows = Number(aggregate.sensitive_rows)
        const ok = (
            tableCount === 46
            && syntheticProducts === 3
            && canonicalSyntheticProducts === 3
            && sensitiveRows === 0
        )

        return Response.json(
            {
                ok,
                dataset: 'STG-DEMO',
                databaseFingerprintSha256,
                aggregates: {
                    tableCount,
                    syntheticProducts,
                    canonicalSyntheticProducts,
                    sensitiveRows,
                },
            },
            { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
        )
    } catch (error: unknown) {
        const prismaCode = error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : undefined
        console.error(JSON.stringify({ event: 'staging_identity_failed', prismaCode }))
        return Response.json(
            { ok: false, error: 'isolation_unavailable' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
        )
    }
}
