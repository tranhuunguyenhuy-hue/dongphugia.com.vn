
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

interface ProductCardProps {
    product: any;
    showPrice?: boolean;
}

export function ProductCard({ product, showPrice = true }: ProductCardProps) {
    const images = JSON.parse(product.images as string);
    const firstImage = product.thumbnail || (images.length > 0 ? images[0] : null);

    // Parse specs for display
    let specs: any = {};
    try {
        if (product.specs) specs = JSON.parse(product.specs as string);
    } catch { /* ignore */ }

    const collectionName = product.collection?.name;
    const dimensionText = product.dimensions || specs.dimensions || specs.simDimensions;
    const surfaceText = product.surface || specs.surface;

    return (
        <Link href={`/san-pham/${product.slug}`} className="group flex flex-col gap-6 w-full">
            {/* Product Image — 1:1 ratio */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-[0px_2px_6px_0px_rgba(16,24,40,0.06)] bg-white group-hover:shadow-lg transition-shadow">
                <div className="relative w-full h-full">
                    {firstImage ? (
                        <Image
                            src={firstImage}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                            No Image
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-3 w-full">
                {/* Product Name */}
                <h3 className="font-semibold text-xl leading-7 text-[#111827] tracking-tight group-hover:text-[#15803d] transition-colors">
                    {product.name}
                </h3>

                {/* Description: BST + Dimensions + Surface */}
                <div className="flex flex-col gap-1">
                    {/* Collection (BST) */}
                    {collectionName && (
                        <div className="flex gap-2 items-start text-lg text-[#4b5563]">
                            <span className="font-normal">BST:</span>
                            <span className="font-semibold truncate">{collectionName}</span>
                        </div>
                    )}

                    {/* Dimensions | Surface */}
                    {(dimensionText || surfaceText) && (
                        <div className="flex items-center gap-2 text-lg text-[#4b5563]">
                            {dimensionText && (
                                <span className="font-semibold">{dimensionText}</span>
                            )}
                            {dimensionText && surfaceText && (
                                <span className="w-px h-5 bg-gray-300 rotate-0" />
                            )}
                            {surfaceText && (
                                <span className="font-semibold">{surfaceText}</span>
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
                            Liên hệ báo giá
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
