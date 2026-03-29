'use client';

import Image from 'next/image';
import { useState } from 'react';

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

export function ProductImageGallery({
    mainImageUrl,
    hoverImageUrl,
    additionalImages = [],
    productName,
}: ProductImageGalleryProps) {
    // Build full image list: main + additional
    const allImages: string[] = [];
    if (mainImageUrl) allImages.push(mainImageUrl);
    additionalImages.forEach((img) => allImages.push(img.image_url));

    const [activeIndex, setActiveIndex] = useState(0);
    const activeImage = allImages[activeIndex] || null;

    return (
        <div className="flex flex-col gap-3 w-full lg:max-w-[628px]">
            {/* Main Image */}
            <div className="relative w-full aspect-[628/590] rounded-[var(--radius-lg)] overflow-hidden bg-neutral-50 shadow-[0_2px_12px_rgba(16,24,40,0.06)]">
                {activeImage ? (
                    activeImage.includes('vietceramics.com') ? (
                        <img
                            src={activeImage}
                            alt={productName}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <Image
                            src={activeImage}
                            alt={productName}
                            fill
                            className="object-cover"
                            priority
                            unoptimized={activeImage.includes('vietceramics.com')}
                        />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-lg">
                        No Image
                    </div>
                )}
            </div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
                    {allImages.slice(0, 6).map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`
                                relative shrink-0 w-[80px] h-[80px] sm:w-[120px] sm:h-[120px] lg:w-[174px] lg:h-[174px]
                                rounded-[var(--radius-md)] overflow-hidden transition-all duration-200
                                ${idx === activeIndex
                                    ? 'border-2 border-blue-600 ring-2 ring-blue-100'
                                    : 'border border-neutral-200 hover:border-blue-400'
                                }
                            `}
                        >
                            {img.includes('vietceramics.com') ? (
                                <img
                                    src={img}
                                    alt={`${productName} - ${idx + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            ) : (
                                <Image
                                    src={img}
                                    alt={`${productName} - ${idx + 1}`}
                                    fill
                                    sizes="(max-width: 640px) 80px, (max-width: 1024px) 120px, 174px"
                                    className="object-cover"
                                    unoptimized={img.includes('vietceramics.com')}
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
