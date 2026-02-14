import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbLink,
} from "@/components/ui/breadcrumb";

export const revalidate = 3600;

interface BlogDetailProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogDetailProps) {
    const { slug } = await params;
    const post = await prisma.post.findUnique({ where: { slug } });

    if (!post) return { title: "Bài viết không tìm thấy" };

    return {
        title: `${post.title} | Đông Phú Gia`,
        description: post.content?.replace(/<[^>]*>/g, "").slice(0, 160),
    };
}

export default async function BlogDetailPage({ params }: BlogDetailProps) {
    const { slug } = await params;
    const post = await prisma.post.findUnique({ where: { slug } });

    if (!post || !post.isPublished) {
        notFound();
    }

    // Get related posts
    const relatedPosts = await prisma.post.findMany({
        where: {
            isPublished: true,
            id: { not: post.id },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="container mx-auto px-4 py-8">
            <Breadcrumb className="mb-6">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Trang chủ</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/tin-tuc">Tin tức</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{post.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <article className="max-w-3xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        {post.title}
                    </h1>
                    <time className="text-sm text-gray-500">
                        {new Date(post.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                        })}
                    </time>
                </header>

                {/* Thumbnail */}
                {post.thumbnail && (
                    <div className="aspect-[16/9] relative rounded-2xl overflow-hidden mb-10 bg-gray-100">
                        <Image
                            src={post.thumbnail}
                            alt={post.title}
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                )}

                {/* Content */}
                <div
                    className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-[#15803d]"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                />
            </article>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
                <section className="max-w-3xl mx-auto mt-16 pt-10 border-t">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Bài viết liên quan
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {relatedPosts.map((rp) => (
                            <Link
                                key={rp.id}
                                href={`/tin-tuc/${rp.slug}`}
                                className="group block"
                            >
                                <div className="aspect-[16/9] relative rounded-xl overflow-hidden bg-gray-100 mb-3">
                                    {rp.thumbnail ? (
                                        <Image
                                            src={rp.thumbnail}
                                            alt={rp.title}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                            Không có ảnh
                                        </div>
                                    )}
                                </div>
                                <h3 className="font-medium text-gray-900 group-hover:text-[#15803d] transition-colors line-clamp-2">
                                    {rp.title}
                                </h3>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
