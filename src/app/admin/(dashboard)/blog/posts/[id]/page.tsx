import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { BlogPostForm } from '../blog-post-form'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: PageProps) {
    const { id } = await params
    const postId = parseInt(id)

    const [post, categories, tags] = await Promise.all([
        prisma.blog_posts.findUnique({
            where: { id: postId },
            include: {
                blog_post_tags: true,
            },
        }),
        prisma.blog_categories.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
        prisma.blog_tags.findMany({ orderBy: { name: 'asc' } }),
    ])

    if (!post) notFound()

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/blog/posts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ChevronLeft className="h-4 w-4" /> Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Sửa bài viết</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{post.title}</p>
            </div>
            <BlogPostForm post={post} categories={categories} tags={tags} />
        </div>
    )
}
