'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

// ── Type configs per subcategory slug ────────────────────────────────────────
// Each entry maps a subcategory URL slug → array of product_type values from DB
export const SUBCATEGORY_TYPE_CONFIG: Record<string, { slug: string; label: string }[]> = {
    'bon-cau': [
        { slug: '', label: 'Tất cả' },
        { slug: 'bon-cau-1-khoi', label: '1 Khối' },
        { slug: 'bon-cau-2-khoi', label: '2 Khối' },
        { slug: 'bon-cau-treo-tuong', label: 'Treo Tường' },
        { slug: 'bon-cau-dat-san', label: 'Đặt Sàn' },
        { slug: 'bon-cau-thong-minh', label: 'Thông Minh' },
    ],
    'lavabo': [
        { slug: '', label: 'Tất cả' },
        { slug: 'lavabo-dat-ban', label: 'Đặt Bàn' },
        { slug: 'lavabo-treo-tuong', label: 'Treo Tường' },
        { slug: 'lavabo-am-ban', label: 'Âm Bàn' },
        { slug: 'lavabo-ban-am', label: 'Bán Âm' },
        { slug: 'lavabo', label: 'Khác' },
    ],
    'chau-lavabo': [
        { slug: '', label: 'Tất cả' },
        { slug: 'lavabo-dat-ban', label: 'Đặt Bàn' },
        { slug: 'lavabo-treo-tuong', label: 'Treo Tường' },
        { slug: 'lavabo-am-ban', label: 'Âm Bàn' },
        { slug: 'lavabo-ban-am', label: 'Bán Âm' },
        { slug: 'lavabo', label: 'Khác' },
    ],
    'sen-tam': [
        { slug: '', label: 'Tất cả' },
        { slug: 'sen-am-tuong', label: 'Âm Tường' },
        { slug: 'sen-cay', label: 'Sen Cây' },
        { slug: 'sen-cay-nhiet-do', label: 'Cây Nhiệt Độ' },
        { slug: 'sen-nhiet-do', label: 'Nhiệt Độ' },
        { slug: 'tay-sen', label: 'Tay Sen' },
        { slug: 'bat-sen', label: 'Bát Sen' },
    ],
    'bon-tam': [
        { slug: '', label: 'Tất cả' },
        { slug: 'bon-tam', label: 'Thường' },
        { slug: 'bon-tam-massage', label: 'Massage' },
        { slug: 'bon-tam-xay', label: 'Xây' },
    ],
}

// Backward-compat export
export const BON_CAU_TYPES = SUBCATEGORY_TYPE_CONFIG['bon-cau']

interface ProductTypeFilterProps {
    /** The active subcategory slug (e.g. 'bon-cau', 'lavabo', 'sen-tam') */
    activeSubSlug?: string
}

export function ProductTypeFilter({ activeSubSlug }: ProductTypeFilterProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Only show if this subcategory has a type config
    const types = activeSubSlug ? SUBCATEGORY_TYPE_CONFIG[activeSubSlug] : undefined
    if (!types || types.length <= 1) return null

    const activeType = searchParams.get('type') || ''

    const setType = useCallback((typeSlug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (typeSlug) {
            params.set('type', typeSlug)
        } else {
            params.delete('type')
        }
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest shrink-0 mr-1">
                Loại:
            </span>
            {types.map((type) => {
                const isActive = activeType === type.slug
                return (
                    <button
                        key={type.slug || 'all'}
                        onClick={() => setType(type.slug)}
                        className={`
                            px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border
                            ${isActive
                                ? 'bg-[#2E7A96] text-white border-[#2E7A96] shadow-sm'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#2E7A96]/40 hover:text-[#2E7A96]'
                            }
                        `}
                    >
                        {type.label}
                    </button>
                )
            })}
        </div>
    )
}
