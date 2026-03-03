import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

export interface ProductCardProps {
    product: any;
    showPrice?: boolean;
    patternSlug?: string;
    basePath?: string;
}

export function ProductCard({ product, showPrice = true, patternSlug, basePath = '/gach-op-lat' }: ProductCardProps) {
    const isTBVS = basePath.includes('/thiet-bi-ve-sinh');
    const isBep = basePath.includes('/thiet-bi-bep');
    const isNuoc = basePath.includes('/vat-lieu-nuoc');
    const isSango = basePath.includes('/san-go');

    let slug = patternSlug;
    if (!slug) {
        if (isTBVS) slug = product.tbvs_product_types?.slug;
        else if (isBep) slug = product.bep_product_types?.slug;
        else if (isNuoc) slug = product.nuoc_product_types?.slug;
        else if (isSango) slug = product.sango_product_types?.slug;
        else slug = product.pattern_types?.slug;
    }
    if (!slug) {
        if (basePath === '/gach-op-lat') slug = 'gach-op-lat';
        else slug = 'all';
    }

    const href = `${basePath}/${slug}/${product.slug}`;

    let images: string[] = [];
    try {
        images = product.images ? JSON.parse(product.images as string) : [];
    } catch { /* ignore */ }
    const firstImage = product.image_main_url || product.thumbnail || (images.length > 0 ? images[0] : null);

    // Parse specs for display
    let specs: any = {};
    try {
        if (product.specs) specs = JSON.parse(product.specs as string);
    } catch { /* ignore */ }

    // Use specific properties based on Category
    let collectionName = '';
    let dimensionText = '';
    let surfaceText = '';

    if (isTBVS) {
        collectionName = product.tbvs_brands?.name;
        dimensionText = product.tbvs_subtypes?.name;
        surfaceText = product.tbvs_materials?.name;
    } else if (isBep) {
        collectionName = product.bep_brands?.name;
        dimensionText = product.bep_subtypes?.name;
    } else if (isNuoc) {
        collectionName = product.nuoc_brands?.name;
        dimensionText = product.nuoc_subtypes?.name;
        surfaceText = product.nuoc_materials?.name;
    } else if (isSango) {
        collectionName = product.origins?.name;
        dimensionText = product.thickness_mm ? `${product.thickness_mm}mm` : (product.width_mm && product.length_mm ? `${product.width_mm}x${product.length_mm}` : '');
        surfaceText = product.ac_rating;
    } else {
        collectionName = product.collection?.name || product.collections?.name;
        dimensionText = product.dimensions || specs.dimensions || specs.simDimensions || product.sizes?.label;
        surfaceText = product.surface || specs.surface || product.surfaces?.name;
    }

    return (
        <Link href={href} className="group flex flex-col gap-6 w-full">
            {/* Product Image — 1:1 ratio */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-[0px_2px_6px_0px_rgba(16,24,40,0.06)] bg-white group-hover:shadow-lg transition-shadow">
                <div className="relative w-full h-full bg-gray-50 flex items-center justify-center">
                    {firstImage ? (
                        firstImage.includes('vietceramics.com') ? (
                            <img
                                src={firstImage}
                                alt={product.name}
                                className="absolute inset-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <Image
                                src={firstImage}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                className="object-cover transition-transform duration-500 group-hover:scale-105 mix-blend-multiply"
                                unoptimized={firstImage.includes('vietceramics.com')}
                            />
                        )
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                            <span className="text-2xl">📦</span>
                            <span className="text-[12px] font-medium uppercase tracking-wider">No Image</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-3 w-full">
                {/* Product Name */}
                <h3 className="font-semibold text-xl leading-7 text-[#111827] tracking-tight group-hover:text-[#15803d] transition-colors line-clamp-2">
                    {product.name}
                </h3>

                {/* Description: BST + Dimensions + Surface */}
                <div className="flex flex-col gap-1">
                    {/* Collection (BST) / Brand */}
                    {collectionName && (
                        <div className="flex gap-2 items-start text-lg text-[#4b5563]">
                            <span className="font-normal">{isTBVS ? 'Thương hiệu:' : 'BST:'}</span>
                            <span className="font-semibold truncate">{collectionName}</span>
                        </div>
                    )}

                    {/* Dimensions | Surface */}
                    {(dimensionText || surfaceText) && (
                        <div className="flex items-center gap-2 text-lg text-[#4b5563]">
                            {dimensionText && (
                                <span className="font-semibold truncate">{dimensionText}</span>
                            )}
                            {dimensionText && surfaceText && (
                                <span className="w-px h-5 bg-gray-300 rotate-0 shrink-0" />
                            )}
                            {surfaceText && (
                                <span className="font-semibold truncate">{surfaceText}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Price / CTA */}
                <div className="flex items-start gap-3">
                    {showPrice && product.showPrice && product.price ? (
                        <>
                            <span className="font-semibold text-xl text-[#ff383c] tracking-tight">
                                {formatPrice(Number(product.price))}
                            </span>
                            {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                                <span className="font-normal text-lg text-[#4b5563] line-through">
                                    {formatPrice(Number(product.originalPrice))}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="font-semibold text-xl text-[#111827] tracking-tight">
                            {product.price_display || 'Liên hệ báo giá'}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
