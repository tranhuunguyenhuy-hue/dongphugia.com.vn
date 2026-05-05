'use client'

import React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X } from 'lucide-react'

// Define the name mapping locally or pass it from parent.
// Passing a flat list or dictionary of current names is safer because searchParams only holds slugs.
export type ActiveFilterDict = Record<string, string> // e.g. { 'toto': 'TOTO', 'bon-cau': 'Bồn cầu' }

export function ActiveFilters({ filterDict, excludeKeys = [] }: { filterDict: ActiveFilterDict, excludeKeys?: string[] }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Collect all active filters from specific keys
    const FILTER_KEYS = ['sub', 'brand', 'features', 'material', 'origin'].filter(
        key => !excludeKeys.includes(key)
    )
    const SPECIAL_KEYS = ['priceRange', 'is_promotion', 'is_featured']

    let activeBadges: { key: string, slug: string, label: string }[] = []

    FILTER_KEYS.forEach(key => {
        const val = searchParams.get(key)
        if (val) {
            const slugs = val.split(',')
            slugs.forEach(slug => {
                activeBadges.push({
                    key,
                    slug,
                    label: filterDict[slug] || slug // fallback to slug if name not found in dict
                })
            })
        }
    })

    // Handle special keys like priceRange which are composite
    const priceRange = searchParams.get('priceRange')
    if (priceRange) {
        priceRange.split(',').forEach(slug => {
            let label = slug
            if (slug === '0-1000000') label = 'Dưới 1 triệu'
            else if (slug === '1000000-3000000') label = 'Từ 1 - 3 triệu'
            else if (slug === '3000000-5000000') label = 'Từ 3 - 5 triệu'
            else if (slug === '5000000-999999999') label = 'Trên 5 triệu'
            activeBadges.push({ key: 'priceRange', slug, label })
        })
    }

    if (searchParams.get('is_promotion') === 'true') {
        activeBadges.push({ key: 'is_promotion', slug: 'true', label: 'Khuyến mãi' })
    }
    
    if (searchParams.get('is_featured') === 'true') {
        activeBadges.push({ key: 'is_featured', slug: 'true', label: 'Khuyến mãi đặc biệt' })
    }

    if (activeBadges.length === 0) return null

    const removeFilter = (key: string, slug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        
        if (SPECIAL_KEYS.includes(key)) {
            if (key === 'priceRange') {
                 const current = params.get(key)
                 if (current) {
                     const newSlugs = current.split(',').filter(s => s !== slug)
                     if (newSlugs.length > 0) params.set(key, newSlugs.join(','))
                     else params.delete(key)
                 }
            } else {
                 params.delete(key)
            }
        } else {
            const current = params.get(key)
            if (current) {
                const newSlugs = current.split(',').filter(s => s !== slug)
                if (newSlugs.length > 0) params.set(key, newSlugs.join(','))
                else params.delete(key)
            }
        }

        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`)
    }

    const clearAll = () => {
        const params = new URLSearchParams(searchParams.toString())
        FILTER_KEYS.forEach(k => params.delete(k))
        SPECIAL_KEYS.forEach(k => params.delete(k))
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-sm text-neutral-500 mr-1">Lọc theo:</span>
            {activeBadges.map((badge, idx) => (
                <div 
                    key={`${badge.key}-${badge.slug}-${idx}`} 
                    className="inline-flex items-center space-x-1 pl-3 pr-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                    <span>{badge.label}</span>
                    <button
                        type="button"
                        onClick={() => removeFilter(badge.key, badge.slug)}
                        className="p-0.5 rounded-lg hover:bg-blue-200 text-blue-500 hover:text-blue-800 transition-colors"
                        aria-label={`Xoá lọc ${badge.label}`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ))}
            
            <button 
                onClick={clearAll}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900 underline underline-offset-4 ml-2 transition-colors"
            >
                Xóa tất cả
            </button>
        </div>
    )
}
