import Link from 'next/link';
import { Suspense } from 'react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbLink,
} from '@/components/ui/breadcrumb';
import {
    getCategoryBySlug,
    getProductsByCategory,
    getAllCategories,
    getProductTypesByCategory,
    getCollectionsByCategory,
    getFilterValues,
    getProductTypeById,
    getCollectionById,
} from '@/lib/public-api';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ui/product-card';
import { PublicSidebar } from '@/components/layout/public-sidebar';
import { SubCategoryGrid } from '@/components/category/sub-category-grid';
import { CollectionCarousel } from '@/components/category/collection-carousel';
import { SmartFilter } from '@/components/category/smart-filter';

export const revalidate = 3600;

interface CategoryPageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
    const { slug } = await params;
    const category = await getCategoryBySlug(slug);

    if (!category) return { title: 'Không tìm thấy danh mục' };

    return {
        title: `${category.name} | Đông Phú Gia`,
        description:
            category.description ||
            `Mua ${category.name} chính hãng, giá tốt tại Đông Phú Gia.`,
    };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
    const { slug } = await params;
    const sp = await searchParams;
    const category = await getCategoryBySlug(slug);

    if (!category) {
        notFound();
    }

    // Fetch all data in parallel
    const [
        allCategories,
        productTypes,
        collections,
        filterValues,
        { products, total },
        activeProductType,
        activeCollection,
    ] = await Promise.all([
        getAllCategories(),
        getProductTypesByCategory(category.id),
        getCollectionsByCategory(category.id),
        getFilterValues(category.id),
        getProductsByCategory(slug, 1, 40, 'newest', {
            productTypeId: sp.productType,
            collectionId: sp.collection,
        }),
        sp.productType ? getProductTypeById(sp.productType) : Promise.resolve(null),
        sp.collection ? getCollectionById(sp.collection) : Promise.resolve(null),
    ]);

    // Determine effective product type (from URL or inferred from collection)
    const effectiveProductTypeId = sp.productType || activeCollection?.productType?.id;

    // Fetch active product type if we have an ID (either direct or inferred) but didn't fetch it yet
    const finalActiveProductType = activeProductType || (effectiveProductTypeId && !activeProductType ? await getProductTypeById(effectiveProductTypeId) : null);

    // Filter collections:
    // 1. If product type is selected (or inferred), show only collections of that type.
    // 2. Otherwise show all collections.
    const filteredCollections = collections.filter(c =>
        !effectiveProductTypeId || c.productType?.id === effectiveProductTypeId
    );

    return (
        <div className="relative min-h-screen">
            {/* Green gradient background */}
            <div className="absolute inset-x-0 top-0 h-[811px] bg-gradient-to-b from-[#dcfce7] to-white -z-10" />

            <div className="container mx-auto px-4 py-8">
                <div className="flex gap-8">
                    {/* ─────── Left Sidebar ─────── */}
                    <aside className="hidden lg:flex flex-col gap-8 w-[302px] shrink-0">
                        {/* Category Sidebar Card */}
                        {/* Category Sidebar Card */}
                        <PublicSidebar activeSlug={slug} />

                        {/* Smart Filter */}
                        <Suspense fallback={null}>
                            <SmartFilter
                                colors={filterValues.colors}
                                surfaces={filterValues.surfaces}
                                dimensions={filterValues.dimensions}
                            />
                        </Suspense>
                    </aside>

                    {/* ─────── Main Content ─────── */}
                    <main className="flex-1 flex flex-col gap-8 min-w-0">
                        {/* Breadcrumb */}
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="/">Trang chủ</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                {category.parent && (
                                    <>
                                        <BreadcrumbItem>
                                            <BreadcrumbLink href={`/danh-muc/${category.parent.slug}`}>
                                                {category.parent.name}
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                    </>
                                )}
                                <BreadcrumbItem>
                                    <BreadcrumbLink href={`/danh-muc/${category.slug}`} className={!finalActiveProductType && !activeCollection ? "text-[#15803d]" : ""}>
                                        {category.name}
                                    </BreadcrumbLink>
                                </BreadcrumbItem>

                                {finalActiveProductType && (
                                    <>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                            <BreadcrumbPage className={!activeCollection ? "text-[#15803d] font-medium" : ""}>
                                                {finalActiveProductType.name}
                                            </BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </>
                                )}

                                {activeCollection && (
                                    <>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                            <BreadcrumbPage className="text-[#15803d] font-medium">
                                                {activeCollection.name}
                                            </BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </>
                                )}
                            </BreadcrumbList>
                        </Breadcrumb>

                        {/* Sub-category Grid */}
                        {productTypes.length > 0 && (
                            <SubCategoryGrid
                                categoryName={category.name}
                                categorySlug={slug}
                                activeId={sp.productType}
                                productTypes={productTypes.map((pt) => ({
                                    id: pt.id,
                                    name: pt.name,
                                    slug: pt.slug,
                                    image: pt.image,
                                    _count: pt._count,
                                }))}
                                title={
                                    slug === 'gach-op-lat' && !sp.productType ? (
                                        <>
                                            Vui lòng chọn{' '}
                                            <span className="font-bold text-[#15803d]">loại gạch</span>
                                            {' '}cần thiết
                                        </>
                                    ) : (
                                        <>
                                            Khám phá{' '}
                                            <span className="font-bold text-[#15803d]">{category.name}</span>
                                        </>
                                    )
                                }
                            />
                        )}

                        {/* Collection Carousel */}
                        {filteredCollections.length > 0 && (
                            <CollectionCarousel
                                categoryName={category.name}
                                activeId={sp.collection}
                                categorySlug={slug}
                                collections={filteredCollections.map((c) => ({
                                    id: c.id,
                                    name: c.name,
                                    slug: c.slug,
                                    image: c.image,
                                    productTypeId: c.productType?.id,
                                }))}
                            />
                        )}

                        {/* Product Grid */}
                        <div className="flex flex-col gap-6">
                            <h2 className="text-2xl font-semibold text-[#111827] tracking-tight">
                                Tất cả{' '}
                                <span className="font-bold text-[#15803d]">sản phẩm</span>
                                {' '}{category.name}
                            </h2>

                            {products.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
                                    {products.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl">
                                    Chưa có sản phẩm nào trong danh mục này.
                                </div>
                            )}

                            {total > 0 && (
                                <p className="text-sm text-gray-500 text-center mt-2">
                                    Hiển thị {products.length} / {total} sản phẩm
                                </p>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
