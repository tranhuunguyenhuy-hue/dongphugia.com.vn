"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import type { ProjectItem } from "@/lib/public-api-projects"

// --- Custom Hook for Scroll Reveal ---
function useScrollReveal(threshold = 0.1) {
    const ref = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    observer.unobserve(entry.target)
                }
            },
            { threshold, rootMargin: "0px 0px -50px 0px" }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [threshold])

    return { ref, isVisible }
}

function Reveal({ children, delay = 0, direction = "up" }: { children: React.ReactNode, delay?: number, direction?: "up" | "left" | "right" | "fade" }) {
    const { ref, isVisible } = useScrollReveal()
    let translate = "translate-y-8"
    if (direction === "left") translate = "-translate-x-8"
    if (direction === "right") translate = "translate-x-8"
    if (direction === "fade") translate = ""

    return (
        <div
            ref={ref}
            className={`transition-all duration-1000 ease-out fill-mode-forwards ${isVisible ? `opacity-100 translate-x-0 translate-y-0` : `opacity-0 ${translate}`
                }`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    )
}

const ASPECT_RATIOS = ["aspect-[4/3]", "aspect-[3/4]", "aspect-[1/1]", "aspect-[4/5]", "aspect-[4/3]", "aspect-[3/4]"]

export function ProjectsClient({ projects }: { projects: ProjectItem[] }) {
    // Build dynamic tabs from real data categories
    const tabs = useMemo(() => {
        const cats = Array.from(new Set(projects.map(p => p.category).filter(Boolean) as string[]))
        return ["Tất cả", ...cats]
    }, [projects])
    const [activeTab, setActiveTab] = useState("Tất cả")
    const [isAnimating, setIsAnimating] = useState(false)

    const handleTabChange = (tab: string) => {
        if (tab === activeTab) return;
        setIsAnimating(true);
        setTimeout(() => {
            setActiveTab(tab);
            setIsAnimating(false);
        }, 300);
    }

    const filteredProjects = useMemo(() => {
        if (activeTab === "Tất cả") return projects
        return projects.filter(p => p.category === activeTab)
    }, [activeTab, projects])

    return (
        <main className="bg-white overflow-hidden selection:bg-[#2E7A96] selection:text-white pb-24 min-h-screen">

            {/* ── 1. Header (Gallery Intro) ── */}
            <section className="relative pt-32 pb-20 px-5 max-w-[1280px] mx-auto text-center">
                <Reveal delay={100}>
                    <p className="text-[#2E7A96] font-bold tracking-widest uppercase text-sm mb-6">
                        Triển lãm kiến trúc
                    </p>
                </Reveal>
                <Reveal delay={200}>
                    <h1 className="text-5xl md:text-7xl font-bold text-[#192125] tracking-tighter leading-[1.1] mb-8 max-w-4xl mx-auto">
                        Dấu ấn <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2E7A96] to-[#44A0BA]">Đông Phú Gia</span><br className="hidden md:block" /> tại các công trình
                    </h1>
                </Reveal>
            </section>

            {/* ── 2. Isotope Tabs (Filters) ── */}
            <section className="max-w-[1280px] mx-auto px-5 mb-16">
                <Reveal delay={400}>
                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`px-6 py-2.5 rounded-full text-base font-semibold transition-all duration-300 border ${activeTab === tab
                                    ? "bg-[#192125] text-white border-[#192125] shadow-lg shadow-black/10 scale-105"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-900"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </Reveal>
            </section>

            {/* ── 3. Masonry Gallery ── */}
            <section className="max-w-[1440px] mx-auto px-5 mb-32">
                <div className={`transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 md:gap-8 space-y-6 md:space-y-8">
                        {filteredProjects.map((project, index) => (
                            <div key={project.id} className="break-inside-avoid relative rounded-3xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500">
                                <div className={`relative w-full ${ASPECT_RATIOS[index % ASPECT_RATIOS.length]} overflow-hidden bg-gray-100`}>
                                    <Image
                                        src={project.thumbnail_url || '/images/hero-banner.jpg'}
                                        alt={project.title}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out will-change-transform"
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                    {/* Content on Hover */}
                                    <div className="absolute inset-x-0 bottom-0 p-8 translate-y-8 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2E7A96] text-white text-xs font-bold uppercase tracking-wider mb-4">
                                            {project.category}
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2 leading-tight">
                                            {project.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                                            <MapPin className="w-4 h-4" />
                                            {project.location}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredProjects.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            Chưa có dự án nào trong danh mục này.
                        </div>
                    )}
                </div>
            </section>

            {/* ── 4. Call to Action (Big Bold Style) ── */}
            <section className="bg-[#192125] py-32 rounded-t-[3rem] -mb-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/images/pattern-bg.png')] opacity-10 mix-blend-overlay" />

                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2E7A96] rounded-full blur-[150px] opacity-20 -mr-40 -mt-40 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-500 rounded-full blur-[120px] opacity-10 -ml-20 -mb-20 pointer-events-none" />

                <div className="max-w-[1280px] mx-auto px-5 relative z-10 grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <Reveal>
                            <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tighter leading-[1.1] mb-8">
                                CÔNG TRÌNH <br />
                                <span className="text-[#4ade80]">TIẾP THEO</span> <br />
                                LÀ CỦA BẠN?
                            </h2>
                            <p className="text-xl text-gray-400 font-medium mb-12 max-w-lg leading-relaxed">
                                Kết hợp cùng Đông Phú Gia để mang những giải pháp vật liệu xây dựng hàng đầu thế giới vào bản vẽ kiến trúc của bạn.
                            </p>
                            <a href="tel:02633520316" className="inline-flex items-center justify-between w-full max-w-sm px-8 py-5 bg-white text-[#192125] rounded-full text-lg font-bold hover:bg-[#4ade80] hover:text-[#192125] transition-all duration-300 group">
                                Bắt đầu dự án ngay
                                <div className="w-10 h-10 rounded-full bg-[#192125] text-white flex items-center justify-center group-hover:bg-white group-hover:text-[#192125] transition-colors">
                                    <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                                </div>
                            </a>
                        </Reveal>
                    </div>

                    <div className="hidden lg:block relative h-[500px] rounded-3xl overflow-hidden">
                        {/* We can use another parallax image here or just a nice solid grid pattern */}
                        <div className="absolute inset-0 border border-white/10 rounded-3xl overflow-hidden group">
                            <Image
                                src="/images/tiles-hero.jpg"
                                alt="Dự án tiếp theo"
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-1000 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100"
                            />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
