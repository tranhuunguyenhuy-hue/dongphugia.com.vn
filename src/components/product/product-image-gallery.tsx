'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Package2 } from 'lucide-react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

interface GalleryImage {
    image_url: string;
    alt_text?: string | null;
}

interface ProductImageGalleryProps {
    mainImageUrl?: string | null;
    hoverImageUrl?: string | null;
    additionalImages?: GalleryImage[];
    productName: string;
    discountPercent?: number;
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
    discountPercent = 0,
}: ProductImageGalleryProps) {
    // Build full image list: main + additional (filter broken URLs)
    const allImages: string[] = [];
    if (isValidImageUrl(mainImageUrl)) allImages.push(mainImageUrl!);
    additionalImages.forEach((img) => {
        if (isValidImageUrl(img.image_url)) allImages.push(img.image_url);
    });

    const [activeIndex, setActiveIndex] = useState(0);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    // Track per-image error state to hide broken thumbnails
    const [erroredIndices, setErroredIndices] = useState<Set<number>>(new Set());

    const displayImages = useMemo(() => {
        if (!isValidImageUrl(previewImageUrl)) return allImages;
        return [previewImageUrl!, ...allImages.filter((url) => url !== previewImageUrl)];
    }, [previewImageUrl, allImages]);

    useEffect(() => {
        const handlePreview = (event: Event) => {
            const detail = (event as CustomEvent<{ imageUrl?: string | null }>).detail;
            if (isValidImageUrl(detail?.imageUrl)) {
                setPreviewImageUrl(detail!.imageUrl!);
                setActiveIndex(0);
                setErroredIndices(new Set());
            }
        };

        window.addEventListener('product-variant-preview', handlePreview);
        return () => window.removeEventListener('product-variant-preview', handlePreview);
    }, []);

    const activeImage = displayImages[activeIndex] ?? null;

    const handleImageError = (idx: number) => {
        setErroredIndices(prev => new Set(prev).add(idx));
        // If active image errored, try next valid one
        if (idx === activeIndex) {
            const next = displayImages.findIndex((_, i) => i !== idx && !erroredIndices.has(i));
            if (next !== -1) setActiveIndex(next);
        }
    };

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // Swipe gesture state
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEndHandler = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        const visibleIndices = displayImages.map((_, i) => i).filter(i => !erroredIndices.has(i));
        const currentPos = visibleIndices.indexOf(activeIndex);

        if (isLeftSwipe && currentPos < visibleIndices.length - 1) {
            setActiveIndex(visibleIndices[currentPos + 1]);
        }
        if (isRightSwipe && currentPos > 0) {
            setActiveIndex(visibleIndices[currentPos - 1]);
        }
    };

    // Visible thumbnails: only those that haven't errored
    const visibleImages = displayImages
        .map((img, idx) => ({ img, idx }))
        .filter(({ idx }) => !erroredIndices.has(idx));

    return (
        <div className="flex flex-col gap-3 lg:gap-4 w-full">
            {/* Main Image */}
            <div className="relative w-full aspect-square md:aspect-[628/590] lg:aspect-square rounded-[16px] overflow-hidden bg-stone-50 border border-stone-200">
                {activeImage && !erroredIndices.has(activeIndex) ? (
                    <div 
                        className="w-full h-full cursor-zoom-in"
                        role="button"
                        aria-label="Phóng to ảnh sản phẩm"
                        onClick={() => setLightboxOpen(true)}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEndHandler}
                    >
                        {activeImage.includes('vietceramics.com') ? (
                            <img
                                src={activeImage}
                                alt={productName}
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                onError={() => handleImageError(activeIndex)}
                            />
                        ) : (
                            <Image
                                src={activeImage}
                                alt={productName}
                                fill
                                className="object-contain pointer-events-none"
                                priority
                                onError={() => handleImageError(activeIndex)}
                            />
                        )}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 gap-2">
                        <Package2 className="w-16 h-16" />
                        <span className="text-sm text-stone-400">Chưa có hình ảnh</span>
                    </div>
                )}
                
                {/* Discount Flag Badge */}
                {discountPercent > 0 && (
                    <div className="absolute top-0 right-4 z-20 drop-shadow-[0_2px_4px_rgba(255,23,68,0.25)]">
                        {/* Top Rod Effect */}
                        <div className="absolute top-0 left-[-1.5px] right-[-1.5px] h-[2px] bg-[#B71C1C] rounded-t-sm z-10" />
                        {/* Flag Body */}
                        <div 
                            className="bg-[#FF1744] text-white font-bold text-[12px] tracking-tighter flex items-start justify-center pt-2"
                            style={{ 
                                width: '40px', 
                                height: '48px', 
                                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), 50% 100%, 0 calc(100% - 10px))'
                            }}
                        >
                            -{discountPercent}%
                        </div>
                    </div>
                )}
            </div>

            {/* Dot Indicator Strip for Mobile */}
            {visibleImages.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-1 lg:hidden">
                    {visibleImages.map(({ idx }) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            aria-label={`Ảnh ${idx + 1}`}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === activeIndex ? "w-4 bg-brand-500" : "w-1.5 bg-stone-200"
                            }`}
                        />
                    ))}
                </div>
            )}

            {/* Thumbnail Strip — horizontal on all screens */}
            {visibleImages.length > 1 && (
                <div className="flex gap-2 sm:gap-3 lg:gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {visibleImages.map(({ img, idx }) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            aria-label={`Xem ảnh sản phẩm ${idx + 1}`}
                            aria-pressed={idx === activeIndex}
                            className={`
                                relative shrink-0 w-[80px] h-[80px] lg:w-[88px] lg:h-[88px]
                                rounded-xl overflow-hidden transition-all duration-200 cursor-pointer
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
                                    sizes="(min-width: 1024px) 88px, 80px"
                                    className="object-cover"
                                    onError={() => handleImageError(idx)}
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                index={visibleImages.findIndex(vi => vi.idx === activeIndex) !== -1 ? visibleImages.findIndex(vi => vi.idx === activeIndex) : 0}
                slides={visibleImages.map(({ img }) => ({ src: img }))}
                plugins={[Zoom]}
                on={{ view: ({ index }: { index: number }) => setActiveIndex(visibleImages[index].idx) }}
            />
        </div>
    );
}
