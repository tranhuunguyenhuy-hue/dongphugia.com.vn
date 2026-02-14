'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CollectionItem {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    productTypeId?: string;
}

interface CollectionCarouselProps {
    categoryName: string;
    collections: CollectionItem[];
    activeId?: string;
    categorySlug?: string; // Add categorySlug to build filter URL
}

export function CollectionCarousel({ categoryName, collections, activeId, categorySlug }: CollectionCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    if (collections.length === 0) return null;

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const amount = 200;
        scrollRef.current.scrollBy({
            left: dir === 'left' ? -amount : amount,
            behavior: 'smooth',
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold text-[#111827] tracking-tight">
                Tất cả{' '}
                <span className="font-bold text-[#15803d]">bộ sưu tập</span>
                {' '}{categoryName}
            </h2>

            <div className="relative group/carousel">
                {/* Left arrow */}
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/50 text-white rounded-r-lg w-[50px] h-[50px] flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>

                {/* Scroll container */}
                <div
                    ref={scrollRef}
                    className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-4 px-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {collections.map((col) => {
                        const isActive = col.id === activeId;
                        // If categorySlug is provided, we filter. Otherwise default to collection detail.
                        // Actually, to support breadcrumb flow "Home > Category > Collection", we likely want filtering.
                        // But if we want to support "Gạch vân đá marble" -> "Collection", it might be complex.
                        // Let's assume if categorySlug is present, we filter.
                        const href = categorySlug
                            ? (isActive
                                ? `/danh-muc/${categorySlug}` // Deselect: go to category root (or could go to productType if we want)
                                : `/danh-muc/${categorySlug}?collection=${col.id}${col.productTypeId ? `&productType=${col.productTypeId}` : ''}`)
                            : `/bo-suu-tap/${col.slug}`;

                        return (
                            <Link
                                key={col.id}
                                href={href}
                                className="group flex flex-col gap-3 shrink-0 w-[160px] snap-start"
                            >
                                <div className={`w-full aspect-square rounded-2xl overflow-hidden shadow-[0px_2px_6px_0px_rgba(16,24,40,0.06)] transition-all duration-300 ${isActive ? 'ring-2 ring-[#15803d] ring-offset-2' : ''}`}>
                                    {col.image ? (
                                        <Image
                                            src={col.image}
                                            alt={col.name}
                                            width={160}
                                            height={160}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs text-center p-2">
                                            {col.name}
                                        </div>
                                    )}
                                </div>
                                <p className={`font-semibold text-lg transition-colors truncate ${isActive ? 'text-[#15803d]' : 'text-[#4b5563] group-hover:text-[#15803d]'}`}>
                                    {col.name}
                                </p>
                            </Link>
                        );
                    })}
                </div>

                {/* Right arrow */}
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/50 text-white rounded-l-lg w-[50px] h-[50px] flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                    aria-label="Scroll right"
                >
                    <ChevronRight className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
}
