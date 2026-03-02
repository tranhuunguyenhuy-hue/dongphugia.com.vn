import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PostCard, BlogPost } from '@/components/blog/post-card'

// --- MOCK DATA ---
const MOCK_CATEGORIES = [
    { name: 'Tin tức', slug: 'tin-tuc' },
    { name: 'Kiến thức', slug: 'kien-thuc' },
    { name: 'Hướng dẫn chọn', slug: 'huong-dan-chon' },
    { name: 'Dự án', slug: 'du-an' },
    { name: 'Xu hướng', slug: 'xu-huong' },
]

const MOCK_TAGS = [
    { name: 'Gạch ốp lát', slug: 'gach-op-lat' },
    { name: 'Thiết kế nội thất', slug: 'thiet-ke-noi-that' },
    { name: 'Sàn gỗ công nghiệp', slug: 'san-go-cong-nghiep' },
    { name: 'Phong thủy', slug: 'phong-thuy' },
    { name: 'Nhà cấp 4', slug: 'nha-cap-4' },
]

const MOCK_POSTS: BlogPost[] = [
    {
        id: 1,
        title: 'Xu hướng thiết kế nội thất phòng tắm hiện đại năm 2026',
        slug: 'xu-huong-thiet-ke-noi-that-phong-tam-hien-dai-nam-2026',
        excerpt: 'Khám phá những xu hướng thiết kế phòng tắm mới nhất, tập trung vào sự tối giản, công năng và vật liệu thân thiện môi trường để tạo ra không gian thư giãn hoàn hảo tại nhà.',
        cover_image_url: null, // Sẽ fallback text
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
        title: 'Phân biệt Sàn gỗ tự nhiên và Sàn gỗ công nghiệp: Đâu là lựa chọn tối ưu?',
        slug: 'phan-biet-san-go-tu-nhien-va-san-go-cong-nghiep',
        excerpt: 'Cùng phân tích ưu nhược điểm chi tiết của hai loại sàn gỗ phổ biến nhất hiện nay để đưa ra quyết định đầu tư đúng đắn cho tổ ấm của bạn.',
        cover_image_url: null,
        published_at: new Date('2026-02-25T14:15:00Z'),
        view_count: 2100,
        blog_categories: { name: 'Kiến thức', slug: 'kien-thuc' },
    },
    {
        id: 4,
        title: 'Top 5 thương hiệu thiết bị vệ sinh cao cấp đáng mua nhất',
        slug: 'top-5-thuong-hieu-thiet-bi-ve-sinh-cao-cap',
        excerpt: 'Tổng hợp đánh giá khách quan về 5 thương hiệu thiết bị vệ sinh hàng đầu thế giới đang được phân phối chính hãng tại hệ thống Đông Phú Gia.',
        cover_image_url: null,
        published_at: new Date('2026-02-20T09:00:00Z'),
        view_count: 560,
        blog_categories: { name: 'Tin tức', slug: 'tin-tuc' },
    },
    {
        id: 5,
        title: 'Nghiệm thu dự án Villa Đà Lạt: Vẻ đẹp đương đại từ Gạch Eurotile',
        slug: 'nghiem-thu-du-an-villa-da-lat-gach-eurotile',
        excerpt: 'Hình ảnh thực tế công trình biệt thự cao cấp tại Đà Lạt sử dụng toàn bộ hệ sinh thái sản phẩm từ Đông Phú Gia, điểm nhấn là bộ sưu tập Eurotile.',
        cover_image_url: null,
        published_at: new Date('2026-02-15T16:45:00Z'),
        view_count: 3200,
        blog_categories: { name: 'Dự án', slug: 'du-an' },
    }
]
// --- END MOCK DATA ---

export const metadata = {
    title: 'Blog & Tin tức | Đông Phú Gia',
    description: 'Cập nhật kiến thức, xu hướng thiết kế nội thất, hướng dẫn chọn vật liệu xây dựng và thông tin dự án mới nhất từ Đông Phú Gia Đà Lạt.',
}

export default function BlogHomePage() {
    const featuredPost = MOCK_POSTS[0]
    const recentPosts = MOCK_POSTS.slice(1)

    return (
        <div className="bg-white min-h-screen">
            {/* Top Banner */}
            <div className="bg-[#f8fafc] border-b border-[#e2e8f0] py-12 lg:py-16">
                <div className="max-w-[1280px] mx-auto px-5 text-center">
                    <h1 className="text-3xl lg:text-5xl font-bold text-[#0f172a] mb-4 tracking-tight">
                        Góc chia sẻ <span className="text-[#15803d]">Đông Phú Gia</span>
                    </h1>
                    <p className="text-[#64748b] text-lg max-w-2xl mx-auto">
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
                            <h2 className="text-2xl font-bold text-[#111827]">Bài viết nổi bật</h2>
                        </div>
                        {featuredPost && <PostCard post={featuredPost} featured={true} />}
                    </section>

                    {/* Recent Posts Grid */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-[#111827]">Mới cập nhật</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                            {recentPosts.map(post => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    </section>

                    {/* Load More Button (Dummy) */}
                    <div className="flex justify-center mt-4">
                        <button className="px-6 py-3 rounded-xl border border-[#e2e8f0] text-[#4b5563] font-medium hover:bg-[#f8fafc] transition-colors press-effect">
                            Xem thêm bài viết
                        </button>
                    </div>
                </div>

                {/* Sidebar (Right) */}
                <aside className="lg:w-[30%] flex flex-col gap-8">

                    {/* Categories Widget */}
                    <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0]">
                        <h3 className="text-lg font-bold text-[#111827] mb-4 pb-4 border-b border-[#cbd5e1]">
                            Chuyên mục
                        </h3>
                        <ul className="flex flex-col gap-3">
                            {MOCK_CATEGORIES.map(cat => (
                                <li key={cat.slug}>
                                    <Link
                                        href={`/blog/${cat.slug}`}
                                        className="flex items-center justify-between group"
                                    >
                                        <span className="text-[#4b5563] group-hover:text-[#15803d] font-medium transition-colors">
                                            {cat.name}
                                        </span>
                                        <div className="w-6 h-6 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center group-hover:border-[#15803d] group-hover:bg-[#f0fdf4] transition-colors">
                                            <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:text-[#15803d]" />
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Tags Widget */}
                    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm">
                        <h3 className="text-lg font-bold text-[#111827] mb-4 pb-4 border-b border-[#f1f5f9]">
                            Từ khóa phổ biến
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {MOCK_TAGS.map(tag => (
                                <Link
                                    key={tag.slug}
                                    href={`/blog/tag/${tag.slug}`}
                                    className="bg-[#f1f5f9] text-[#4b5563] hover:bg-[#15803d] hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                                >
                                    #{tag.name}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Banner CTA Widget */}
                    <div className="rounded-2xl overflow-hidden relative h-[300px] flex flex-col justify-end p-6 border border-[#e2e8f0]">
                        {/* Background Image Placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#16a34a] to-[#14532d] z-0" />
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
                                <button className="bg-white text-[#15803d] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors press-effect">
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
