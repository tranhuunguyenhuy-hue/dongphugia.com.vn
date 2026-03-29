"use client"

import { useState, useEffect } from "react"
import { Phone } from "lucide-react"

// Zalo SVG icon
function ZaloIcon() {
    return (
        <svg viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
            <path d="M16 2C8.268 2 2 8.268 2 16c0 2.52.676 4.88 1.856 6.916L2 30l7.312-1.828A13.932 13.932 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm-3.36 8.32h6.4c.44 0 .8.36.8.8s-.36.8-.8.8h-4.924l5.46 6.16c.22.248.26.604.1.892a.799.799 0 01-.716.428H12.56a.8.8 0 010-1.6h4.992l-5.46-6.16a.8.8 0 01.548-1.32zm9.12 8.32c.44 0 .8.36.8.8s-.36.8-.8.8h-1.6a.8.8 0 010-1.6h1.6zm-9.6-.4a2 2 0 110 4 2 2 0 010-4zm4 0a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
    )
}

// Messenger SVG icon
function MessengerIcon() {
    return (
        <svg viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
            <path d="M16 2C8.268 2 2 7.82 2 15c0 3.84 1.676 7.3 4.38 9.776V29l4.22-2.316A14.3 14.3 0 0016 27c7.732 0 14-5.82 14-12S23.732 2 16 2zm1.4 16.12l-3.56-3.8-6.96 3.8 7.66-8.12 3.64 3.8 6.88-3.8-7.66 8.12z" />
        </svg>
    )
}

const ZALO_URL = "https://zalo.me/0263352031"
const MESSENGER_URL = "https://m.me/dongphugia"
const PHONE_NUMBER = "tel:02633520316"

interface ContactButton {
    id: string
    label: string
    href: string
    bg: string
    hoverBg: string
    shadow: string
    icon: React.ReactNode
    pulse?: boolean
}

const buttons: ContactButton[] = [
    {
        id: "zalo",
        label: "Chat Zalo",
        href: ZALO_URL,
        bg: "bg-[#0068FF]",
        hoverBg: "hover:bg-[#0055d4]",
        shadow: "shadow-[0_4px_16px_rgba(0,104,255,0.45)]",
        icon: <ZaloIcon />,
    },
    {
        id: "messenger",
        label: "Messenger",
        href: MESSENGER_URL,
        bg: "bg-[#0099FF]",
        hoverBg: "hover:bg-[#007dd4]",
        shadow: "shadow-[0_4px_16px_rgba(0,153,255,0.45)]",
        icon: <MessengerIcon />,
    },
    {
        id: "phone",
        label: "Gọi ngay",
        href: PHONE_NUMBER,
        bg: "bg-[#2E7A96]",
        hoverBg: "hover:bg-[#2E7A96]",
        shadow: "shadow-[0_4px_16px_rgba(22,163,74,0.5)]",
        icon: <Phone className="w-6 h-6 fill-white stroke-none" />,
        pulse: true,
    },
]

export function FloatingContact() {
    const [visible, setVisible] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    // Fade in after 1s
    useEffect(() => {
        setIsMounted(true)
        const t = setTimeout(() => setVisible(true), 1000)
        return () => clearTimeout(t)
    }, [])

    if (!isMounted) return null

    return (
        <div
            className={`fixed bottom-6 right-5 z-50 flex flex-col items-center gap-3 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
            aria-label="Liên hệ nhanh"
        >
            {buttons.map((btn) => (
                <div key={btn.id} className="group relative flex items-center justify-end">
                    {/* Tooltip label */}
                    <span className="
                        absolute right-[calc(100%+12px)] whitespace-nowrap
                        bg-[#1a1a1a] text-white text-xs font-semibold
                        px-3 py-1.5 rounded-lg
                        opacity-0 pointer-events-none
                        group-hover:opacity-100
                        transition-opacity duration-200
                        shadow-lg
                        after:content-[''] after:absolute after:left-full after:top-1/2 after:-translate-y-1/2
                        after:border-4 after:border-transparent after:border-l-[#1a1a1a]
                    ">
                        {btn.label}
                    </span>

                    {/* Button */}
                    <a
                        href={btn.href}
                        target={btn.id !== "phone" ? "_blank" : undefined}
                        rel={btn.id !== "phone" ? "noopener noreferrer" : undefined}
                        aria-label={btn.label}
                        className={`
                            relative flex items-center justify-center
                            w-13 h-13 rounded-full
                            ${btn.bg} ${btn.hoverBg} ${btn.shadow}
                            transition-all duration-200
                            hover:scale-110 active:scale-95
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60
                        `}
                        style={{ width: "52px", height: "52px" }}
                    >
                        {/* Pulse ring for phone */}
                        {btn.pulse && (
                            <>
                                <span className="absolute inset-0 rounded-full bg-[#2E7A96] animate-ping opacity-30" />
                                <span className="absolute inset-[-4px] rounded-full bg-[#2E7A96]/20 animate-pulse" />
                            </>
                        )}
                        {btn.icon}
                    </a>
                </div>
            ))}
        </div>
    )
}
