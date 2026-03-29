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
        <div className="flex flex-col gap-6 border-b border-neutral-100 pb-8 mt-2">
            {/* Heading */}
            <div className="flex items-end justify-between">
                <h2 className="text-[20px] font-semibold text-neutral-900 tracking-tight leading-none">
                    Bộ sưu tập {patternName.toLowerCase()}
                </h2>
            </div>

            {/* Carousel */}
            <div className="relative group/carousel">
                {/* Left Arrow */}
                <button
                    onClick={() => scroll('left')}
                    aria-label="Xem bộ sưu tập trước"
                    className={`absolute left-0 top-[42px] -translate-y-1/2 -translate-x-4 z-20
                        w-10 h-10 rounded-full bg-white border border-neutral-200 shadow-sm
                        flex items-center justify-center text-neutral-600
                        hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300
                        active:scale-95 transition-all duration-200
                        ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Scroll container */}
                <div
                    ref={scrollRef}
                    className="flex gap-4 lg:gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2 px-1"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {collections.map((col) => {
                        const isActive = col.slug === activeSlug;
                        const href = buildHref(col);

                        return (
                            <Link
                                key={col.id}
                                href={href}
                                className="group flex flex-col shrink-0 w-[140px] lg:w-[160px] snap-start"
                            >
                                {/* Thumbnail fallback box (Rectangle) */}
                                <div className={`w-full h-[84px] lg:h-[96px] rounded-lg overflow-hidden flex flex-col items-center justify-center relative
                                    transition-all duration-300
                                    ${isActive
                                        ? "ring-2 ring-neutral-900 bg-neutral-900"
                                        : "bg-neutral-100 ring-1 ring-neutral-200 group-hover:bg-neutral-200 group-hover:ring-neutral-300"
                                    }`}
                                >
                                    {col.thumbnail_url ? (
                                        col.thumbnail_url.includes('vietceramics.com') ? (
                                            <img
                                                src={col.thumbnail_url}
                                                alt={col.name}
                                                className={`absolute inset-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-700 ${isActive ? "opacity-40 scale-105" : "opacity-60 group-hover:scale-105 group-hover:opacity-50"}`}
                                            />
                                        ) : (
                                            <Image
                                                src={col.thumbnail_url}
                                                alt={col.name}
                                                fill
                                                sizes="(max-width: 1024px) 140px, 160px"
                                                className={`object-cover mix-blend-multiply transition-transform duration-700 ${isActive ? "opacity-40 scale-105" : "opacity-60 group-hover:scale-105 group-hover:opacity-50"}`}
                                            />
                                        )
                                    ) : null}

                                    {/* Text Overlay inside the box */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center px-3 z-10 pointer-events-none text-center">
                                        <span className={`font-semibold text-[13px] leading-snug line-clamp-2 transition-colors duration-200 ${isActive ? "text-white" : "text-neutral-700 group-hover:text-neutral-900"}`}>
                                            {col.name}
                                        </span>
                                        {/* Product count */}
                                        {col._count?.products !== undefined && (
                                            <span className={`text-[11px] mt-1 font-medium ${isActive ? "text-neutral-300" : "text-neutral-500 group-hover:text-neutral-600"}`}>
                                                {col._count.products} SP
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {/* Right Arrow */}
                <button
                    onClick={() => scroll('right')}
                    aria-label="Xem bộ sưu tập tiếp theo"
                    className={`absolute right-0 top-[42px] -translate-y-1/2 translate-x-4 z-20
                        w-10 h-10 rounded-full bg-white border border-neutral-200 shadow-sm
                        flex items-center justify-center text-neutral-600
                        hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300
                        active:scale-95 transition-all duration-200
                        ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <ChevronRight className="h-5 w-5" />
                </button>

                {/* Edge fade gradients */}
                {canLeft && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent z-10" />}
                {canRight && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10" />}
            </div>
        </div>
    );
}
