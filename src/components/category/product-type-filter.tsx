'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

// ── Type configs per subcategory slug ────────────────────────────────────────
export const SUBCATEGORY_TYPE_CONFIG: Record<string, { slug: string; label: string; icon?: string }[]> = {
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
    activeSubSlug?: string
}

export function ProductTypeFilter({ activeSubSlug }: ProductTypeFilterProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

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
        /* ── Hierarchical container below SubcategoryIconGrid ── */
        <div className="w-full">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                    {/* Decorative accent */}
                    <span className="block w-[3px] h-4 rounded-full bg-[#2E7A96]/40" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                        Kiểu sản phẩm
                    </span>
                </div>
                <div className="flex-1 h-px bg-neutral-100" />
            </div>

            {/* Segmented control — premium macOS-style */}
            <div
                className="inline-flex items-center gap-1 bg-neutral-100/70 rounded-2xl p-1.5 flex-wrap"
                role="group"
                aria-label="Lọc theo kiểu sản phẩm"
            >
                {types.map((type) => {
                    const isActive = activeType === type.slug
                    return (
                        <button
                            key={type.slug || 'all'}
                            onClick={() => setType(type.slug)}
                            role="radio"
                            aria-checked={isActive}
                            className={`
                                relative px-4 py-2 rounded-xl text-[13px] font-medium
                                transition-all duration-200 cursor-pointer select-none
                                whitespace-nowrap
                                ${isActive
                                    ? [
                                        'bg-white text-[#2E7A96] font-semibold',
                                        'shadow-[0_1px_4px_0_rgba(0,0,0,0.10),0_0_0_1px_rgba(46,122,150,0.12)]',
                                      ].join(' ')
                                    : [
                                        'text-neutral-500 hover:text-neutral-800 hover:bg-white/50',
                                      ].join(' ')
                                }
                            `}
                        >
                            {/* Active indicator dot */}
                            {isActive && (
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#2E7A96]/70" />
                            )}
                            {type.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
