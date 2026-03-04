import { cache } from 'react'
import prisma from '@/lib/prisma'

export const getFeaturedProjects = cache(async () => {
    return prisma.projects.findMany({
        where: { is_active: true, is_featured: true },
        orderBy: { sort_order: 'asc' },
        take: 6,
    })
})

export const getActiveProjects = cache(async () => {
    return prisma.projects.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    })
})

export type ProjectItem = Awaited<ReturnType<typeof getActiveProjects>>[number]
