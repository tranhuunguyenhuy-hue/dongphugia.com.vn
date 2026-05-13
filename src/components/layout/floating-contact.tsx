"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, X } from "lucide-react"
import { ChatboxWidget } from "@/components/ui/chatbox-widget"



// Buttons configuration removed since ChatboxWidget will be the main interaction

export function FloatingContact() {
    const [isMounted, setIsMounted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const pathname = usePathname()

    // Fade in after 1s
    useEffect(() => {
        // eslint-disable-next-line
        setIsMounted(true)
    }, [])

    // Handle outside click to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    if (!isMounted) return null

    const isProductPage = pathname?.includes('/gach-op-lat/') || pathname?.includes('/thiet-bi-ve-sinh/') || pathname?.includes('/thiet-bi-bep/') || pathname?.includes('/vat-lieu-nuoc/')
    const mobileBottomClass = isProductPage ? "bottom-[calc(85px+env(safe-area-inset-bottom))]" : "bottom-6"

    return (
        <div 
            ref={menuRef} 
            className={`fixed ${mobileBottomClass} lg:bottom-6 right-5 z-50 flex flex-col items-center gap-3 transition-all duration-300`}
            aria-label="Liên hệ nhanh"
        >
            {/* Chatbox Widget renders relative to this container */}
            <ChatboxWidget isOpen={isOpen} onClose={() => setIsOpen(false)} />

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative flex items-center justify-center
                    rounded-full bg-[#2E7A96] text-white
                    shadow-[0_4px_16px_rgba(46,122,150,0.5)]
                    transition-all duration-300 hover:scale-105 active:scale-95
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
                `}
                style={{ width: "56px", height: "56px" }}
                aria-label={isOpen ? "Đóng menu liên hệ" : "Mở menu liên hệ"}
            >
                {/* Pulse ring for main button when closed */}
                {!isOpen && (
                    <>
                        <span className="absolute inset-0 rounded-full bg-[#2E7A96] animate-ping opacity-30" />
                        <span className="absolute inset-[-4px] rounded-full bg-[#2E7A96]/20 animate-pulse" />
                    </>
                )}
                
                <div className={`transition-transform duration-300 absolute flex items-center justify-center ${isOpen ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}>
                    <MessageCircle className="w-7 h-7 fill-white/20" />
                </div>
                <div className={`transition-transform duration-300 absolute flex items-center justify-center ${isOpen ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"}`}>
                    <X className="w-8 h-8" />
                </div>
            </button>
        </div>
    )
}
