'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---
type FilterOption = { name: string; slug: string; icon_name?: string | null; logo_url?: string | null }
type FilterSectionProps = {
    title: string
    options: FilterOption[]
    selectedSlugs: string[]
    onChange: (slug: string, checked: boolean) => void
    defaultOpen?: boolean
}

// --- Components ---
const FilterSection = ({ title, options, selectedSlugs, onChange, defaultOpen = true }: FilterSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    if (!options || options.length === 0) return null

    return (
        <div className="border-b border-neutral-200 py-4 last:border-0">
            <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-semibold tracking-tight text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md py-1"
                onClick={() => setIsOpen(!isOpen)}
            >
                {title}
                {isOpen ? <ChevronDown className="h-4 w-4 text-neutral-500" /> : <ChevronRight className="h-4 w-4 text-neutral-500" />}
            </button>

            {isOpen && (
                <div className="mt-4 space-y-3">
                    {options.map((opt) => {
                        const isChecked = selectedSlugs.includes(opt.slug)
                        const id = `filter-${title}-${opt.slug}`
                        return (
                            <div key={opt.slug} className="flex items-center space-x-3">
                                <Checkbox
                                    id={id}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => onChange(opt.slug, checked === true)}
                                    className="mt-0.5 border-neutral-300"
                                />
                                <Label
                                    htmlFor={id}
                                    className={cn(
                                        "text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer transition-colors",
                                        isChecked 
                                            ? "font-semibold text-blue-700" 
                                            : "font-medium text-neutral-700 hover:text-neutral-900"
                                    )}
                                >
                                    {opt.name}
                                </Label>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export type AvailableFiltersData = {
    subcategories: FilterOption[]
    brands: FilterOption[]
    materials: FilterOption[]
    origins: FilterOption[]
    features: FilterOption[]
}

export function AdvancedSidebarFilter({ availableFilters, hideTitle = false, hideSubcategoryFilter = false }: { availableFilters: AvailableFiltersData, hideTitle?: boolean, hideSubcategoryFilter?: boolean }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Create a new URLSearchParams object from current to manipulate
    const createQueryString = useCallback(
        (name: string, value: string[]) => {
            const params = new URLSearchParams(searchParams.toString())
            if (value.length > 0) {
                params.set(name, value.join(','))
            } else {
                params.delete(name)
            }
            // Always reset page to 1 when filtering
            params.set('page', '1')
            return params.toString()
        },
        [searchParams]
    )

    // Helper to get array from CSV string
    const getParamAsArray = (key: string) => {
        const val = searchParams.get(key)
        return val ? val.split(',') : []
    }

    const subcategorySlugs = getParamAsArray('sub')
    const brandSlugs = getParamAsArray('brand')
    const featureSlugs = getParamAsArray('features')
    const materialSlugs = getParamAsArray('material')
    const originSlugs = getParamAsArray('origin')

    const handleChange = (key: string, currentSelected: string[], targetSlug: string, checked: boolean) => {
        let newSelected = [...currentSelected]
        if (checked) {
            newSelected.push(targetSlug)
        } else {
            newSelected = newSelected.filter(s => s !== targetSlug)
        }
        
        // Use router.replace to avoid clogging the history stack (or router.push if desired)
        const newQuery = createQueryString(key, newSelected)
        router.push(`${pathname}?${newQuery}`)
    }

    // Pricing filters 
    const PRICE_OPTIONS = [
        { name: 'Dưới 1 triệu', slug: '0-1000000' },
        { name: 'Từ 1 - 3 triệu', slug: '1000000-3000000' },
        { name: 'Từ 3 - 5 triệu', slug: '3000000-5000000' },
        { name: 'Trên 5 triệu', slug: '5000000-999999999' },
    ]
    const currentPriceStr = searchParams.get('priceRange')
    const priceSlugs = currentPriceStr ? currentPriceStr.split(',') : []

    const handlePriceChange = (slug: string, checked: boolean) => {
        let newSelected = [...priceSlugs]
        if (checked) {
            newSelected.push(slug)
        } else {
            newSelected = newSelected.filter(s => s !== slug)
        }

        const params = new URLSearchParams(searchParams.toString())
        if (newSelected.length > 0) {
            params.set('priceRange', newSelected.join(','))
            // Also map to min/max for the API if needed, or API can handle priceRange directly.
            // Let's keep it simple and just use priceRange in URL, we will parse it in the page component.
        } else {
            params.delete('priceRange')
        }
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className={cn("w-full bg-white rounded-lg", !hideTitle && "sticky top-24")}>
            {!hideTitle && (
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="h-5 w-5 text-neutral-900" />
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-900">Tính năng lọc</h3>
                </div>
            )}

            <div className="space-y-1">
                {/* Hide subcategory filter when already on a subcategory page */}
                {!hideSubcategoryFilter && (
                    <FilterSection
                        title="Loại sản phẩm"
                        options={availableFilters.subcategories}
                        selectedSlugs={subcategorySlugs}
                        onChange={(slug, checked) => handleChange('sub', subcategorySlugs, slug, checked)}
                        defaultOpen={true}
                    />
                )}
                
                <FilterSection
                    title="Thương hiệu"
                    options={availableFilters.brands}
                    selectedSlugs={brandSlugs}
                    onChange={(slug, checked) => handleChange('brand', brandSlugs, slug, checked)}
                    defaultOpen={true}
                />

                <FilterSection
                    title="Khoảng giá"
                    options={PRICE_OPTIONS}
                    selectedSlugs={priceSlugs}
                    onChange={handlePriceChange}
                    defaultOpen={true}
                />

                <FilterSection
                    title="Chức năng"
                    options={availableFilters.features}
                    selectedSlugs={featureSlugs}
                    onChange={(slug, checked) => handleChange('features', featureSlugs, slug, checked)}
                    defaultOpen={true}
                />

                <FilterSection
                    title="Chất liệu"
                    options={availableFilters.materials}
                    selectedSlugs={materialSlugs}
                    onChange={(slug, checked) => handleChange('material', materialSlugs, slug, checked)}
                    defaultOpen={false}
                />

                <FilterSection
                    title="Tùy chọn khác"
                    options={
                        [
                            { name: 'Sản phẩm mới', slug: 'new' },
                            { name: 'Khuyến mãi đặc biệt', slug: 'special' }
                        ]
                    }
                    selectedSlugs={
                        (searchParams.get('is_new') === 'true' ? ['new'] : []).concat(
                            searchParams.get('is_featured') === 'true' ? ['special'] : []
                        )
                    }
                    onChange={(slug, checked) => {
                        const params = new URLSearchParams(searchParams.toString())
                        if (slug === 'new') {
                            if (checked) params.set('is_new', 'true')
                            else params.delete('is_new')
                        }
                        if (slug === 'special') {
                            if (checked) params.set('is_featured', 'true')
                            else params.delete('is_featured')
                        }
                        params.set('page', '1')
                        router.push(`${pathname}?${params.toString()}`)
                    }}
                    defaultOpen={false}
                />
            </div>
        </div>
    )
}
