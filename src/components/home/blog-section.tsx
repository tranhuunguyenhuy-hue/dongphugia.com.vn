import Link from 'next/link'
import prisma from '@/lib/prisma'
import { DeferredResponsiveMedia } from '@/components/media/deferred-responsive-media'
import { normalizePublishingMediaUrl } from '@/lib/publishing/media-url'

export const revalidate = 300

export async function BlogSection() {
    const posts = await prisma.blog_posts.findMany({
        where: { status: 'published', published_at: { lte: new Date() } },
        include: { blog_categories: true },
        orderBy: { created_at: 'desc' },
        take: 3
    })

    if (posts.length === 0) return null

    const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })

    return (
        <section className="bg-neutral-50 py-20 lg:py-28">
            <div className="mx-auto max-w-[1280px] px-5">
                <div className="mb-10 flex items-end justify-between">
                    <div>
                        <div className="mb-4 h-1 w-8 bg-[#2E7A96]" />
                        <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                            Tin tức &amp; Cẩm nang
                        </h2>
                        <p className="text-3xl font-medium leading-tight text-neutral-900 lg:text-[36px]">
                            Kinh nghiệm và xu hướng mới nhất
                        </p>
                    </div>
                    <Link
                        href="/blog"
                        className="hidden text-sm font-semibold text-[#2E7A96] hover:underline md:block"
                    >
                        Xem tất cả bài viết
                    </Link>
                </div>

                <div className="-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-8 md:mx-0 md:px-0">
                    {posts.map((post) => (
                        <article
                            key={post.id}
                            className="w-[85vw] shrink-0 snap-start sm:w-[50vw] md:w-[calc(33.333%-16px)]"
                        >
                            <Link
                                href={`/blog/${post.blog_categories?.slug}/${post.slug}`}
                                className="group flex flex-col gap-4"
                            >
                                <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-neutral-200">
                                    <DeferredResponsiveMedia
                                        src={normalizePublishingMediaUrl(post.thumbnail_url) || '/images/banner-1.editorial.w960.webp'}
                                        alt={post.title}
                                        fill
                                        profile="editorial"
                                        sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 33vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {post.blog_categories ? (
                                        <div className="absolute left-4 top-4 bg-white/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#2E7A96]">
                                            {post.blog_categories.name}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-gray-500">
                                        {dateFormatter.format(post.published_at ?? post.created_at)}
                                    </p>
                                    <h3 className="line-clamp-2 text-xl font-bold leading-tight text-[#192125] transition-colors group-hover:text-[#2E7A96]">
                                        {post.title}
                                    </h3>
                                    <p className="line-clamp-2 leading-relaxed text-gray-600">
                                        {post.excerpt}
                                    </p>
                                </div>
                            </Link>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}
