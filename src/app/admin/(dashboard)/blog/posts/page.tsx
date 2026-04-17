import Link from 'next/link'
import Image from 'next/image'
import { Plus, FileText, Eye, Star, Pin, PenLine } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { BlogPostDeleteButton } from './blog-post-delete-button'
import { format } from 'date-fns'

interface PageProps {
    searchParams: Promise<{ status?: string; category?: string }>
}

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
    published: { label: 'Đã đăng', cls: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
    draft: { label: 'Nháp', cls: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
    scheduled: { label: 'Lên lịch', cls: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
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
    const totalCount = Object.values(countMap).reduce((a, b) => a + b, 0)

    const tabs = [
        { label: 'Tất cả', value: '', count: totalCount },
        { label: '✅ Đã đăng', value: 'published', count: countMap['published'] ?? 0 },
        { label: '📝 Nháp', value: 'draft', count: countMap['draft'] ?? 0 },
        { label: '🕐 Lên lịch', value: 'scheduled', count: countMap['scheduled'] ?? 0 },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Quản lý bài viết</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {totalCount} bài · {countMap['published'] ?? 0} đang live
                    </p>
                </div>
                <Button asChild className="gap-2">
                    <Link href="/admin/blog/posts/new">
                        <Plus className="h-4 w-4" /> Viết bài mới
                    </Link>
                </Button>
            </div>

            {/* Status tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                    <Link
                        key={tab.value}
                        href={tab.value ? `/admin/blog/posts?status=${tab.value}` : '/admin/blog/posts'}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${(status ?? '') === tab.value
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-white border border-[#E4EEF2] text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`text-xs opacity-80 font-normal ${(status ?? '') === tab.value ? '' : 'bg-muted rounded-full px-1.5'}`}>
                                {tab.count}
                            </span>
                        )}
                    </Link>
                ))}
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E4EEF2] flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <FileText className="h-12 w-12 opacity-20" />
                    <p className="font-medium">Chưa có bài viết nào</p>
                    <p className="text-sm opacity-70">Hãy tạo bài viết đầu tiên để thu hút khách hàng!</p>
                    <Button asChild size="sm" className="mt-1">
                        <Link href="/admin/blog/posts/new">
                            <Plus className="h-4 w-4 mr-1" /> Viết bài đầu tiên
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-[#E4EEF2] overflow-hidden divide-y divide-[#E4EEF2]">
                    {posts.map((post) => {
                        const sc = statusConfig[post.status] ?? statusConfig['draft']
                        const date = post.published_at ?? post.updated_at
                        return (
                            <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors group">
                                {/* Thumbnail preview */}
                                <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted border border-[#E4EEF2] relative">
                                    {post.thumbnail_url ? (
                                        <Image
                                            src={post.thumbnail_url}
                                            alt={post.title}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                            sizes="56px"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>

                                {/* Title + meta */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {post.is_pinned && <Pin className="h-3 w-3 text-blue-500 shrink-0" />}
                                        {post.is_featured && <Star className="h-3 w-3 text-amber-400 shrink-0" />}
                                        <span className="text-sm font-medium text-foreground line-clamp-1 max-w-[320px]">
                                            {post.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-xs text-muted-foreground">
                                            {post.blog_categories?.name ?? 'Chưa phân loại'}
                                        </span>
                                        <span className="text-muted-foreground/30">·</span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(date, 'dd/MM/yyyy')}
                                        </span>
                                        {post.reading_time && (
                                            <>
                                                <span className="text-muted-foreground/30">·</span>
                                                <span className="text-xs text-muted-foreground">{post.reading_time} phút đọc</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Views */}
                                <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground min-w-[50px]">
                                    <Eye className="h-3.5 w-3.5" />
                                    {post.view_count.toLocaleString()}
                                </div>

                                {/* Status badge */}
                                <div className="shrink-0">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                        {sc.label}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                                        <Link href={`/admin/blog/posts/${post.id}`}>
                                            <PenLine className="h-3 w-3" /> Sửa
                                        </Link>
                                    </Button>
                                    {post.status === 'published' && post.slug && (
                                        <a
                                            href={`/blog/${post.blog_categories?.slug ?? 'tin-tuc'}/${post.slug}`}
                                            target="_blank"
                                            className="h-7 px-2 flex items-center text-muted-foreground hover:text-foreground"
                                            title="Xem trên website"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                    <BlogPostDeleteButton id={post.id} title={post.title} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
