import Link from 'next/link';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbLink,
} from '@/components/ui/breadcrumb';
import { getProductBySlug, getRelatedProducts } from '@/lib/public-api';
import { notFound } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { ProductCard } from '@/components/ui/product-card';
import { Phone } from 'lucide-react';
import { ProductImageGallery } from '@/components/product/product-image-gallery';
import { ProductDetailTabs } from '@/components/product/product-detail-tabs';
import prisma from '@/lib/prisma';

export const revalidate = 3600;

interface ProductPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) return { title: 'Sản phẩm không tìm thấy' };

    return {
        title: `${product.name} | Đông Phú Gia`,
        description:
            product.description?.slice(0, 160) ||
            `Mua ${product.name} chính hãng, giá tốt.`,
    };
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) {
        notFound();
    }

    const images: string[] = JSON.parse(product.images as string);
    const specs: Record<string, string> = product.specs
        ? JSON.parse(product.specs as string)
        : {};
    const related = await getRelatedProducts(product.categoryId, product.id);

    // Fetch sibling products (same collection) for the variant chips
    let siblingProducts: { id: string; name: string; slug: string; sku: string | null }[] = [];
    if (product.collectionId) {
        siblingProducts = await prisma.product.findMany({
            where: {
                collectionId: product.collectionId,
                isPublished: true,
            },
            select: { id: true, name: true, slug: true, sku: true },
            orderBy: { name: 'asc' },
        });
    }

    // Spec rows matching Figma order
    // Spec rows matching Figma order
    const specRows = [
        { label: 'Bộ sưu tập', value: product.collection?.name },
        { label: 'Số vân', value: product.patternCount?.toString() || specs.soVan || specs.numPatterns },
        { label: 'Quy cách', value: product.dimensions || specs.dimensions || specs.quyCach },
        { label: 'Kích thước mô phỏng', value: product.simDimensions || specs.simDimensions || specs.kichThuocMoPhong },
        { label: 'Bề mặt', value: product.surface || specs.surface || specs.beMat },
        { label: 'Xuất xứ', value: product.origin || specs.origin || specs.xuatXu },
        { label: 'Độ chống trượt', value: product.antiSlip || specs.antiSlip || specs.doChongTruot },
    ].filter((r) => r.value) as { label: string; value: string }[];

    // Color info
    const colorName = product.colorName || specs.color || specs.mauSac;
    const colorHex = (product as any).colorHex || specs.colorHex || '#3b82f6';

    // Product info for tabs
    const productInfo = {
        material: (product as any).material || null,
        thickness: (product as any).thickness || null,
        waterAbsorption: (product as any).waterAbsorption || null,
        usage: (product as any).usage || null,
    };

    return (
        <div className="relative min-h-screen">
            {/* Green gradient background */}
            <div className="absolute inset-x-0 top-0 h-[500px] sm:h-[650px] lg:h-[811px] bg-gradient-to-b from-[#dcfce7] to-white -z-10" />

            <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-[80px] py-6 sm:py-8">
                {/* ─── Breadcrumb ─── */}
                <Breadcrumb className="mb-6 sm:mb-8">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="/">Trang chủ</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        {product.category.parent && (
                            <>
                                <BreadcrumbItem>
                                    <BreadcrumbLink
                                        href={`/danh-muc/${product.category.parent.slug}`}
                                    >
                                        {product.category.parent.name}
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                            </>
                        )}
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/danh-muc/${product.category.slug}`}>
                                {product.category.name}
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        {product.productType && (
                            <>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href={`/danh-muc/${product.category.slug}?productType=${product.productType.id}`}>
                                        {product.productType.name}
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                            </>
                        )}

                        <BreadcrumbItem>
                            <BreadcrumbPage className="text-[#15803d] font-medium">
                                {product.name}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                {/* ─── Product Detail: Responsive 2-column ─── */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 mb-12 lg:mb-16">
                    {/* Left: Image Gallery */}
                    <div className="w-full lg:w-[628px] lg:shrink-0">
                        <ProductImageGallery images={images} productName={product.name} />
                    </div>

                    {/* Right: Product Info */}
                    <div className="flex-1 flex flex-col gap-5 lg:max-w-[628px]">
                        {/* Title */}
                        <h1 className="font-semibold text-[24px] sm:text-[28px] lg:text-[32px] leading-[32px] sm:leading-[36px] lg:leading-[40px] tracking-[-0.64px] text-[#111827]">
                            {product.name}
                        </h1>

                        {/* Price Card — gradient */}
                        <div
                            className="border border-[#16a34a] rounded-[16px] sm:rounded-[20px] px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-1"
                            style={{
                                backgroundImage:
                                    'linear-gradient(-86.99deg, #FCFDEE 15.08%, #BBF7D0 99.86%)',
                            }}
                        >
                            <p className="font-semibold text-[16px] sm:text-[18px] leading-[24px] sm:leading-[28px] text-[#16a34a]">
                                Giá sản phẩm
                            </p>
                            <p className="font-semibold text-[22px] sm:text-[28px] leading-[28px] sm:leading-[36px] tracking-[-0.56px] text-[#15803d]">
                                {product.showPrice && product.price
                                    ? formatPrice(Number(product.price))
                                    : 'Liên hệ báo giá'}
                            </p>
                            {product.showPrice &&
                                product.originalPrice &&
                                Number(product.originalPrice) > Number(product.price) && (
                                    <p className="font-normal text-[16px] sm:text-[18px] text-[#6b7280] line-through">
                                        {formatPrice(Number(product.originalPrice))}
                                    </p>
                                )}
                        </div>

                        {/* SKU Variant Chips */}
                        {siblingProducts.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <h2 className="font-semibold text-[20px] sm:text-[24px] leading-[28px] sm:leading-[32px] tracking-[-0.48px] text-[#1f2937]">
                                    Mã sản phẩm:
                                </h2>
                                <div className="flex gap-3 sm:gap-5 flex-wrap">
                                    {siblingProducts.map((sp) => {
                                        const isActive = sp.id === product.id;
                                        return (
                                            <Link
                                                key={sp.id}
                                                href={`/san-pham/${sp.slug}`}
                                                className={`
                                                    flex items-center justify-center p-2 sm:p-3 rounded-[8px] border
                                                    font-medium text-[14px] sm:text-[16px] leading-[18px] 
                                                    transition-colors
                                                    ${isActive
                                                        ? 'bg-[#f0fdf4] border-[#16a34a] text-[#6b7280]'
                                                        : 'border-[#d1d5db] text-[#6b7280] hover:border-[#16a34a] hover:bg-[#f0fdf4]'
                                                    }
                                                `}
                                            >
                                                {sp.sku || sp.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Color Selector */}
                        {colorName && (
                            <div className="flex flex-col gap-3">
                                <h2 className="font-semibold text-[20px] sm:text-[24px] leading-[28px] sm:leading-[32px] tracking-[-0.48px] text-[#1f2937]">
                                    Màu sắc:
                                </h2>
                                <div className="flex gap-5 items-center">
                                    <div className="flex flex-col gap-2 items-center">
                                        <div
                                            className="w-10 h-10 rounded-full border-2 border-[#16a34a]"
                                            style={{ backgroundColor: colorHex }}
                                        />
                                        <span className="font-medium text-[16px] leading-[24px] text-[#16a34a]">
                                            {colorName}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Specs Table */}
                        {specRows.length > 0 && (
                            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[12px] px-4 py-3 flex flex-col gap-2">
                                {specRows.map((row, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between gap-4"
                                    >
                                        <span className="font-medium text-[14px] sm:text-[16px] leading-[24px] text-[#111827]">
                                            {row.label}
                                        </span>
                                        <span className="font-normal text-[14px] sm:text-[16px] leading-[24px] text-[#374151] text-right">
                                            {row.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* CTA Button */}
                        <a
                            href="tel:02633520316"
                            className="flex items-center justify-center gap-2 bg-[#15803d] border border-[#15803d] text-white rounded-[12px] px-5 py-[14px] shadow-[0px_2px_6px_0px_rgba(16,24,40,0.06)] hover:bg-[#166534] transition-colors w-full"
                        >
                            <Phone className="h-5 w-5" />
                            <span className="font-medium text-[16px] leading-[18px]">
                                Liên hệ tư vấn ngay
                            </span>
                        </a>
                    </div>
                </div>

                {/* ─── Description Tabs (Interactive) ─── */}
                <ProductDetailTabs
                    description={product.description}
                    specRows={specRows}
                    productInfo={productInfo}
                />

                {/* ─── Related Products ─── */}
                {related.length > 0 && (
                    <section className="border-t border-gray-200 pt-8 sm:pt-12">
                        <h2 className="font-semibold text-[20px] sm:text-[24px] leading-[28px] sm:leading-[32px] tracking-[-0.48px] text-[#1f2937] mb-6 sm:mb-8">
                            Sản phẩm liên quan
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                            {related.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
