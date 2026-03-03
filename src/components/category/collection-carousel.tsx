'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CollectionItem {
    id: number;
    name: string;
    slug: string;
    thumbnail_url?: string | null;
    is_featured?: boolean | null;
    _count?: { products: number };
}

interface CollectionCarouselProps {
    patternName: string;
    patternSlug: string;
    collections: CollectionItem[];
    activeSlug?: string;
    categoryMode?: boolean;
}

export function CollectionCarousel({ patternName, patternSlug, collections, activeSlug, categoryMode }: CollectionCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(true);

    if (collections.length === 0) return null;

    const updateArrows = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 8);
        setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
    }, []);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateArrows();
        el.addEventListener('scroll', updateArrows, { passive: true });
        // Re-check when content loads
        const ro = new ResizeObserver(updateArrows);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect(); };
    }, [updateArrows]);

    const scroll = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    };

    const buildHref = (col: CollectionItem) => {
        const isActive = col.slug === activeSlug;
        if (categoryMode) {
            const params = new URLSearchParams(searchParams.toString());
            isActive ? params.delete('collection') : params.set('collection', col.slug);
            const qs = params.toString();
            return qs ? `/gach-op-lat?${qs}` : '/gach-op-lat';
        }
        return isActive
            ? `/gach-op-lat/${patternSlug}`
            : `/gach-op-lat/${patternSlug}?collection=${col.slug}`;
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Heading */}
            <h2 className="text-[20px] lg:text-[22px] font-semibold text-[#111827] tracking-[-0.48px] leading-[28px]">
                Tất cả{' '}
                <span className="font-bold text-[#15803d]">bộ sưu tập</span>
                {' '}{patternName}
            </h2>

            {/* Carousel */}
            <div className="relative group/carousel">
                {/* Left Arrow */}
                <button
                    onClick={() => scroll('left')}
                    aria-label="Xem bộ sưu tập trước"
                    className={`absolute left-0 top-[40px] -translate-y-1/2 -translate-x-1 z-20
                        w-8 h-8 lg:w-9 lg:h-9 rounded-full
                        bg-white border border-[#e5e7eb] shadow-md
                        flex items-center justify-center
                        hover:bg-[#f0fdf4] hover:border-[#22c55e] hover:shadow-lg
                        active:scale-95 transition-all duration-200
                        ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronLeft className="h-4 w-4 text-[#374151]" />
                </button>

                {/* Scroll container */}
                <div
                    ref={scrollRef}
                    className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2 px-0.5"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {collections.map((col) => {
                        const isActive = col.slug === activeSlug;
                        const href = buildHref(col);

                        return (
                            <Link
                                key={col.id}
                                href={href}
                                className="group flex flex-col shrink-0 w-[130px] lg:w-[150px] snap-start"
                            >
                                {/* Thumbnail fallback box (Rectangle) */}
                                <div className={`w-full h-[72px] lg:h-[84px] rounded-[12px] overflow-hidden flex flex-col items-center justify-center relative
                                    border transition-all duration-300
                                    ${isActive
                                        ? "border-[#22c55e] shadow-[0_4px_16px_rgba(21,128,61,0.15)] bg-[#f0fdf4]"
                                        : "bg-[#f9fafb] border-[#f3f4f6] shadow-[0_2px_6px_rgba(16,24,40,0.04)] group-hover:bg-white group-hover:border-[#86efac] group-hover:shadow-[0_4px_12px_rgba(21,128,61,0.08)]"
                                    }`}
                                >
                                    {col.thumbnail_url ? (
                                        col.thumbnail_url.includes('vietceramics.com') ? (
                                            <img
                                                src={col.thumbnail_url}
                                                alt={col.name}
                                                className={`absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-50 transition-transform duration-500 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                                            />
                                        ) : (
                                            <Image
                                                src={col.thumbnail_url}
                                                alt={col.name}
                                                fill
                                                sizes="(max-width: 1024px) 130px, 150px"
                                                className={`object-cover mix-blend-multiply opacity-50 transition-transform duration-500 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                                            />
                                        )
                                    ) : null}

                                    {/* Text Overlay inside the box */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center px-2 z-10 pointer-events-none">
                                        <span className={`font-semibold text-center truncate w-full transition-colors duration-200 ${isActive ? "text-[#15803d] text-[14px]" : "text-[#4b5563] text-[13px] group-hover:text-[#15803d]"}`}>
                                            {col.name}
                                        </span>
                                        {/* Product count */}
                                        {col._count?.products !== undefined && (
                                            <span className={`text-[11px] mt-0.5 ${isActive ? "text-[#166534]" : "text-[#9ca3af] group-hover:text-[#22c55e]"}`}>
                                                {col._count.products} SP
                                            </span>
                                        )}
                                    </div>

                                    {/* Active badge overlay */}
                                    {isActive && (
                                        <div className="absolute inset-0 border border-[#15803d]/20 rounded-[12px] z-20 pointer-events-none" />
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {/* Right Arrow */}
                <button
                    onClick={() => scroll('right')}
                    aria-label="Xem bộ sưu tập tiếp theo"
                    className={`absolute right-0 top-[40px] -translate-y-1/2 translate-x-1 z-20
                        w-8 h-8 lg:w-9 lg:h-9 rounded-full
                        bg-white border border-[#e5e7eb] shadow-md
                        flex items-center justify-center
                        hover:bg-[#f0fdf4] hover:border-[#22c55e] hover:shadow-lg
                        active:scale-95 transition-all duration-200
                        ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronRight className="h-4 w-4 text-[#374151]" />
                </button>

                {/* Edge fade gradients */}
                {canLeft && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/80 to-transparent z-10" />}
                {canRight && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent z-10" />}
            </div>
        </div>
    );
}
