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
        <section className="py-20 lg:py-28 bg-neutral-50 overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-5">
                {/* Header */}
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <div className="h-1 w-8 bg-[#2E7A96] mb-4" />
                        <h2 className="text-[13px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-2">
                            Tin tức & Cẩm nang
                        </h2>
                        <p className="text-3xl lg:text-[36px] leading-tight font-medium text-neutral-900">
                            Kinh nghiệm và xu hướng mới nhất
                        </p>
                    </div>
                    <div className="hidden md:flex gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-sm w-12 h-12 border-neutral-300 text-neutral-600 hover:text-[#2E7A96] hover:border-[#2E7A96]"
                            onClick={() => scroll('left')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-sm w-12 h-12 border-neutral-300 text-neutral-600 hover:text-[#2E7A96] hover:border-[#2E7A96]"
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
                                <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-neutral-200">
                                    <Image
                                        src={post.thumbnail_url || '/images/hero-banner.jpg'}
                                        alt={post.title}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {post.blog_categories && (
                                        <div className="absolute top-4 left-4 bg-white/90 px-4 py-1.5 text-xs font-bold text-[#2E7A96] uppercase tracking-wider">
                                            {post.blog_categories.name}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-gray-500">
                                        {format(new Date(post.created_at), "dd 'tháng' MM, yyyy", { locale: vi })}
                                    </p>
                                    <h3 className="text-xl font-bold text-[#192125] leading-tight group-hover:text-[#2E7A96] transition-colors line-clamp-2">
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
