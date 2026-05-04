import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';

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

    let slug = patternSlug;
    if (!slug) {
        if (isTBVS) slug = product.tbvs_product_types?.slug;
        else if (isBep) slug = product.bep_product_types?.slug;
        else if (isNuoc) slug = product.nuoc_product_types?.slug;
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
    const firstImage = product.image_main_url || product.thumbnail || (images.length > 0 ? images[0] : null)
        const [imgSrc, setImgSrc] = useState(firstImage || "/images/assets-v2/hero-banner.png");
  
    useEffect(() => {
          setImgSrc(firstImage || "/images/assets-v2/hero-banner.png");
    }, [firstImage]);
  ;

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
        collectionName = product.brands?.name || product.tbvs_brands?.name;
        dimensionText = product.tbvs_subtypes?.name || product.subcategories?.name;
        surfaceText = product.tbvs_materials?.name || product.materials?.name;
    } else if (isBep) {
        collectionName = product.brands?.name || product.bep_brands?.name;
        dimensionText = product.bep_subtypes?.name || product.subcategories?.name;
    } else if (isNuoc) {
        collectionName = product.brands?.name || product.nuoc_brands?.name;
        dimensionText = product.nuoc_subtypes?.name || product.subcategories?.name;
        surfaceText = product.nuoc_materials?.name || product.materials?.name;
    } else {
        collectionName = product.brands?.name || product.collection?.name || product.collections?.name;
        dimensionText = product.dimensions || specs.dimensions || specs.simDimensions || product.sizes?.label;
    }
    const sku = product.sku || product.product_code || product.code || '';

    // Extract feature tags
    let featuresList: string[] = [];
    if (Array.isArray(product.product_feature_values)) {
        featuresList = product.product_feature_values
            .map((item: any) => item.product_features?.name)
            .filter(Boolean);
    }

    return (
        <Link href={href} className="group flex flex-col w-full h-full bg-white overflow-hidden transition-all duration-300 relative">
            {/* Product Image — full top bleed */}
            <div className="relative w-full aspect-square bg-[#F8F9FA] rounded-[12px] overflow-hidden shrink-0">
                {firstImage ? (
                    firstImage.includes('vietceramics.com') ? (
                        <img
                            src={imgSrc}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105" onError={() => setImgSrc("/images/assets-v2/hero-banner.png")}
                        />
                    ) : (
                        <Image
                            src={imgSrc    }                    alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                            unoptimized={firstImage.includes('vietceramics.com')}    onError={() => setImgSrc("/images/assets-v2/hero-banner.png")}        />
                    )
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                        <span className="text-xs font-medium uppercase tracking-wider">No Image</span>
                    </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 items-start">
                    {(product.is_new || product.is_bestseller) && (
                        <div className="flex gap-1.5">
                            {product.is_new && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-white text-blue-600 rounded-md shadow-sm border border-neutral-200">
                                    Mới
                                </span>
                            )}
                            {product.is_bestseller && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-red-500 text-white rounded-md shadow-sm border border-red-500/20">
                                    Nổi bật
                                </span>
                            )}
                        </div>
                    )}
                    {/* Discount Badge */}
                    {product.original_price && product.price && Number(product.original_price) > Number(product.price) && (
                        <span className="px-2 py-1 text-[11px] font-bold tracking-wider bg-[#E53935] text-white rounded-md shadow-md animate-in zoom-in duration-300">
                            -{Math.round(((Number(product.original_price) - Number(product.price)) / Number(product.original_price)) * 100)}%
                        </span>
                    )}
                </div>

                {/* Quick Expand Button overlay (Hover state) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                    <div className="bg-white/90 backdrop-blur-[2px] p-2 rounded-md shadow-sm text-neutral-700">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col pt-4 pb-2 w-full flex-grow">
                {/* Brand + SKU */}
                <div className="flex items-center justify-between mb-[6px] min-h-[20px]">
                    <span className="text-[11px] font-semibold text-neutral-400 truncate pr-2 uppercase tracking-widest flex-1">
                        {collectionName || (isTBVS ? 'Thiết bị vệ sinh' : 'Đông Phú Gia')}
                    </span>
                    {sku && (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-sm shrink-0">
                            Mã: {sku}
                        </span>
                    )}
                </div>

                {/* Status & Warranty (Moved above Title) */}
                {(product.stock_status || product.warranty_months) && (
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 mb-1.5">
                        {product.stock_status && (
                            <div className="flex items-center gap-1.5">
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-md",
                                    product.stock_status === 'in_stock' ? "bg-emerald-500" :
                                    product.stock_status === 'out_of_stock' ? "bg-red-500" : "bg-neutral-300"
                                )} />
                                <span>
                                    {product.stock_status === 'in_stock' ? siteConfig.ui.status.in_stock :
                                        product.stock_status === 'out_of_stock' ? siteConfig.ui.status.out_of_stock : "Đặt hàng"}
                                </span>
                            </div>
                        )}
                        {product.stock_status && product.warranty_months && <span className="text-neutral-300">•</span>}
                        {product.warranty_months && (
                            <span>BH {product.warranty_months} tháng</span>
                        )}
                    </div>
                )}

                {/* Title */}
                <h3 className="font-medium text-[14px] leading-snug text-neutral-800 group-hover:text-[#2E7A96] transition-colors duration-200 line-clamp-2">
                    {product.display_name || product.name}
                </h3>

                {/* Grow empty space to push tags & price to bottom so cards have equal height content */}
                <div className="mt-auto"></div>

                {/* Feature Tags Layer */}
                {featuresList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {featuresList.slice(0, 3).map((feat, idx) => (
                            <span key={idx} className="px-1.5 py-[2px] text-[10px] font-medium border border-neutral-200 bg-neutral-50/50 text-neutral-500 rounded-sm">
                                {feat}
                            </span>
                        ))}
                    </div>
                )}

                {/* Color chip */}
                {product.colors && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0 shadow-sm"
                            style={{ backgroundColor: product.colors.hex_code || '#ccc' }}
                        />
                        <span className="text-[10px] text-neutral-500 font-medium">{product.colors.name}</span>
                    </div>
                )}

                {/* Price */}
                <div className="flex flex-col gap-1 mt-2.5 border-t border-neutral-100 pt-2.5">
                    {showPrice && product.price ? (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className={`font-semibold text-[15px] sm:text-[16px] tracking-tight ${product.original_price && Number(product.original_price) > Number(product.price) ? 'text-red-600' : 'text-[#2E7A96]'}`}>
                                    {formatPrice(Number(product.price))}
                                </span>
                            </div>
                            {product.original_price && Number(product.original_price) > Number(product.price) && (
                                <span className="font-normal text-[12px] text-neutral-400 line-through">
                                    {formatPrice(Number(product.original_price))}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="font-semibold text-[15px] text-[#2E7A96] tracking-tight">
                            {product.price_display || siteConfig.ui.status.contact}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
