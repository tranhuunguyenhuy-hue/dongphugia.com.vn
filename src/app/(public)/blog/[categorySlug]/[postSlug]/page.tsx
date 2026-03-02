import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronRight, Calendar, User, Eye, Share2 } from 'lucide-react'
import { TableOfContents } from '@/components/blog/toc'
import { PostCard, BlogPost } from '@/components/blog/post-card'

import { getBlogPostBySlug, getRelatedBlogPosts } from '@/lib/public-api-blog'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ postSlug: string }> }) {
    const { postSlug } = await params
    const post = await getBlogPostBySlug(postSlug)

    if (!post) return { title: 'Bài viết không tồn tại' }

    return {
        title: `${post.title} | Blog Đông Phú Gia`,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt || '',
            type: 'article',
            publishedTime: post.published_at ? new Date(post.published_at).toISOString() : undefined,
        }
    }
}

export default async function BlogPostPage({ params }: { params: Promise<{ categorySlug: string; postSlug: string }> }) {
    const { categorySlug, postSlug } = await params

    const post = await getBlogPostBySlug(postSlug)
    if (!post || post.blog_categories?.slug !== categorySlug) {
        notFound()
    }

    // Related posts from same category (excluding current)
    const relatedPostsRaw = await getRelatedBlogPosts(post.id, post.category_id, 3)
    const relatedPosts = relatedPostsRaw as unknown as BlogPost[]

    return (
        <div className="bg-[#f8fafc] min-h-screen pb-20">

            {/* Article Header (Title & Meta area within main container) */}
            <div className="max-w-[1280px] mx-auto px-5 pt-10">

                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] mb-8 flex-wrap">
                    <Link href="/" className="text-[#64748b] hover:text-[#15803d] transition-colors font-medium">Trang chủ</Link>
                    <ChevronRight className="h-4 w-4 text-[#cbd5e1]" strokeWidth={2} />
                    <Link href="/blog" className="text-[#64748b] hover:text-[#15803d] transition-colors font-medium">Blog</Link>
                    <ChevronRight className="h-4 w-4 text-[#cbd5e1]" strokeWidth={2} />
                    <Link href={`/blog/${categorySlug}`} className="text-[#64748b] hover:text-[#15803d] transition-colors font-medium">
                        {post.blog_categories?.name}
                    </Link>
                </nav>

                {/* Content Layout */}
                <div className="flex flex-col lg:flex-row gap-10">

                    {/* Main Article column */}
                    <div className="lg:w-[70%]">
                        <article className="bg-white rounded-3xl p-6 md:p-10 border border-[#e2e8f0] shadow-sm relative overflow-hidden">

                            {/* Category Badge & Meta Info */}
                            <div className="flex flex-col gap-6 mb-8 border-b border-[#f1f5f9] pb-8">
                                <div className="flex items-center gap-3">
                                    <Link
                                        href={`/blog/${post.blog_categories?.slug}`}
                                        className="bg-[#dcfce7] text-[#15803d] px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-[#bbf7d0] transition-colors"
                                    >
                                        {post.blog_categories?.name}
                                    </Link>
                                </div>

                                <h1 className="text-3xl md:text-4xl lg:text-[40px] font-bold text-[#0f172a] leading-[1.2] tracking-tight">
                                    {post.title}
                                </h1>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#64748b] font-medium">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-[#cbd5e1]" />
                                        <span>Ban Biên Tập Đông Phú Gia</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-[#cbd5e1]" />
                                        <time dateTime={post.published_at ? new Date(post.published_at).toISOString() : undefined}>
                                            {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN', {
                                                day: '2-digit', month: '2-digit', year: 'numeric'
                                            }) : ''}
                                        </time>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-[#cbd5e1]" />
                                        <span>{post.view_count.toLocaleString('vi-VN')} lượt xem</span>
                                    </div>
                                </div>
                            </div>

                            {/* Cover Image */}
                            <div className="w-full h-[300px] md:h-[450px] relative rounded-2xl overflow-hidden mb-10 bg-slate-100">
                                {post.cover_image_url ? (
                                    <Image
                                        src={post.cover_image_url}
                                        alt={post.title}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 70vw"
                                        className="object-cover"
                                        priority
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#94a3b8] font-medium">
                                        (Không có ảnh bìa)
                                    </div>
                                )}
                            </div>

                            {/* HTML TipTap Render Content */}
                            <div
                                className="prose prose-lg max-w-none prose-slate"
                                dangerouslySetInnerHTML={{ __html: post.content || '' }}
                            />

                            {/* Article Footer & Share */}
                            <div className="mt-12 pt-8 border-t border-[#f1f5f9] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-[#0f172a]">Chia sẻ:</span>
                                    <button className="w-10 h-10 rounded-full border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:border-[#15803d] hover:text-[#15803d] transition-colors press-effect">
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                    {/* Có thể add Facebook, Zalo share icons */}
                                </div>
                            </div>

                        </article>

                        {/* Related Posts */}
                        {relatedPosts.length > 0 && (
                            <div className="mt-16">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-2xl font-bold text-[#111827]">Bài viết liên quan</h3>
                                    <Link href={`/blog/${categorySlug}`} className="text-[#15803d] font-semibold text-sm hover:underline">
                                        Xem tất cả chuyên mục
                                    </Link>
                                </div>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {relatedPosts.map(p => (
                                        <PostCard key={p.id} post={p} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Right */}
                    <div className="lg:w-[30%]">
                        {/* Sticky TOC Widget */}
                        <div className="sticky top-24">
                            {/* Client Component bóc tách H2/H3 nội dung */}
                            <TableOfContents htmlContent={post.content || ''} />

                            {/* Banner quảng cáo dọc nếu có */}
                            <div className="mt-6 rounded-2xl overflow-hidden relative h-[400px] border border-[#e2e8f0] bg-slate-100 group cursor-pointer shadow-sm hidden lg:block">
                                <div className="absolute inset-0 bg-[#0f172a]/40 group-hover:bg-[#0f172a]/30 transition-colors z-10" />
                                <div className="relative z-20 h-full flex flex-col items-center justify-center p-6 text-center text-white">
                                    <span className="bg-[#15803d] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded mb-4">Quảng cáo</span>
                                    <h4 className="text-2xl font-bold mb-3 leading-snug">Gạch Eurotile cao cấp</h4>
                                    <p className="text-sm text-slate-200 mb-6">Độc quyền phân phối tại Đà Lạt - Lâm Đồng.</p>
                                    <button className="bg-white text-[#0f172a] px-6 py-2.5 rounded-full font-semibold text-sm group-hover:scale-105 transition-transform">
                                        Xem ngay
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    )
}
