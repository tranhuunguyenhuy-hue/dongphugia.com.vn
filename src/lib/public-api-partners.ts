import { cache } from 'react'
import prisma from '@/lib/prisma'

export const getActivePartners = cache(async () => {
    return prisma.partners.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    })
})

export type PartnerItem = Awaited<ReturnType<typeof getActivePartners>>[number]
