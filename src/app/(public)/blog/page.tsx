import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PostCard, BlogPost } from '@/components/blog/post-card'

import { getBlogPosts, getBlogCategories, getPopularTags } from '@/lib/public-api-blog'

export const revalidate = 3600

export const metadata = {
    title: 'Blog & Tin tức | Đông Phú Gia',
    description: 'Cập nhật kiến thức, xu hướng thiết kế nội thất, hướng dẫn chọn vật liệu xây dựng và thông tin dự án mới nhất từ Đông Phú Gia Đà Lạt.',
}

export default async function BlogPage() {
    const [{ posts }, categories, tags] = await Promise.all([
        getBlogPosts({ limit: 9 }),
        getBlogCategories(),
        getPopularTags(10)
    ])

    // Validate the array contains proper type (will be cast dynamically from DB)
    const featuredPost = posts[0] as unknown as BlogPost | undefined
    const recentPosts = posts.slice(1) as unknown as BlogPost[]

    return (
        <div className="bg-white min-h-screen">
            {/* Top Banner */}
            <div className="bg-[#F5F9FB] border-b border-[#E4EEF2] py-12 lg:py-16">
                <div className="max-w-[1280px] mx-auto px-5 text-center">
                    <h1 className="text-3xl lg:text-5xl font-bold text-[#192125] mb-4 tracking-tight">
                        Góc chia sẻ <span className="text-[#2E7A96]">Đông Phú Gia</span>
                    </h1>
                    <p className="text-[#6A8A97] text-lg max-w-2xl mx-auto">
                        Cập nhật xu hướng thiết kế, kiến thức chuyên sâu và bí quyết lựa chọn vật liệu xây dựng hoàn hảo cho không gian sống của bạn.
                    </p>
                </div>
            </div>

            <div className="max-w-[1280px] mx-auto px-5 py-12 lg:py-16 flex flex-col lg:flex-row gap-10">
                {/* Main Content (Left) */}
                <div className="lg:w-[70%] flex flex-col gap-12">

                    {/* Featured Post */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-[#192125]">Bài viết nổi bật</h2>
                        </div>
                        {featuredPost && <PostCard post={featuredPost} featured={true} />}
                    </section>

                    {/* Recent Posts Grid */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-[#192125]">Mới cập nhật</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                            {recentPosts.map(post => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    </section>

                    {/* Load More Button (Dummy) */}
                    <div className="flex justify-center mt-4">
                        <button className="px-6 py-3 rounded-xl border border-[#E4EEF2] text-[#516A74] font-medium hover:bg-[#F5F9FB] transition-colors press-effect">
                            Xem thêm bài viết
                        </button>
                    </div>
                </div>

                {/* Sidebar (Right) */}
                <aside className="lg:w-[30%] flex flex-col gap-8">

                    {/* Categories Widget */}
                    <div className="bg-[#F5F9FB] rounded-2xl p-6 border border-[#E4EEF2]">
                        <h3 className="text-lg font-bold text-[#192125] mb-4 pb-4 border-b border-[#C8D9E0]">
                            Chuyên mục
                        </h3>
                        <ul className="flex flex-col gap-3">
                            {categories.map(cat => (
                                <li key={cat.slug}>
                                    <Link
                                        href={`/blog/${cat.slug}`}
                                        className="flex items-center justify-between group"
                                    >
                                        <span className="text-[#516A74] group-hover:text-[#2E7A96] font-medium transition-colors">
                                            {cat.name}
                                        </span>
                                        <div className="w-6 h-6 rounded-full bg-white border border-[#E4EEF2] flex items-center justify-center group-hover:border-[#2E7A96] group-hover:bg-[#EAF6FB] transition-colors">
                                            <ChevronRight className="w-3.5 h-3.5 text-[#88A3AE] group-hover:text-[#2E7A96]" />
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Tags Widget */}
                    <div className="bg-white rounded-2xl p-6 border border-[#E4EEF2] shadow-sm">
                        <h3 className="text-lg font-bold text-[#192125] mb-4 pb-4 border-b border-[#F5F9FB]">
                            Từ khóa phổ biến
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Link
                                    key={tag.slug}
                                    href={`/blog/tag/${tag.slug}`}
                                    className="bg-[#F5F9FB] text-[#516A74] hover:bg-[#2E7A96] hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                                >
                                    #{tag.name}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Banner CTA Widget */}
                    <div className="rounded-2xl overflow-hidden relative h-[300px] flex flex-col justify-end p-6 border border-[#E4EEF2]">
                        {/* Background Image Placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#2E7A96] to-[#0F2E3A] z-0" />
                        <div className="relative z-10 text-white">
                            <h3 className="text-xl font-bold mb-2">Đăng ký nhận tin</h3>
                            <p className="text-sm text-green-50 mb-4 opacity-90">
                                Nhận những bài biết và xu hướng mới nhất hàng tuần qua email của bạn.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="Email..."
                                    className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                                />
                                <button className="bg-white text-[#2E7A96] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors press-effect">
                                    Gửi
                                </button>
                            </div>
                        </div>
                    </div>

                </aside>

            </div>
        </div>
)
}
