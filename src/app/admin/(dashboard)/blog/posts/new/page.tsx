import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { BlogPostForm } from '../blog-post-form'

export default async function NewBlogPostPage() {
    const [categories, tags] = await Promise.all([
        prisma.blog_categories.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
        prisma.blog_tags.findMany({ orderBy: { name: 'asc' } }),
    ])

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/blog/posts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ChevronLeft className="h-4 w-4" /> Quay lại danh sách
                </Link>
                <h1 className="text-2xl font-bold">Thêm bài viết mới</h1>
            </div>
            <BlogPostForm categories={categories} tags={tags} />
        </div>
    )
}
