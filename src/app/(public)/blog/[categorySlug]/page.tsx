import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PostCard, BlogPost } from '@/components/blog/post-card'

import { getBlogPosts, getBlogCategories } from '@/lib/public-api-blog'

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }) {
    const { categorySlug } = await params
    const categories = await getBlogCategories()
    const category = categories.find((c: any) => c.slug === categorySlug)

    if (!category) return { title: 'Không tìm thấy chuyên mục' }

    return {
        title: `${category.name} | Blog Đông Phú Gia`,
        description: category.description || `Các bài viết mới nhất thuộc chuyên mục ${category.name}`
    }
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
    const { categorySlug } = await params
    const categories = await getBlogCategories()
    const category = categories.find((c: any) => c.slug === categorySlug)

    if (!category) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center bg-white text-center px-5">
                <h1 className="text-3xl font-bold text-[#0f172a] mb-4">Không tìm thấy chuyên mục</h1>
                <Link href="/blog" className="text-[#15803d] font-medium hover:underline">Quay lại trang Blog</Link>
            </div>
        )
    }

    // Filter posts from DB
    const { posts, totalPages } = await getBlogPosts({ categorySlug, limit: 12 })
    const categoryPosts = posts as unknown as BlogPost[]

    return (
        <div className="bg-white min-h-screen">
            {/* Category Header */}
            <div className="bg-[#f8fafc] border-b border-[#e2e8f0] py-10 lg:py-14">
                <div className="max-w-[1280px] mx-auto px-5">
                    {/* Breadcrumb */}
                    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] mb-6 flex-wrap">
                        <Link href="/" className="text-[#64748b] hover:text-[#15803d] transition-colors font-medium">Trang chủ</Link>
                        <ChevronRight className="h-4 w-4 text-[#cbd5e1]" strokeWidth={2} />
                        <Link href="/blog" className="text-[#64748b] hover:text-[#15803d] transition-colors font-medium">Blog</Link>
                        <ChevronRight className="h-4 w-4 text-[#cbd5e1]" strokeWidth={2} />
                        <span className="text-[#15803d] font-semibold">{category.name}</span>
                    </nav>

                    <h1 className="text-3xl lg:text-4xl font-bold text-[#0f172a] mb-3 tracking-tight">
                        {category.name}
                    </h1>
                    <p className="text-[#64748b] text-base lg:text-lg max-w-3xl">
                        {category.description || `Các bài viết mới nhất thuộc chuyên mục ${category.name}`}
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1280px] mx-auto px-5 py-12 lg:py-16">
                {categoryPosts.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        {categoryPosts.map(post => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-[#cbd5e1]">
                        <p className="text-[#64748b] text-lg">Chưa có bài viết nào trong chuyên mục này.</p>
                    </div>
                )}

                {/* Pagination (Client-side would handle dynamic page params) */}
                {totalPages > 1 && (
                    <div className="flex justify-center mt-12">
                        <nav className="flex items-center gap-2">
                            <button className="w-10 h-10 rounded-xl bg-[#15803d] text-white flex items-center justify-center font-medium">
                                1
                            </button>
                            {totalPages > 2 && <span className="text-[#94a3b8]">...</span>}
                            {totalPages > 1 && (
                                <button className="w-10 h-10 rounded-xl border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#15803d] transition-colors">
                                    {totalPages}
                                </button>
                            )}
                        </nav>
                    </div>
                )}
            </div>
        </div>
    )
}
