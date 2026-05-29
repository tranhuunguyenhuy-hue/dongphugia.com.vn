'use client';

import { cn } from '@/lib/utils';

interface BrandBadgeProps {
    brand: {
        name: string;
        slug: string;
    };
    className?: string;
}

export function BrandBadge({ brand, className }: BrandBadgeProps) {
    if (!brand) return null;

    const rawSlug = brand.slug || brand.name || '';
    const slug = rawSlug.toLowerCase().trim().replace(/[\s_]+/g, '-');

    return (
        <div className={cn("h-7 px-2.5 py-1 border border-stone-200 bg-white shadow-sm flex items-center justify-center rounded-sm group/badge hover:border-stone-300 transition-colors", className)}>
            {slug ? (
                <div className="h-full flex items-center justify-center">
                    <img
                        src={`/images/brands/${slug}.png`}
                        alt={brand.name}
                        className="max-h-full max-w-[60px] object-contain transition-all duration-300 grayscale opacity-80 group-hover/badge:grayscale-0 group-hover/badge:opacity-100"
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src.endsWith('.png')) {
                                target.src = `/images/brands/${slug}.svg`;
                            } else {
                                target.style.display = 'none';
                                if (target.nextElementSibling) {
                                    (target.nextElementSibling as HTMLElement).style.display = 'inline';
                                }
                            }
                        }}
                    />
                    <span 
                        className="text-[11px] font-bold uppercase tracking-wider text-stone-600 hidden"
                    >
                        {brand.name}
                    </span>
                </div>
            ) : (
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    {brand.name}
                </span>
            )}
        </div>
    );
}
