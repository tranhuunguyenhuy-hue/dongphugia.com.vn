import Link from 'next/link';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbLink,
} from '@/components/ui/breadcrumb';
import { getCollectionBySlug } from '@/lib/public-api';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ui/product-card';

export const revalidate = 3600;

interface CollectionPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CollectionPageProps) {
    const { slug } = await params;
    const collection = await getCollectionBySlug(slug);

    if (!collection) return { title: 'Bộ sưu tập không tìm thấy' };

    return {
        title: `${collection.name} | Đông Phú Gia`,
        description: `Khám phá bộ sưu tập ${collection.name} tại Đông Phú Gia.`,
    };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
    const { slug } = await params;
    const collection = await getCollectionBySlug(slug);

    if (!collection) {
        notFound();
    }

    const category = collection.productType?.category;

    return (
        <div className="container mx-auto px-4 py-8">
            <Breadcrumb className="mb-6">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Trang chủ</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    {category && (
                        <>
                            <BreadcrumbItem>
                                <BreadcrumbLink href={`/danh-muc/${category.slug}`}>
                                    {category.name}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                        </>
                    )}
                    <BreadcrumbItem>
                        <BreadcrumbPage>{collection.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="mb-10">
                <h1 className="text-3xl font-bold text-[#14532d] mb-2">
                    Bộ sưu tập: {collection.name}
                </h1>
                {collection.productType && (
                    <p className="text-gray-500">
                        Loại sản phẩm: {collection.productType.name}
                    </p>
                )}
            </div>

            {collection.products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {collection.products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl">
                    Chưa có sản phẩm nào trong bộ sưu tập này.
                </div>
            )}
        </div>
    );
}
