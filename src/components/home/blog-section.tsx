import prisma from '@/lib/prisma'
import { BlogSectionClient } from './blog-section-client'

export const revalidate = 3600

export async function BlogSection() {
    const posts = await prisma.blog_posts.findMany({
        where: { status: 'published' },
        include: { blog_categories: true },
        orderBy: { created_at: 'desc' },
        take: 8
    })

    return <BlogSectionClient posts={posts} />
}
