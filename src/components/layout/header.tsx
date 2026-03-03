"use client"

import Link from "next/link"
import Image from "next/image"
import { Phone, Menu, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

const PRODUCT_CATEGORIES = [
    { label: "Gạch ốp lát", href: "/gach-op-lat", active: true },
    { label: "Thiết bị vệ sinh", href: "/thiet-bi-ve-sinh", active: true },
    { label: "Thiết bị bếp", href: "/thiet-bi-bep", active: true },
    { label: "Vật liệu nước", href: "/vat-lieu-nuoc", active: true },
    { label: "Sàn gỗ", href: "/san-go", active: true },
]

const NAV_LINKS = [
    { label: "Về chúng tôi", href: "/ve-chung-toi" },
    { label: "Đối tác", href: "/doi-tac" },
    { label: "Dự án", href: "/du-an" },
    { label: "Tin tức", href: "/tin-tuc" },
]

function ProductsDropdown() {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center gap-1 font-medium text-[16px] leading-[18px] transition-colors",
                    open ? "text-[#15803d]" : "text-[#111827] hover:text-[#15803d]"
                )}
            >
                Sản phẩm
                <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
                />
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-2 w-[220px] rounded-2xl border border-[#e5e7eb] bg-white shadow-[0px_6px_15px_0px_rgba(16,24,40,0.08)] z-50 overflow-hidden">
                    <div className="py-2">
                        {PRODUCT_CATEGORIES.map((cat) =>
                            cat.active ? (
                                <Link
                                    key={cat.href}
                                    href={cat.href}
                                    onClick={() => setOpen(false)}
                                    className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-[#111827] hover:bg-[#f0fdf4] hover:text-[#15803d] transition-colors"
                                >
                                    {cat.label}
                                    <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                                </Link>
                            ) : (
                                <div
                                    key={cat.href}
                                    className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-[#9ca3af] cursor-not-allowed"
                                    title="Sắp có"
                                >
                                    {cat.label}
                                    <ChevronRight className="h-4 w-4 text-[#d1d5db]" />
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const TOPBAR_TEXT = "Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất. • Liên hệ: 0263 3520 316 • "

export function Header() {
    return (
        <header className="relative w-full z-50 sticky top-0 transition-all duration-300 bg-[#e6f9ed]">
            {/* Original Topbar - Full Width, Fixed at the top visually */}
            <div className="bg-[#15803d] py-3 w-full relative z-10">
                {/* Desktop: centered static */}
                <div className="hidden sm:flex max-w-[1280px] mx-auto px-5 justify-center items-center gap-1">
                    <p className="text-[14px] font-medium leading-[16px] text-[#86efac]">
                        Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất.
                    </p>
                    <div className="flex items-center gap-1 pl-1">
                        <span className="text-[14px] font-medium leading-[16px] text-white">Liên hệ:</span>
                        <a
                            href="tel:02633520316"
                            className="text-[14px] font-medium leading-[16px] text-white underline underline-offset-2 hover:text-[#bbf7d0] transition-colors"
                        >
                            0263 3520 316
                        </a>
                    </div>
                </div>

                {/* Mobile: marquee scrolling text */}
                <div className="sm:hidden overflow-hidden whitespace-nowrap">
                    <div className="inline-flex animate-marquee">
                        {/* 4 copies for seamless loop */}
                        <span className="text-[14px] font-medium leading-[16px] text-[#86efac] pr-16">{TOPBAR_TEXT}</span>
                        <span className="text-[14px] font-medium leading-[16px] text-[#86efac] pr-16">{TOPBAR_TEXT}</span>
                        <span className="text-[14px] font-medium leading-[16px] text-[#86efac] pr-16">{TOPBAR_TEXT}</span>
                        <span className="text-[14px] font-medium leading-[16px] text-[#86efac] pr-16">{TOPBAR_TEXT}</span>
                    </div>
                </div>
            </div>

            {/* Floating Menu Card Container */}
            <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-3 lg:py-6">
                <div className="max-w-[1280px] mx-auto bg-white/40 backdrop-blur-3xl rounded-[32px] sm:rounded-[40px] shadow-[0_8px_40px_-12px_rgba(21,128,61,0.15)] border border-white/60">
                    <div className="px-6 lg:px-10 h-[64px] lg:h-[72px] flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center shrink-0" aria-label="Đông Phú Gia - Trang chủ">
                            <Image
                                src="/images/logo.png"
                                alt="Đông Phú Gia"
                                width={152}
                                height={32}
                                priority
                                className="h-8 lg:h-9 w-auto object-contain"
                            />
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center gap-8" aria-label="Menu chính">
                            {/* Sản phẩm dropdown — first item */}
                            <ProductsDropdown />

                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-[15px] font-medium leading-[18px] text-[#111827] hover:text-[#15803d] transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* CTA Button */}
                        <div className="hidden lg:flex items-center">
                            <a href="tel:02633520316" aria-label="Gọi điện tư vấn: 0263 3520 316">
                                <Button className="bg-[#15803d] hover:bg-[#14532d] text-white rounded-full px-6 h-11 text-[14px] font-medium gap-2 shadow-[0_4px_12px_rgba(21,128,61,0.2)] hover:shadow-[0_6px_16px_rgba(21,128,61,0.25)] transition-all hover:-translate-y-0.5">
                                    <Phone className="h-4 w-4" aria-hidden="true" />
                                    Liên hệ tư vấn
                                </Button>
                            </a>
                        </div>

                        {/* Mobile Menu */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu điều hướng">
                                    <Menu className="h-6 w-6 text-[#111827]" aria-hidden="true" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] p-0 border-r-0 rounded-r-[24px]">
                                <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                                <div className="flex flex-col h-full bg-white/95 backdrop-blur-xl">
                                    {/* Mobile header */}
                                    <div className="flex items-center px-6 h-[72px] border-b border-gray-100">
                                        <Image
                                            src="/images/logo.png"
                                            alt="Đông Phú Gia"
                                            width={140}
                                            height={32}
                                            className="h-8 w-auto object-contain"
                                        />
                                    </div>

                                    {/* Mobile nav */}
                                    <nav className="flex-1 overflow-y-auto py-6">
                                        {/* Sản phẩm section */}
                                        <div className="px-6 pb-4">
                                            <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">
                                                Sản phẩm
                                            </p>
                                            {PRODUCT_CATEGORIES.map((cat) =>
                                                cat.active ? (
                                                    <Link
                                                        key={cat.href}
                                                        href={cat.href}
                                                        className="flex items-center justify-between py-3 text-[15px] font-semibold text-[#111827] hover:text-[#15803d] transition-colors"
                                                    >
                                                        {cat.label}
                                                        <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                                                    </Link>
                                                ) : (
                                                    <div
                                                        key={cat.href}
                                                        className="flex items-center justify-between py-3 text-[15px] font-semibold text-[#d1d5db] cursor-not-allowed"
                                                        title="Sắp có"
                                                    >
                                                        {cat.label}
                                                        <span className="text-[10px] font-bold bg-[#f3f4f6] text-[#9ca3af] px-2 py-0.5 rounded-full">
                                                            Sắp có
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mx-6 my-2" />

                                        {/* Other nav links */}
                                        <div className="px-6 py-4">
                                            <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">
                                                Menu chính
                                            </p>
                                            {NAV_LINKS.map((link) => (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    className="block py-3 text-[15px] font-medium text-[#111827] hover:text-[#15803d] transition-colors"
                                                >
                                                    {link.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </nav>

                                    {/* Mobile CTA */}
                                    <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                                        <a href="tel:02633520316" className="block w-full">
                                            <Button className="w-full bg-[#15803d] hover:bg-[#14532d] text-white rounded-full h-12 gap-2 shadow-md">
                                                <Phone className="h-4 w-4" />
                                                Gọi tư vấn: 0263 3520 316
                                            </Button>
                                        </a>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    )
}
