import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PostCard, BlogPost } from '@/components/blog/post-card'

// --- MOCK DATA ---
const MOCK_CATEGORIES = [
    { name: 'Tin tức', slug: 'tin-tuc', desc: 'Bản tin nóng hổi về thị trường vật liệu xây dựng và hoạt động của Đông Phú Gia.' },
    { name: 'Kiến thức', slug: 'kien-thuc', desc: 'Tổng hợp kiến thức chuyên sâu về thiết kế nội thất và thi công xây dựng.' },
    { name: 'Hướng dẫn chọn', slug: 'huong-dan-chon', desc: 'Bí quyết lựa chọn vật liệu hoàn hảo cho từng không gian sống.' },
    { name: 'Dự án', slug: 'du-an', desc: 'Chiêm ngưỡng các công trình thực tế sử dụng sản phẩm từ Đông Phú Gia.' },
    { name: 'Xu hướng', slug: 'xu-huong', desc: 'Cập nhật phong cách thiết kế thời thượng nhất trong nước và quốc tế.' },
]

const MOCK_POSTS: BlogPost[] = [
    {
        id: 1,
        title: 'Xu hướng thiết kế nội thất phòng tắm hiện đại năm 2026',
        slug: 'xu-huong-thiet-ke-noi-that-phong-tam-hien-dai-nam-2026',
        excerpt: 'Khám phá những xu hướng thiết kế phòng tắm mới nhất, tập trung vào sự tối giản, công năng và vật liệu thân thiện môi trường để tạo ra không gian thư giãn hoàn hảo tại nhà.',
        cover_image_url: null,
        published_at: new Date('2026-03-01T08:00:00Z'),
        view_count: 1250,
        blog_categories: { name: 'Xu hướng', slug: 'xu-huong' },
    },
    {
        id: 2,
        title: 'Cách chọn gạch ốp lát cho không gian hẹp giúp nới rộng diện tích',
        slug: 'cach-chon-gach-op-lat-cho-khong-gian-hep',
        excerpt: 'Diện tích nhỏ không còn là rào cản nếu bạn biết cách phối hợp màu sắc và kích thước gạch ốp lát. Bài viết chia sẻ bí quyết từ chuyên gia Đông Phú Gia.',
        cover_image_url: null,
        published_at: new Date('2026-02-28T10:30:00Z'),
        view_count: 840,
        blog_categories: { name: 'Hướng dẫn chọn', slug: 'huong-dan-chon' },
    },
    {
        id: 3,
        title: 'Màu sơn dẫn đầu xu hướng năm nay bạn không thể bỏ lỡ',
        slug: 'mau-son-dan-dau-xu-huong',
        excerpt: 'Lựa chọn màu sơn phù hợp sẽ thay đổi hoàn toàn diện mạo ngôi nhà của bạn.',
        cover_image_url: null,
        published_at: new Date('2026-02-27T10:30:00Z'),
        view_count: 500,
        blog_categories: { name: 'Xu hướng', slug: 'xu-huong' },
    },
]
// --- END MOCK DATA ---

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }) {
    const { categorySlug } = await params
    const category = MOCK_CATEGORIES.find(c => c.slug === categorySlug)

    if (!category) return { title: 'Không tìm thấy chuyên mục' }

    return {
        title: `${category.name} | Blog Đông Phú Gia`,
        description: category.desc
    }
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
    const { categorySlug } = await params
    const category = MOCK_CATEGORIES.find(c => c.slug === categorySlug)

    if (!category) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center bg-white text-center px-5">
                <h1 className="text-3xl font-bold text-[#0f172a] mb-4">Không tìm thấy chuyên mục</h1>
                <Link href="/blog" className="text-[#15803d] font-medium hover:underline">Quay lại trang Blog</Link>
            </div>
        )
    }

    // Filter mock posts by category
    const categoryPosts = MOCK_POSTS.filter(p => p.blog_categories.slug === categorySlug)

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
                        {category.desc}
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

                {/* Pagination Dummy */}
                {categoryPosts.length > 3 && (
                    <div className="flex justify-center mt-12">
                        <nav className="flex items-center gap-2">
                            <button className="w-10 h-10 rounded-xl border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#15803d] transition-colors disabled:opacity-50">
                                1
                            </button>
                            <button className="w-10 h-10 rounded-xl bg-[#15803d] text-white flex items-center justify-center font-medium">
                                2
                            </button>
                            <span className="text-[#94a3b8]">...</span>
                            <button className="w-10 h-10 rounded-xl border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:bg-[#f8fafc] hover:text-[#15803d] transition-colors">
                                5
                            </button>
                        </nav>
                    </div>
                )}
            </div>
        </div>
    )
}
