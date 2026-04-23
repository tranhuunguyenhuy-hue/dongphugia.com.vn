'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowUpNarrowWide, ArrowDownWideNarrow, Clock, ChevronDown, Check } from 'lucide-react'

// ── Sort option config ──────────────────────────────────────────────────────────
const SORT_OPTIONS = [
    {
        value: 'default',
        label: 'Mặc định',
        description: 'Mới nhất trước',
        icon: Clock,
    },
    {
        value: 'price-asc',
        label: 'Giá tăng dần',
        description: 'Thấp → Cao',
        icon: ArrowUpNarrowWide,
    },
    {
        value: 'price-desc',
        label: 'Giá giảm dần',
        description: 'Cao → Thấp',
        icon: ArrowDownWideNarrow,
    },
] as const

export function CategorySort() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const currentSort = searchParams.get('sort') || 'default'
    const isActive = currentSort !== 'default'
    const activeOption = SORT_OPTIONS.find(o => o.value === currentSort) ?? SORT_OPTIONS[0]

    const handleSelect = useCallback((value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === 'default') {
            params.delete('sort')
        } else {
            params.set('sort', value)
        }
        params.set('page', '1')
        setOpen(false)
        router.push(`${pathname}?${params.toString()}`)
    }, [router, pathname, searchParams])

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-haspopup="listbox"
                className={`
                    inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md
                    border bg-transparent
                    text-[11px] font-medium cursor-pointer select-none
                    transition-all duration-150 outline-none
                    ${isActive
                        ? 'border-[#2E7A96]/25 bg-[#2E7A96]/[0.04] text-[#2E7A96]'
                        : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 hover:bg-neutral-50'
                    }
                    ${open ? 'border-neutral-300 bg-neutral-50 text-neutral-600' : ''}
                `}
            >
                <svg className="size-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V4.5" />
                </svg>
                <span>{activeOption.label}</span>
                <ChevronDown className={`size-3 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    className="
                        absolute right-0 top-[calc(100%+6px)] z-50
                        w-[200px] bg-white rounded-xl
                        border border-neutral-200/80
                        shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.04)]
                        py-1.5
                        animate-in fade-in-0 zoom-in-95 slide-in-from-top-1
                        origin-top-right duration-150
                    "
                    role="listbox"
                    aria-label="Sắp xếp sản phẩm"
                >
                    {/* Header */}
                    <div className="px-3 py-1.5 mb-1">
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-300">
                            Sắp xếp theo
                        </p>
                    </div>

                    {/* Options */}
                    {SORT_OPTIONS.map((opt) => {
                        const isSelected = currentSort === opt.value
                        const Icon = opt.icon
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(opt.value)}
                                className={`
                                    w-full flex items-center gap-2.5 px-3 py-2 mx-0
                                    text-left cursor-pointer transition-colors duration-100
                                    ${isSelected
                                        ? 'bg-[#2E7A96]/[0.05]'
                                        : 'hover:bg-neutral-50'
                                    }
                                `}
                            >
                                {/* Icon */}
                                <div className={`
                                    flex items-center justify-center w-7 h-7 rounded-lg shrink-0
                                    transition-colors duration-150
                                    ${isSelected
                                        ? 'bg-[#2E7A96]/10 text-[#2E7A96]'
                                        : 'bg-neutral-100 text-neutral-400'
                                    }
                                `}>
                                    <Icon className="size-3.5" strokeWidth={1.8} />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-medium leading-tight ${
                                        isSelected ? 'text-[#2E7A96]' : 'text-neutral-700'
                                    }`}>
                                        {opt.label}
                                    </p>
                                    <p className="text-[9px] text-neutral-400 leading-tight mt-0.5">
                                        {opt.description}
                                    </p>
                                </div>

                                {/* Check indicator */}
                                {isSelected && (
                                    <Check className="size-3.5 text-[#2E7A96] shrink-0" strokeWidth={2.5} />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
