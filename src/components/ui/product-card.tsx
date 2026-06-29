import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { getVariantDisplayColor } from '@/lib/variant-color-display';

export interface ProductCardProps {
    product: any;
    showPrice?: boolean;
    patternSlug?: string;
    basePath?: string;
    href?: string;
}

export function ProductCard({ product, showPrice = true, patternSlug, basePath = '/gach-op-lat', ...props }: ProductCardProps) {
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

    const resolvedHref = props.href || product.url || `${basePath}/${slug}/${product.slug}`;

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
    const isDiscontinued = product.stock_status === 'discontinued';

    let discountPercent = 0;
    if (product.original_price && product.price && Number(product.original_price) > Number(product.price)) {
        discountPercent = Math.round(((Number(product.original_price) - Number(product.price)) / Number(product.original_price)) * 100);
    }

    // Determine if product image should have margin (cutout/no-background)
    // Tiles (gach-op-lat) usually have full backgrounds, so we keep them object-cover
    const catSlug = product.category_slug || product.categories?.slug || basePath || '';
    const isCutout = !catSlug.includes('gach-op-lat');

    const imageClassName = cn(
        "object-cover mix-blend-multiply transition-transform duration-700",
        isCutout ? "object-contain p-4 md:p-6 group-hover:scale-110" : "object-cover group-hover:scale-105"
    );

    // Extract feature tags
    let featuresList: string[] = [];
    if (Array.isArray(product.product_feature_values)) {
        featuresList = product.product_feature_values
            .map((item: any) => item.product_features?.name)
            .filter(Boolean);
    }

    const displayColor = getVariantDisplayColor({
        variantOptions: product.variant_options,
        fallbackColor: product.colors,
    })

    return (
        <Link href={resolvedHref} className="group flex flex-col w-full h-full transition-all duration-300 relative">
            {product.is_featured && (
                <>
                    {/* Fading Border Wrapper */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-amber-300/60 from-0% via-amber-100/20 via-[25%] to-transparent to-[50%] rounded-[16px] z-0 pointer-events-none p-[1px]">
                        {/* Top Banner Background */}
                        <div className="w-full h-[32px] bg-amber-50 shadow-[inset_0_2px_4px_rgba(217,119,6,0.06)] rounded-t-[15px]" />
                    </div>
                </>
            )}
            
            {/* 32px Spacer / Banner Text */}
            <div className="w-full h-[32px] flex items-center justify-center text-amber-700 text-[10px] font-bold uppercase tracking-widest rounded-t-[16px] z-10 shrink-0 pt-[2px]">
                {product.is_featured ? <span className="relative z-20">Sản phẩm nổi bật</span> : null}
            </div>
            
            <div className={cn(
                "flex flex-col flex-1 relative z-20 h-full overflow-hidden",
                product.is_featured ? "bg-white rounded-b-[15px] rounded-t-none mx-[1px] mb-[1px] w-[calc(100%-2px)]" : "bg-white rounded-[16px] w-full"
            )}>
                {/* Background filler to create a cohesive 3D effect behind the rounded image corners */}
                {product.is_featured && (
                    <div className="absolute top-0 left-0 w-full h-[24px] bg-amber-50 z-0" />
                )}

                {/* Product Image — full top bleed */}
                <div className="relative w-full aspect-square bg-[#F8F9FA] rounded-[12px] overflow-hidden shrink-0 z-10">
                {firstImage ? (
                    firstImage.includes('vietceramics.com') ? (
                        <img
                            src={firstImage}
                            alt={product.name}
                            className={cn("absolute inset-0 w-full h-full", imageClassName)}
                        />
                    ) : (
                        <Image
                            src={firstImage}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className={imageClassName}
                            unoptimized={firstImage.includes('vietceramics.com')}
                        />
                    )
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                        <span className="text-xs font-medium uppercase tracking-wider">No Image</span>
                    </div>
                )}
                
                {/* Discount Flag Badge */}
                {isDiscontinued ? (
                    <div className="absolute top-4 left-0 z-20">
                        <div className="bg-rose-100 text-rose-700 font-bold text-[11px] px-2.5 py-[4px] rounded-r-md shadow-sm border border-l-0 border-rose-200 tracking-wide">
                            Ngừng KD
                        </div>
                    </div>
                ) : (discountPercent > 0 || product.is_promotion) && (
                    <div className="absolute top-4 left-0 z-20">
                        <div className="bg-[#E53935] text-white font-bold text-[11px] px-2.5 py-[3px] rounded-r-md shadow-md flex items-center shadow-red-900/20 tracking-wider">
                            {discountPercent > 0 ? `-${discountPercent}%` : 'SALE'}
                        </div>
                    </div>
                )}

                {/* Quick Action Overlay */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />
                <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20">
                    <div className="bg-white text-brand-600 hover:bg-brand-600 hover:text-white p-2.5 rounded-full shadow-lg border border-brand-100 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </div>
                </div>


            </div>

            {/* Content Section */}
            <div className="flex flex-col pt-3 pb-1 w-full flex-grow">
                {/* Brand & Status Header */}
                <div className="flex items-center justify-between mb-1 min-h-[16px]">
                    <span className="text-[10px] font-semibold text-neutral-400 truncate pr-2 uppercase tracking-widest flex-1">
                        {collectionName || (isTBVS ? 'Thiết bị vệ sinh' : 'Đông Phú Gia')}
                    </span>
                    {(product.stock_status || product.warranty_months || sku) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 shrink-0">
                            {product.stock_status && (
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    product.stock_status === 'discontinued' ? "bg-rose-400" :
                                    product.stock_status === 'in_stock' ? "bg-emerald-500" :
                                    product.stock_status === 'out_of_stock' ? "bg-red-500" : "bg-neutral-300"
                                )} />
                            )}
                            {sku && <span>Mã: {sku}</span>}
                            {product.warranty_months && <span>• BH {product.warranty_months}T</span>}
                        </div>
                    )}
                </div>

                {/* Title */}
                <h3 className="font-semibold text-[14px] leading-[1.4] text-neutral-800 group-hover:text-brand-600 transition-colors duration-200 line-clamp-2 mb-1.5" title={product.display_name || product.name}>
                    {product.display_name || product.name}
                </h3>

                {/* Features Tags */}
                {featuresList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {featuresList.slice(0, 3).map((feat, idx) => (
                            <span key={idx} className="px-2 py-[3px] text-[10px] text-neutral-500 bg-transparent rounded-[4px] border border-neutral-200">
                                {feat}
                            </span>
                        ))}
                    </div>
                )}

                {/* Grow empty space to push tags & price to bottom so cards have equal height content */}
                <div className="mt-auto"></div>

                {/* Color Layer (Hide if White/Trắng to reduce visual repetition) */}
                {displayColor && displayColor.name?.toLowerCase() !== 'trắng' && displayColor.name?.toLowerCase() !== 'white' && (
                    <div className="flex items-center gap-1.5 mt-1 mb-2">
                        <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0 shadow-sm"
                            style={{ backgroundColor: displayColor.hex_code || '#ccc' }}
                        />
                        <span className="text-[10px] text-neutral-500 font-medium">{displayColor.name}</span>
                    </div>
                )}

                {/* Price */}
                <div className="flex flex-col gap-0.5 mt-1 border-t border-neutral-100 pt-3">
                    {isDiscontinued ? (
                        <span className="w-fit rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[12px] font-bold text-rose-700">
                            Ngừng kinh doanh
                        </span>
                    ) : showPrice && product.price ? (
                        <>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-bold text-[17px] sm:text-[18px] tracking-tight ${product.original_price && Number(product.original_price) > Number(product.price) ? 'text-red-600' : 'text-brand-700'}`}>
                                    {formatPrice(Number(product.price))}
                                </span>
                                {product.original_price && Number(product.original_price) > Number(product.price) && (
                                    <span className="font-medium text-[13px] text-neutral-400 line-through">
                                        {formatPrice(Number(product.original_price))}
                                    </span>
                                )}
                            </div>
                            {product.online_discount_amount && Number(product.online_discount_amount) > 0 && (
                                <span className="px-2 py-[5px] mt-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-[4px] leading-none whitespace-nowrap w-fit">
                                    Giảm thêm {formatPrice(Number(product.online_discount_amount))}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="font-semibold text-[14px] text-[#2E7A96] tracking-tight">
                            {product.price_display || siteConfig.ui.status.contact}
                        </span>
                    )}
                </div>
            </div>
            </div>
        </Link>
    );
}
