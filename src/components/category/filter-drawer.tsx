'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Filter, SlidersHorizontal, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// ────────── Types ──────────

export interface FilterDrawerProps {
    /** Accessible title for the drawer */
    title: string;
    /** Filter param keys to count active filters, e.g. ["brand","subtype"] */
    filterKeys: string[];
    /** Product count for the footer CTA */
    productCount?: number;
    /** Drawer style: 'sheet' = Shadcn Sheet (side-right), 'bottom' = bottom-sheet */
    style?: 'sheet' | 'bottom';
    /** Children = the SmartFilter component */
    children: React.ReactNode;
}

// ────────── FilterDrawer (unified) ──────────

export function FilterDrawer({
    title,
    filterKeys,
    productCount,
    style = 'sheet',
    children,
}: FilterDrawerProps) {
    const [open, setOpen] = useState(false)
    const searchParams = useSearchParams()

    // Count active filters
    const activeFilterCount = filterKeys.reduce((count, key) => {
        const val = searchParams.get(key)
        if (!val) return count
        return count + val.split(',').filter(Boolean).length
    }, 0)

    // ── Sheet variant (TBVS/Bep/Nuoc/Sango) ──
    if (style === 'sheet') {
        return (
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <button className="flex items-center gap-2 border border-[#C8D9E0] rounded-[var(--radius)] px-4 py-2 text-[14px] font-medium text-[#3C4E56] bg-white hover:bg-gray-50 transition-colors">
                        <Filter className="w-4 h-4 text-[#6A8A97]" />
                        <span>Bộ lọc {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
                    </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[320px] sm:w-[400px] bg-white p-0 border-l border-[#C8D9E0]" showCloseButton={false}>
                    <SheetTitle className="sr-only">{title}</SheetTitle>
                    <SheetDescription className="sr-only">Lọc sản phẩm trên di động</SheetDescription>
                    <div className="flex flex-col h-full bg-[#fcfcfc]">
                        <div className="flex-1 overflow-y-auto px-5 py-6">
                            {children}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        )
    }

    // ── Bottom-sheet variant (Gạch ốp lát) ──
    return (
        <BottomSheetDrawer
            isOpen={open}
            setIsOpen={setOpen}
            activeFilterCount={activeFilterCount}
            filterKeys={filterKeys}
            productCount={productCount}
        >
            {children}
        </BottomSheetDrawer>
    )
}

// ── Internal BottomSheet component ──

function BottomSheetDrawer({
    isOpen,
    setIsOpen,
    activeFilterCount,
    filterKeys,
    productCount,
    children,
}: {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    activeFilterCount: number;
    filterKeys: string[];
    productCount?: number;
    children: React.ReactNode;
}) {
    // Lock body scroll when drawer open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [setIsOpen])

    return (
        <>
            {/* Trigger Button (mobile/tablet only) */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden flex items-center gap-2 h-[44px] px-5 rounded-[var(--radius)] border border-[#44A0BA] bg-white text-[#2E7A96] font-semibold text-[14px] hover:bg-[#EAF6FB] transition-colors"
            >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
                <span>Bộ lọc</span>
                {activeFilterCount > 0 && (
                    <span className="ml-1 bg-[#2E7A96] text-white text-[11px] font-bold w-5 h-5 rounded-[var(--radius)] flex items-center justify-center">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Bottom Sheet Drawer */}
            <div
                className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'
                    }`}
                style={{ maxHeight: '85dvh' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-[#C8D9E0]" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4EEF2] shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="text-[18px] font-semibold text-[#192125]">Bộ lọc thông minh</h3>
                        {activeFilterCount > 0 && (
                            <span className="bg-[#EAF6FB] text-[#2E7A96] text-[12px] font-semibold px-2 py-0.5 rounded-[var(--radius)] border border-[#C5E8F5]">
                                {activeFilterCount} đang dùng
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#E4EEF2] transition-colors"
                        aria-label="Đóng bộ lọc"
                    >
                        <X className="h-5 w-5 text-[#6A8A97]" />
                    </button>
                </div>

                {/* Filter Content — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 py-6">
                    {children}
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 border-t border-[#E4EEF2] px-5 py-4 flex items-center justify-between gap-3 pb-safe">
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => {
                                const url = new URL(window.location.href)
                                filterKeys.forEach(k => url.searchParams.delete(k))
                                window.location.href = url.toString()
                            }}
                            className="text-[14px] font-medium text-[#6A8A97] underline underline-offset-2 hover:text-[#3C4E56]"
                        >
                            Xoá bộ lọc
                        </button>
                    )}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="flex-1 h-[48px] rounded-[var(--radius)] bg-[#2E7A96] text-white font-semibold text-[15px] hover:bg-[#216077] transition-colors"
                    >
                        Xem {productCount ?? ''} sản phẩm
                    </button>
                </div>
            </div>
        </>
    )
}
