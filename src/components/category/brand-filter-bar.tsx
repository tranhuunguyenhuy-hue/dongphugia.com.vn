'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Brand {
    id: number
    name: string
    slug: string
}

interface BrandFilterBarProps {
    brands: Brand[]
    activeBrandSlug?: string
    basePath: string
}

export function BrandFilterBar({ brands, activeBrandSlug, basePath }: BrandFilterBarProps) {
    if (brands.length === 0) return null

    return (
        <div
            className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 pt-1"
            role="group"
            aria-label="Lọc theo thương hiệu"
        >
            {/* "Tất cả" chip */}
            <Link
                href={basePath}
                className={cn(
                    'shrink-0 h-[42px] px-5 rounded-lg flex items-center justify-center text-[13px] font-medium transition-all duration-300 border',
                    !activeBrandSlug
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-md'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:text-neutral-900 hover:bg-neutral-50'
                )}
            >
                Tất cả
            </Link>

            {brands.map(brand => {
                const isActive = activeBrandSlug === brand.slug
                return (
                    <Link
                        key={brand.id}
                        href={`${basePath}?brand=${brand.slug}`}
                        className={cn(
                            'shrink-0 h-[42px] px-4 rounded-lg flex items-center justify-center transition-all duration-300 border relative group/brand min-w-[80px]',
                            isActive
                                ? 'bg-white border-neutral-900 shadow-[0_0_0_1px_#171717]'
                                : 'bg-white border-neutral-200 hover:border-neutral-400 hover:shadow-sm'
                        )}
                        title={brand.name}
                        aria-current={isActive ? 'true' : undefined}
                    >
                        <div className="h-5 flex items-center justify-center w-full">
                            <img
                                src={`/images/brands/${brand.slug}.png`}
                                alt={brand.name}
                                className={cn(
                                    "max-h-full max-w-[80px] object-contain transition-all duration-300",
                                    isActive ? "grayscale-0 opacity-100" : "grayscale opacity-50 group-hover/brand:grayscale-0 group-hover/brand:opacity-100"
                                )}
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src.endsWith('.png')) {
                                        target.src = `/images/brands/${brand.slug}.svg`;
                                    } else {
                                        target.style.display = 'none';
                                        if (target.nextElementSibling) {
                                            (target.nextElementSibling as HTMLElement).style.display = 'block';
                                        }
                                    }
                                }}
                            />
                            {/* Fallback text if image completely fails */}
                            <span 
                                style={{ display: 'none' }} 
                                className={cn("text-[13px] font-medium tracking-tight", isActive ? "text-neutral-900" : "text-neutral-600 group-hover/brand:text-neutral-900")}
                            >
                                {brand.name}
                            </span>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
