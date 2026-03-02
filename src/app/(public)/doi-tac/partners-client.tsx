"use client"

import { useEffect, useRef, useState } from "react"
import { ShieldCheck, Award, Star, CheckCircle, ArrowRight } from "lucide-react"

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

// --- Mock Data ---
const BRANDS = [
    "Đồng Tâm", "Viglacera", "Inax", "Toto", "Taicera", "Prime", "Thạch Bàn",
    "Bạch Mã", "Casar", "Cotto", "American Standard", "Caesar", "Hafele", "Malloca"
]

const PARTNERS = [
    {
        tier: "Kim Cương",
        name: "Inax VN",
        desc: "Đại lý phân phối cấp 1 thiết bị vệ sinh Inax toàn khu vực Lâm Đồng.",
        color: "from-blue-500 to-cyan-400",
        span: "col-span-12 md:col-span-8 row-span-2"
    },
    {
        tier: "Chiến Lược",
        name: "Đồng Tâm",
        desc: "Đối tác chiến lược cung cấp gạch ốp lát.",
        color: "from-red-500 to-rose-400",
        span: "col-span-12 md:col-span-4 row-span-1"
    },
    {
        tier: "Vàng",
        name: "Viglacera",
        desc: "Đại lý uỷ quyền chính hãng Viglacera.",
        color: "from-amber-500 to-orange-400",
        span: "col-span-12 md:col-span-4 row-span-1"
    },
    {
        tier: "Chiến Lược",
        name: "Toto",
        desc: "Phân phối thiết bị vệ sinh Toto cao cấp.",
        color: "from-emerald-500 to-teal-400",
        span: "col-span-12 md:col-span-4 row-span-1"
    },
    {
        tier: "Vàng",
        name: "Hafele",
        desc: "Giải pháp thiết bị nhà bếp Hafele tiêu chuẩn Đức.",
        color: "from-purple-500 to-fuchsia-400",
        span: "col-span-12 md:col-span-8 row-span-1"
    }
]

export function PartnersClient() {
    return (
        <main className="bg-[#f8fafc] overflow-hidden selection:bg-[#15803d] selection:text-white pb-24">
            {/* Inline Styles for Infite Marquee & Grid */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-infinite-scroll {
                    animation: marquee 30s linear infinite;
                }
                .hover-pause:hover {
                    animation-play-state: paused;
                }
            `}} />

            {/* ── 1. Hero Section ── */}
            <section className="relative pt-32 pb-16 px-5 max-w-[1280px] mx-auto text-center">
                <Reveal delay={100}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-[#15803d] font-bold text-sm mb-8 border border-green-200">
                        <Award className="w-4 h-4" />
                        ĐỐI TÁC TIN CẬY
                    </div>
                </Reveal>
                <Reveal delay={200}>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-[#111827] tracking-tight leading-[1.1] mb-8 max-w-4xl mx-auto">
                        Đồng hành cùng những thương hiệu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#15803d] to-[#22c55e]">Hàng Đầu</span>
                    </h1>
                </Reveal>
                <Reveal delay={300}>
                    <p className="text-lg md:text-xl text-[#64748b] max-w-2xl mx-auto mb-16">
                        Chúng tôi tự hào là cầu nối tin cậy, phân phối trực tiếp các sản phẩm vật liệu xây dựng
                        chất lượng cao từ hơn 50 thương hiệu uy tín trong nước và quốc tế.
                    </p>
                </Reveal>
            </section>

            {/* ── 2. Infinite Marquee (Brands) ── */}
            <section className="py-10 bg-white border-y border-gray-200 overflow-hidden relative shadow-sm">
                {/* Gradient Masks */}
                <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
                <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />

                <div className="flex w-[200%] md:w-max">
                    <div className="flex animate-infinite-scroll hover-pause whitespace-nowrap">
                        {/* Repeat 2 times for seamless loop */}
                        {[...BRANDS, ...BRANDS].map((brand, i) => (
                            <div key={i} className="flex flex-col justify-center items-center px-8 md:px-16 border-r border-gray-100 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100">
                                <span className="text-2xl md:text-4xl font-black text-gray-800 tracking-tighter mix-blend-multiply">
                                    {brand}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── 3. Bento Grid (Strategic Partners) ── */}
            <section className="py-24 max-w-[1280px] mx-auto px-5">
                <Reveal>
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                        <div>
                            <h2 className="text-3xl md:text-5xl font-bold text-[#111827] tracking-tight mb-4">
                                Đối Tác Chiến Lược
                            </h2>
                            <p className="text-gray-500 text-lg max-w-xl">
                                Mạng lưới cung ứng vững chắc giúp Đông Phú Gia luôn đảm bảo chất lượng, số lượng và giá thành tốt nhất trên thị trường.
                            </p>
                        </div>
                    </div>
                </Reveal>

                <div className="grid grid-cols-12 auto-rows-[240px] gap-4 md:gap-6">
                    {PARTNERS.map((partner, index) => (
                        <div key={index} className={`relative rounded-3xl overflow-hidden group ${partner.span}`}>
                            {/* Animated Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${partner.color} opacity-90 group-hover:scale-105 transition-transform duration-700 ease-in-out`} />

                            <div className="absolute inset-0 bg-[url('/images/pattern-bg.png')] opacity-20 mix-blend-overlay" />
                            <div className="absolute inset-0 p-8 flex flex-col justify-between text-white">
                                <Reveal delay={100 * (index + 1)}>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-sm font-semibold border border-white/30">
                                        <Star className="w-4 h-4" />
                                        {partner.tier}
                                    </div>
                                </Reveal>
                                <Reveal delay={200 * (index + 1)}>
                                    <div>
                                        <h3 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">{partner.name}</h3>
                                        <p className="text-white/90 text-lg font-medium leading-snug max-w-sm">{partner.desc}</p>
                                    </div>
                                    <div className="mt-8 hidden md:block">
                                        <div className="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <ArrowRight className="text-white w-6 h-6" />
                                        </div>
                                    </div>
                                </Reveal>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 4. Quality Commitment ── */}
            <section className="py-16 max-w-[1280px] mx-auto px-5">
                <Reveal direction="fade" delay={300}>
                    <div className="bg-white rounded-[32px] p-10 md:p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-[100px] -mr-32 -mt-32" />
                        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                                    <ShieldCheck className="w-8 h-8 text-[#15803d]" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-6 tracking-tight">Cam kết 100% Chính Hãng</h2>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    Mọi sản phẩm vật liệu xây dựng, gạch ốp lát và thiết bị cung cấp bởi hệ thống phân phối Đông Phú Gia đều
                                    có đầy đủ giấy tờ chứng nhận xuất xứ (CO) và chứng nhận chất lượng (CQ) từ nhà sản xuất.
                                </p>
                            </div>
                            <div className="flex flex-col gap-5">
                                {[
                                    "Hoàn tiền 200% nếu phát hiện mã hàng giả",
                                    "Bảo hành chính hãng tại nhà từ 2-5 năm",
                                    "Đổi trả miễn phí 1-1 cho sản phẩm lỗi từ NSX",
                                    "Kiểm định chất lượng 3 vòng trước khi giao"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <CheckCircle className="w-6 h-6 text-[#15803d] shrink-0" />
                                        <span className="text-gray-800 font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

        </main>
    )
}
