'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export function BlogSectionClient({ posts }: { posts: any[] }) {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const clientWidth = scrollRef.current.clientWidth
            const scrollAmount = direction === 'left' ? -clientWidth / 1.5 : clientWidth / 1.5
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

    if (!posts || posts.length === 0) return null

    return (
        <section className="py-20 bg-[#f8fafc] overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-5">
                {/* Header */}
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <h2 className="text-3xl lg:text-[40px] leading-tight font-bold text-[#111827] tracking-tight">
                            Tin tức & Cẩm nang
                        </h2>
                        <p className="text-[#4b5563] mt-3 text-lg">
                            Kinh nghiệm thi công và xu hướng thiết kế mới nhất
                        </p>
                    </div>
                    <div className="hidden md:flex gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-12 h-12 border-gray-300 text-gray-600 hover:text-[#15803d] hover:border-[#15803d]"
                            onClick={() => scroll('left')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-12 h-12 border-gray-300 text-gray-600 hover:text-[#15803d] hover:border-[#15803d]"
                            onClick={() => scroll('right')}
                        >
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Carousel Container */}
                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 -mx-5 px-5 md:mx-0 md:px-0 hide-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {posts.map((post) => (
                        <div key={post.id} className="snap-start shrink-0 w-[85vw] sm:w-[50vw] md:w-[calc(33.333%-16px)]">
                            <Link href={`/blog/${post.blog_categories?.slug}/${post.slug}`} className="group flex flex-col gap-4">
                                <div className="relative aspect-[4/3] rounded-[24px] overflow-hidden bg-gray-200">
                                    <Image
                                        src={post.thumbnail_url || '/images/hero-banner.jpg'}
                                        alt={post.title}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {post.blog_categories && (
                                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-[#15803d] uppercase tracking-wider">
                                            {post.blog_categories.name}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-gray-500">
                                        {format(new Date(post.created_at), "dd 'tháng' MM, yyyy", { locale: vi })}
                                    </p>
                                    <h3 className="text-xl font-bold text-[#111827] leading-tight group-hover:text-[#15803d] transition-colors line-clamp-2">
                                        {post.title}
                                    </h3>
                                    <p className="text-gray-600 line-clamp-2 leading-relaxed">
                                        {post.excerpt}
                                    </p>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
