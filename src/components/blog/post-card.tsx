import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, ArrowRight } from 'lucide-react'

export interface BlogPost {
    id: number
    title: string
    slug: string
    excerpt: string | null
    cover_image_url: string | null
    published_at: Date
    view_count: number
    author_id?: number | null
    blog_categories: {
        name: string
        slug: string
    }
}

interface PostCardProps {
    post: BlogPost
    featured?: boolean
}

function formatDate(date: Date | string) {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })
}

export function PostCard({ post, featured = false }: PostCardProps) {
    const postUrl = `/blog/${post.blog_categories.slug}/${post.slug}`

    if (featured) {
        return (
            <div className="group relative rounded-2xl overflow-hidden bg-white shadow-sm border border-[#E4EEF2] card-hover flex flex-col md:flex-row">
                <div className="relative w-full md:w-[60%] h-[300px] md:h-[400px] overflow-hidden bg-slate-100">
                    {post.cover_image_url ? (
                        <Image
                            src={post.cover_image_url}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 60vw"
                        />
                    ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-400">Không có ảnh</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col justify-center p-6 md:p-10 md:w-[40%]">
                    <div className="flex items-center gap-3 mb-4">
                        <Link
                            href={`/blog/${post.blog_categories.slug}`}
                            className="bg-[#C5E8F5] text-[#2E7A96] px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-[#C5E8F5] transition-colors"
                        >
                            {post.blog_categories.name}
                        </Link>
                        <span className="text-sm text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {formatDate(post.published_at)}
                        </span>
                    </div>

                    <Link href={postUrl} className="block group-hover:text-[#2E7A96] transition-colors">
                        <h3 className="text-2xl md:text-3xl font-bold text-[#192125] mb-4 leading-tight line-clamp-3">
                            {post.title}
                        </h3>
                    </Link>

                    {post.excerpt && (
                        <p className="text-slate-600 mb-6 line-clamp-3 leading-relaxed">
                            {post.excerpt}
                        </p>
                    )}

                    <Link href={postUrl} className="inline-flex items-center gap-2 text-[#2E7A96] font-semibold text-sm mt-auto w-fit hover:gap-3 transition-all">
                        Xem chi tiết <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#E4EEF2] card-hover shadow-sm h-full">
            <Link href={postUrl} className="relative w-full h-[220px] overflow-hidden bg-slate-100 block">
                {post.cover_image_url ? (
                    <Image
                        src={post.cover_image_url}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                    />
                ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <span className="text-slate-400">Không có ảnh</span>
                    </div>
                )}
            </Link>

            <div className="flex flex-col flex-1 p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <Link
                        href={`/blog/${post.blog_categories.slug}`}
                        className="text-[#2E7A96] text-xs font-semibold uppercase tracking-wider hover:underline"
                    >
                        {post.blog_categories.name}
                    </Link>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(post.published_at)}
                    </span>
                </div>

                <Link href={postUrl} className="block mb-3">
                    <h3 className="text-[18px] font-bold text-[#192125] leading-tight line-clamp-2 group-hover:text-[#2E7A96] transition-colors">
                        {post.title}
                    </h3>
                </Link>

                {post.excerpt && (
                    <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed flex-1">
                        {post.excerpt}
                    </p>
                )}

                <div className="mt-auto pt-4 border-t border-[#F5F9FB] flex items-center justify-between">
                    <Link href={postUrl} className="text-[#2E7A96] font-medium text-sm hover:underline">
                        Đọc tiếp
                    </Link>
                    {post.view_count > 0 && (
                        <span className="text-xs text-slate-400 font-medium">
                            {post.view_count} lượt xem
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
