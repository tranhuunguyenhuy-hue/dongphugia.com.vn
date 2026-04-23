'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Package2 } from 'lucide-react';

interface GalleryImage {
    image_url: string;
    alt_text?: string | null;
}

interface ProductImageGalleryProps {
    mainImageUrl?: string | null;
    hoverImageUrl?: string | null;
    additionalImages?: GalleryImage[];
    productName: string;
}

function isValidImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    // Filter out known broken patterns
    if (url.includes('//images/original.jpg')) return false;
    if (url.includes('/images/original.jpg')) return false;
    if (url.endsWith('.gif')) return false; // skip gifs (usually spinners/loaders)
    return true;
}

export function ProductImageGallery({
    mainImageUrl,
    hoverImageUrl,
    additionalImages = [],
    productName,
}: ProductImageGalleryProps) {
    // Build full image list: main + additional (filter broken URLs)
    const allImages: string[] = [];
    if (isValidImageUrl(mainImageUrl)) allImages.push(mainImageUrl!);
    additionalImages.forEach((img) => {
        if (isValidImageUrl(img.image_url)) allImages.push(img.image_url);
    });

    const [activeIndex, setActiveIndex] = useState(0);
    // Track per-image error state to hide broken thumbnails
    const [erroredIndices, setErroredIndices] = useState<Set<number>>(new Set());

    const activeImage = allImages[activeIndex] ?? null;

    const handleImageError = (idx: number) => {
        setErroredIndices(prev => new Set(prev).add(idx));
        // If active image errored, try next valid one
        if (idx === activeIndex) {
            const next = allImages.findIndex((_, i) => i !== idx && !erroredIndices.has(i));
            if (next !== -1) setActiveIndex(next);
        }
    };

    // Visible thumbnails: only those that haven't errored
    const visibleImages = allImages
        .map((img, idx) => ({ img, idx }))
        .filter(({ idx }) => !erroredIndices.has(idx));

    return (
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 w-full">
            {/* Thumbnail Strip — vertical on desktop, horizontal on mobile */}
            {visibleImages.length > 1 && (
                <div className="flex lg:flex-col gap-2 sm:gap-3 lg:gap-2.5 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 order-2 lg:order-1">
                    {visibleImages.slice(0, 6).map(({ img, idx }) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`
                                relative shrink-0 w-[80px] h-[80px] lg:w-[72px] lg:h-[72px]
                                rounded-xl lg:rounded-lg overflow-hidden transition-all duration-200
                                bg-stone-50
                                ${idx === activeIndex
                                    ? 'border-2 border-brand-500 shadow-sm'
                                    : 'border border-stone-200 hover:border-stone-400'
                                }
                            `}
                        >
                            {img.includes('vietceramics.com') ? (
                                <img
                                    src={img}
                                    alt={`${productName} - ${idx + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={() => handleImageError(idx)}
                                />
                            ) : (
                                <Image
                                    src={img}
                                    alt={`${productName} - ${idx + 1}`}
                                    fill
                                    sizes="80px"
                                    className="object-cover"
                                    onError={() => handleImageError(idx)}
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Image */}
            <div className="relative w-full aspect-square md:aspect-[628/590] lg:aspect-square flex-1 rounded-[16px] overflow-hidden bg-stone-50 border border-stone-200 order-1 lg:order-2">
                {activeImage && !erroredIndices.has(activeIndex) ? (
                    activeImage.includes('vietceramics.com') ? (
                        <img
                            src={activeImage}
                            alt={productName}
                            className="absolute inset-0 w-full h-full object-contain"
                            onError={() => handleImageError(activeIndex)}
                        />
                    ) : (
                        <Image
                            src={activeImage}
                            alt={productName}
                            fill
                            className="object-contain"
                            priority
                            onError={() => handleImageError(activeIndex)}
                        />
                    )
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 gap-2">
                        <Package2 className="w-16 h-16" />
                        <span className="text-sm text-stone-400">Chưa có hình ảnh</span>
                    </div>
                )}
            </div>
        </div>
    );
}
