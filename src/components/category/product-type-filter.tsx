'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

// ── Sub-type config (only for types that have sub_types) ──────────────────────
type TypeOption = { slug: string; label: string }

type TypeConfig = {
    slug: string
    label: string
    subTypes?: TypeOption[]
}

// ── Full config per subcategory slug ─────────────────────────────────────────
export const SUBCATEGORY_TYPE_CONFIG: Record<string, TypeConfig[]> = {
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
        { slug: 'duong-vanh', label: 'Dương Vành' },
        { slug: 'lavabo-treo-tuong', label: 'Treo Tường' },
        { slug: 'lavabo-am-ban', label: 'Âm Bàn' },
        { slug: 'lavabo-ban-am', label: 'Bán Âm' },
        { slug: 'chan-chau', label: 'Chân Chậu' },
        { slug: 'tu-chau', label: 'Bộ Tủ Chậu' },
    ],
    'chau-lavabo': [
        { slug: '', label: 'Tất cả' },
        { slug: 'lavabo-dat-ban', label: 'Đặt Bàn' },
        { slug: 'duong-vanh', label: 'Dương Vành' },
        { slug: 'lavabo-treo-tuong', label: 'Treo Tường' },
        { slug: 'lavabo-am-ban', label: 'Âm Bàn' },
        { slug: 'lavabo-ban-am', label: 'Bán Âm' },
        { slug: 'chan-chau', label: 'Chân Chậu' },
        { slug: 'tu-chau', label: 'Bộ Tủ Chậu' },
    ],
    'sen-tam': [
        { slug: '', label: 'Tất cả' },
        { slug: 'tay-sen', label: 'Tay Sen' },
        { slug: 'sen-dung', label: 'Sen Đứng' },
        { slug: 'cu-sen', label: 'Củ Sen' },
        {
            slug: 'sen-am-tuong',
            label: 'Âm Tường',
            subTypes: [
                { slug: '', label: 'Tất cả' },
                { slug: '1-duong', label: '1 Đường Nước' },
                { slug: '2-duong', label: '2 Đường Nước' },
                { slug: '3-duong', label: '3+ Đường' },
                { slug: 'nhiet-do', label: 'Ổn Nhiệt' },
            ],
        },
        {
            slug: 'phu-kien',
            label: 'Phụ Kiện',
            subTypes: [
                { slug: '', label: 'Tất cả' },
                { slug: 'bat-sen', label: 'Bát Sen' },
                { slug: 'tay-sen-dau', label: 'Đầu Sen' },
                { slug: 'gac-sen', label: 'Gác / Cút Nối' },
                { slug: 'thanh-truot', label: 'Thanh Trượt' },
                { slug: 'day-sen', label: 'Dây & Cần Sen' },
                { slug: 'mat-dieu-khien', label: 'Mặt Điều Khiển' },
                { slug: 'linh-kien', label: 'Linh Kiện' },
            ],
        },
    ],
    'bon-tam': [
        { slug: '', label: 'Tất cả' },
        { slug: 'bon-tam', label: 'Thường' },
        { slug: 'bon-tam-massage', label: 'Massage' },
        { slug: 'bon-tam-xay', label: 'Xây' },
    ],
    'nap-bon-cau': [
        { slug: '', label: 'Tất cả' },
        { slug: 'nap-thuong-dong-em', label: 'Thường / Đóng Êm' },
        { slug: 'nap-dien-tu', label: 'Điện Tử / Thông Minh' },
        { slug: 'nap-rua-co', label: 'Rửa Cơ' },
    ],
}

// Backward-compat export
export const BON_CAU_TYPES = SUBCATEGORY_TYPE_CONFIG['bon-cau']

interface ProductTypeFilterProps {
    activeSubSlug?: string
}

// ── Segmented tab button ───────────────────────────────────────────────────────
function TabButton({
    label,
    isActive,
    onClick,
    size = 'md',
}: {
    label: string
    isActive: boolean
    onClick: () => void
    size?: 'sm' | 'md'
}) {
    return (
        <button
            onClick={onClick}
            role="radio"
            aria-checked={isActive}
            className={`
                relative whitespace-nowrap select-none cursor-pointer
                transition-all duration-200
                ${size === 'md'
                    ? 'px-3.5 py-1.5 rounded-lg text-[11px] font-medium'
                    : 'px-2.5 py-1 rounded-md text-[10.5px] font-medium'
                }
                ${isActive
                    ? [
                        'bg-white text-[#2E7A96] font-semibold',
                        'shadow-[0_1px_3px_0_rgba(0,0,0,0.08),0_0_0_1px_rgba(46,122,150,0.12)]',
                    ].join(' ')
                    : [
                        'text-neutral-500 hover:text-neutral-800 hover:bg-white/60',
                    ].join(' ')
                }
            `}
        >
            {/* Active dot */}
            {isActive && (
                <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#2E7A96]/70" />
            )}
            {label}
        </button>
    )
}

// ── Divider ────────────────────────────────────────────────────────────────────
function RowLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 shrink-0">
            <span className="block w-[2.5px] h-3.5 rounded-full bg-[#2E7A96]/40" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                {children}
            </span>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ProductTypeFilter({ activeSubSlug }: ProductTypeFilterProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const types = activeSubSlug ? SUBCATEGORY_TYPE_CONFIG[activeSubSlug] : undefined
    if (!types || types.length <= 1) return null

    const activeType = searchParams.get('type') || ''
    const activeSubType = searchParams.get('subtype') || ''

    // Active type config (for sub-types)
    const activeTypeConfig = types.find(t => t.slug === activeType)
    const subTypes = activeTypeConfig?.subTypes

    const setType = useCallback((typeSlug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (typeSlug) {
            params.set('type', typeSlug)
        } else {
            params.delete('type')
        }
        // Reset sub-type when switching primary type
        params.delete('subtype')
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const setSubType = useCallback((subTypeSlug: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (subTypeSlug) {
            params.set('subtype', subTypeSlug)
        } else {
            params.delete('subtype')
        }
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    return (
        <div className="w-full flex flex-col gap-2.5">
            {/* ── Row 1: Primary type tabs ── */}
            <div className="w-full flex items-center gap-3 flex-wrap">
                <RowLabel>Loại sản phẩm</RowLabel>

                <div
                    className="inline-flex items-center gap-0.5 bg-neutral-100/70 rounded-xl p-1 flex-wrap"
                    role="group"
                    aria-label="Lọc theo loại sản phẩm"
                >
                    {types.map((type) => (
                        <TabButton
                            key={type.slug || 'all'}
                            label={type.label}
                            isActive={activeType === type.slug}
                            onClick={() => setType(type.slug)}
                            size="md"
                        />
                    ))}
                </div>
            </div>

            {/* ── Row 2: Sub-type tabs (only when active type has sub_types) ── */}
            {subTypes && subTypes.length > 1 && (
                <div
                    className="w-full flex items-center gap-3 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200"
                >
                    {/* Indent line indicating hierarchy */}
                    <div className="flex items-center gap-3 pl-3 border-l-2 border-[#2E7A96]/15">
                        <RowLabel>Loại chi tiết</RowLabel>

                        <div
                            className="inline-flex items-center gap-0.5 bg-[#2E7A96]/5 rounded-lg p-0.5 flex-wrap"
                            role="group"
                            aria-label="Lọc theo loại chi tiết"
                        >
                            {subTypes.map((st) => (
                                <TabButton
                                    key={st.slug || 'all-sub'}
                                    label={st.label}
                                    isActive={activeSubType === st.slug}
                                    onClick={() => setSubType(st.slug)}
                                    size="sm"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
