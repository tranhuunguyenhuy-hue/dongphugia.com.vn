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
        <Link href={href} className="group flex flex-col w-full h-full rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-neutral-300 transition-all duration-300 relative">
            {/* Product Image — 1:1 ratio full top bleed */}
            <div className="relative w-full aspect-square bg-neutral-50 overflow-hidden shrink-0">
                {firstImage ? (
                    firstImage.includes('vietceramics.com') ? (
                        <img
                            src={firstImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        <Image
                            src={firstImage}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                            unoptimized={firstImage.includes('vietceramics.com')}
                        />
                    )
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                        <span className="text-xs font-medium uppercase tracking-wider">No Image</span>
                    </div>
                )}
                
                {/* Badges */}
                {(product.is_new || product.is_bestseller) && (
                    <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                        {product.is_new && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-white text-blue-600 rounded-md shadow-sm border border-neutral-200">
                                Mới
                            </span>
                        )}
                        {product.is_bestseller && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-white text-neutral-800 rounded-md shadow-sm border border-neutral-200">
                                Best
                            </span>
                        )}
                    </div>
                )}

                {/* Quick Expand Button overlay (Hover state) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                    <div className="bg-white/90 backdrop-blur-[2px] p-2 rounded-full shadow-sm text-neutral-700">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col p-4 w-full flex-grow">
                {/* Brand + Bookmark */}
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-neutral-500 truncate pr-2 capitalize">
                        {collectionName || (isSango ? 'Sàn gỗ' : (isTBVS ? 'Thiết bị vệ sinh' : 'Đông Phú Gia'))}
                    </span>
                    <div className="text-neutral-300 hover:text-blue-600 transition-colors z-10 shrink-0 cursor-pointer" aria-label="Save product">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-[15px] leading-snug text-neutral-900 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2">
                    {product.name}
                </h3>

                {/* Grow empty space to push specs & price to bottom so cards have equal height content */}
                <div className="mt-auto"></div>

                {/* Extra Specs */}
                {(dimensionText || surfaceText) && (
                    <div className="flex items-center gap-1.5 text-[12px] text-neutral-500 mt-2.5">
                        {dimensionText && <span className="truncate">{dimensionText}</span>}
                        {dimensionText && surfaceText && <span className="text-neutral-300">•</span>}
                        {surfaceText && <span className="truncate">{surfaceText}</span>}
                    </div>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-1.5 mt-2.5">
                    {showPrice && product.showPrice && product.price ? (
                        <>
                            <span className="text-[13px] text-neutral-500 font-medium tracking-tight">Từ</span>
                            <span className="font-semibold text-[15px] text-neutral-900 tracking-tight">
                                {formatPrice(Number(product.price))}
                            </span>
                            {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                                <span className="font-normal text-[12px] text-neutral-400 line-through ml-0.5">
                                    {formatPrice(Number(product.originalPrice))}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="font-semibold text-[15px] text-neutral-900 tracking-tight">
                            {product.price_display || 'Liên hệ báo giá'}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
