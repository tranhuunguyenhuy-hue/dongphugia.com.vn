'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ProductImageGalleryProps {
    images: string[];
    productName: string;
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeImage = images[activeIndex] || null;

    return (
        <div className="flex flex-col gap-3 w-full lg:max-w-[628px]">
            {/* Main Image */}
            <div className="relative w-full aspect-[628/590] rounded-[16px] sm:rounded-[20px] overflow-hidden bg-gray-100">
                {activeImage ? (
                    <Image
                        src={activeImage}
                        alt={productName}
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                        No Image
                    </div>
                )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
                    {images.slice(0, 5).map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`
                                relative shrink-0 w-[80px] h-[80px] sm:w-[120px] sm:h-[120px] lg:w-[174px] lg:h-[174px]
                                rounded-[8px] sm:rounded-[12px] overflow-hidden transition-all duration-200
                                ${idx === activeIndex
                                    ? 'border-2 border-[#16a34a] shadow-[0px_20px_40px_-8px_rgba(16,24,40,0.05),0px_20px_40px_-8px_rgba(16,24,40,0.1)]'
                                    : 'border border-transparent hover:border-gray-300'
                                }
                            `}
                        >
                            <Image
                                src={img}
                                alt={`${productName} - ${idx + 1}`}
                                fill
                                className="object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
