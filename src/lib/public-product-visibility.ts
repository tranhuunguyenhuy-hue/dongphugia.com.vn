import { Prisma } from '@prisma/client'

export const PUBLIC_INDEXABLE_STOCK_STATUSES = ['discontinued', 'contact', 'pre_order'] as const

export function buildPublicProductVisibilityWhere(): Prisma.productsWhereInput {
    return {
        OR: [
            { is_active: true },
            { stock_status: { in: [...PUBLIC_INDEXABLE_STOCK_STATUSES] } },
        ],
    }
}
