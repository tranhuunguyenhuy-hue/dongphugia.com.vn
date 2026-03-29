import Link from 'next/link'
import { Plus, FileText, Eye, Star } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BlogPostDeleteButton } from './blog-post-delete-button'
import { format } from 'date-fns'

interface PageProps {
    searchParams: Promise<{ status?: string; category?: string }>
}

const statusColors: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-blue-100 text-blue-700',
}

const statusLabels: Record<string, string> = {
    published: 'Đã đăng',
    draft: 'Nháp',
    scheduled: 'Lên lịch',
}

export default async function BlogPostsPage({ searchParams }: PageProps) {
    const { status, category } = await searchParams

    const where: any = {}
    if (status) where.status = status
    if (category) where.category_id = parseInt(category)

    const [posts, categories, counts] = await Promise.all([
        prisma.blog_posts.findMany({
            where,
            include: { blog_categories: { select: { name: true, slug: true } } },
            orderBy: [{ is_pinned: 'desc' }, { updated_at: 'desc' }],
        }),
        prisma.blog_categories.findMany({ orderBy: { sort_order: 'asc' } }),
        prisma.blog_posts.groupBy({ by: ['status'], _count: { id: true } }),
    ])

    const countMap = counts.reduce((acc, c) => ({ ...acc, [c.status]: c._count.id }), {} as Record<string, number>)
    const totalCount = posts.length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Quản lý bài viết</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{totalCount} bài viết</p>
                </div>
                <Button asChild className="gap-2">
                    <Link href="/admin/blog/posts/new">
                        <Plus className="h-4 w-4" /> Thêm bài viết
                    </Link>
                </Button>
            </div>

            {/* Status tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { label: 'Tất cả', value: '' },
                    { label: 'Đã đăng', value: 'published' },
                    { label: 'Nháp', value: 'draft' },
                    { label: 'Lên lịch', value: 'scheduled' },
                ].map((tab) => (
                    <Link
                        key={tab.value}
                        href={tab.value ? `/admin/blog/posts?status=${tab.value}` : '/admin/blog/posts'}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            (status ?? '') === tab.value
                                ? 'bg-primary text-white'
                                : 'bg-white border border-[#E4EEF2] text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab.label}
                        {tab.value && countMap[tab.value] ? (
                            <span className="ml-1.5 text-xs opacity-80">({countMap[tab.value]})</span>
                        ) : null}
                    </Link>
                ))}
            </div>

            {/* Posts table */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] overflow-hidden">
                {posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                        <FileText className="h-10 w-10 opacity-30" />
                        <p className="text-sm">Chưa có bài viết nào</p>
                        <Button asChild size="sm" variant="outline">
                            <Link href="/admin/blog/posts/new">Tạo bài viết đầu tiên</Link>
                        </Button>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E4EEF2] bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tiêu đề</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chuyên mục</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lượt xem</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ngày</th>
                                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.map((post) => (
                                <tr key={post.id} className="border-b border-[#E4EEF2] last:border-0 table-row-hover">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {post.is_featured && <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                                            <span className="font-medium text-foreground line-clamp-1 max-w-[280px]">{post.title}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{post.slug}</p>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{post.blog_categories?.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status] ?? ''}`}>
                                            {statusLabels[post.status] ?? post.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                            <Eye className="h-3.5 w-3.5" />
                                            {post.view_count.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                        {post.published_at
                                            ? format(post.published_at, 'dd/MM/yyyy')
                                            : format(post.updated_at, 'dd/MM/yyyy')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 justify-end">
                                            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                                <Link href={`/admin/blog/posts/${post.id}`}>Sửa</Link>
                                            </Button>
                                            <BlogPostDeleteButton id={post.id} title={post.title} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
