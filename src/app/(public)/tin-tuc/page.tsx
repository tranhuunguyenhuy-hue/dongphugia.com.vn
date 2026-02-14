import prisma from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbLink,
} from "@/components/ui/breadcrumb";

export const metadata = {
    title: "Tin tức | Đông Phú Gia",
    description: "Tin tức, kiến thức về vật liệu xây dựng từ Đông Phú Gia.",
};

export const revalidate = 3600;

export default async function BlogPage() {
    const posts = await prisma.post.findMany({
        where: { isPublished: true },
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
                        <BreadcrumbPage>Tin tức</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <h1 className="text-3xl font-bold text-[#14532d] mb-8">Tin tức & Kiến thức</h1>

            {posts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {posts.map((post) => (
                        <Link
                            key={post.id}
                            href={`/tin-tuc/${post.slug}`}
                            className="group block"
                        >
                            <article className="bg-white rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow h-full flex flex-col">
                                <div className="aspect-[16/9] relative bg-gray-100">
                                    {post.thumbnail ? (
                                        <Image
                                            src={post.thumbnail}
                                            alt={post.title}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                            Không có ảnh
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 flex flex-col flex-1">
                                    <time className="text-xs text-gray-400 mb-2">
                                        {new Date(post.createdAt).toLocaleDateString("vi-VN", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                        })}
                                    </time>
                                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#15803d] transition-colors line-clamp-2 mb-3">
                                        {post.title}
                                    </h2>
                                    <p className="text-sm text-gray-500 line-clamp-3 flex-1">
                                        {post.content?.replace(/<[^>]*>/g, "").slice(0, 150)}...
                                    </p>
                                    <span className="mt-4 text-sm font-medium text-[#15803d] group-hover:underline">
                                        Đọc thêm →
                                    </span>
                                </div>
                            </article>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl">
                    Chưa có bài viết nào.
                </div>
            )}
        </div>
    );
}
