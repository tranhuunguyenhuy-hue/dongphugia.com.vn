"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Award, Users, HardHat } from "lucide-react"

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

// --- Reveal Component ---
function Reveal({ children, delay = 0, direction = "up" }: { children: React.ReactNode, delay?: number, direction?: "up" | "left" | "right" }) {
    const { ref, isVisible } = useScrollReveal()
    let translate = "translate-y-8"
    if (direction === "left") translate = "-translate-x-8"
    if (direction === "right") translate = "translate-x-8"

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

// --- Counter Component ---
function Counter({ end, suffix = "", duration = 2000 }: { end: number, suffix?: string, duration?: number }) {
    const { ref, isVisible } = useScrollReveal(0.5)
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!isVisible) return
        let startTime: number
        let animationFrame: number

        const updateCount = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            // easeOutExpo
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
            setCount(Math.floor(easeProgress * end))

            if (progress < 1) {
                animationFrame = requestAnimationFrame(updateCount)
            } else {
                setCount(end)
            }
        }

        animationFrame = requestAnimationFrame(updateCount)
        return () => cancelAnimationFrame(animationFrame)
    }, [end, duration, isVisible])

    return <span ref={ref}>{count}{suffix}</span>
}

export function AboutClient() {
    return (
        <main className="bg-white overflow-hidden selection:bg-[#15803d] selection:text-white">

            {/* ── 1. Hero Section (Editorial Title) ── */}
            <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-20 px-5 max-w-[1440px] mx-auto">
                <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#f0fdf4] to-transparent -z-10" />

                <Reveal delay={100}>
                    <p className="text-[#15803d] font-bold tracking-widest uppercase text-sm mb-6 text-center">
                        Câu chuyện của chúng tôi
                    </p>
                </Reveal>

                <Reveal delay={200}>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-[#111827] text-center tracking-tighter leading-[1.1] mb-12 max-w-5xl mx-auto">
                        KIẾN TẠO <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#15803d] to-[#16a34a]">KHÔNG GIAN</span> <br className="hidden md:block" />
                        VỮNG BỀN NĂM THÁNG
                    </h1>
                </Reveal>

                <Reveal delay={400}>
                    <p className="text-lg md:text-xl text-[#4b5563] text-center max-w-2xl mx-auto leading-relaxed mb-16">
                        Hơn một thập kỷ đồng hành cùng hàng ngàn dự án lớn nhỏ tại Đà Lạt và Tây Nguyên.
                        Đông Phú Gia tự hào là cầu nối mang những tinh hoa vật liệu xây dựng thế giới đến ngôi nhà của bạn.
                    </p>
                </Reveal>

                <Reveal delay={600}>
                    <div className="w-full max-w-6xl aspect-[21/9] md:aspect-[24/9] relative rounded-3xl overflow-hidden shadow-2xl">
                        <Image
                            src="/images/hero-banner.jpg"
                            alt="Đông Phú Gia Showroom"
                            fill
                            className="object-cover object-center scale-105 hover:scale-100 transition-transform duration-1000"
                            priority
                        />
                        <div className="absolute inset-0 bg-black/10" />
                    </div>
                </Reveal>
            </section>

            {/* ── 2. Numbers That Matter ── */}
            <section className="py-24 bg-[#111827] text-white">
                <div className="max-w-[1280px] mx-auto px-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 divide-x divide-white/10">
                        <div className="flex flex-col items-center text-center">
                            <h3 className="text-5xl md:text-6xl font-bold text-[#4ade80] mb-4 tracking-tighter">
                                <Counter end={10} suffix="+" />
                            </h3>
                            <p className="text-sm md:text-base text-gray-400 font-medium uppercase tracking-wider">Năm Kinh Nghiệm</p>
                        </div>
                        <div className="flex flex-col items-center text-center pl-8">
                            <h3 className="text-5xl md:text-6xl font-bold text-[#4ade80] mb-4 tracking-tighter">
                                <Counter end={50} suffix="+" />
                            </h3>
                            <p className="text-sm md:text-base text-gray-400 font-medium uppercase tracking-wider">Thương Hiệu</p>
                        </div>
                        <div className="flex flex-col items-center text-center pl-8 border-t border-white/10 md:border-t-0 pt-8 md:pt-0">
                            <h3 className="text-5xl md:text-6xl font-bold text-[#4ade80] mb-4 tracking-tighter">
                                <Counter end={1000} suffix="+" />
                            </h3>
                            <p className="text-sm md:text-base text-gray-400 font-medium uppercase tracking-wider">Dự Án Lớn Nhỏ</p>
                        </div>
                        <div className="flex flex-col items-center text-center pl-8 border-t border-white/10 md:border-t-0 pt-8 md:pt-0">
                            <h3 className="text-5xl md:text-6xl font-bold text-[#4ade80] mb-4 tracking-tighter">
                                <Counter end={100} suffix="%" />
                            </h3>
                            <p className="text-sm md:text-base text-gray-400 font-medium uppercase tracking-wider">Chính Hãng</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 3. Vision & Mission (Asymmetric Grid) ── */}
            <section className="py-24 md:py-32 max-w-[1280px] mx-auto px-5">
                <div className="grid lg:grid-cols-2 gap-16 md:gap-24 items-center">
                    <Reveal direction="left">
                        <div className="relative aspect-square md:aspect-[4/5] rounded-[2rem] overflow-hidden">
                            <Image
                                src="/images/tiles-hero.jpg"
                                alt="Vision"
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-[#15803d]/10 mix-blend-multiply" />
                            {/* Decorative element */}
                            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-[radial-gradient(circle,#22c55e_2px,transparent_2px)] bg-[size:16px_16px] opacity-20 -z-10" />
                        </div>
                    </Reveal>

                    <Reveal direction="right" delay={200}>
                        <div className="flex flex-col gap-12">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-bold text-[#111827] mb-6 tracking-tight">
                                    Tầm nhìn &<br />Sứ mệnh
                                </h2>
                                <p className="text-lg text-[#4b5563] leading-relaxed">
                                    Chúng tôi không chỉ bán vật liệu xây dựng. Chúng tôi cung cấp giải pháp toàn diện để biến
                                    bức vách, nền rãnh vô tri thành một tác phẩm nghệ thuật mang đậm dấu ấn cá nhân của gia chủ.
                                </p>
                            </div>

                            <div className="flex flex-col gap-8">
                                <div className="flex gap-5">
                                    <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-[#f0fdf4] text-[#15803d]">
                                        <Award className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-[#111827] mb-2">Chất lượng tiên quyết</h4>
                                        <p className="text-[#4b5563] leading-relaxed">Tuyển chọn khắt khe các thương hiệu nội địa và quốc tế đạt chuẩn, đảm bảo tuổi thọ công trình.</p>
                                    </div>
                                </div>
                                <div className="flex gap-5">
                                    <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-[#f0fdf4] text-[#15803d]">
                                        <Users className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-[#111827] mb-2">Đồng hành trọn đời</h4>
                                        <p className="text-[#4b5563] leading-relaxed">Chính sách bảo hành rõ ràng, hỗ trợ tư vấn kỹ thuật thi công chuẩn xác 24/7.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── 4. Timeline History ── */}
            <section className="py-24 bg-gray-50 border-t border-gray-100">
                <div className="max-w-[800px] mx-auto px-5">
                    <Reveal>
                        <h2 className="text-4xl md:text-5xl font-bold text-[#111827] text-center mb-20 tracking-tight">
                            Hành trình <span className="text-[#15803d]">Phát triển</span>
                        </h2>
                    </Reveal>

                    <div className="relative border-l-2 border-green-200 ml-4 md:ml-1/2">
                        {/* Timeline Item 1 */}
                        <Reveal>
                            <div className="mb-16 relative pl-8 md:pl-0 md:w-1/2 md:ml-auto md:pr-12 md:text-right group">
                                <div className="absolute w-6 h-6 bg-white border-4 border-[#15803d] rounded-full -left-3 md:-left-3 top-1 group-hover:scale-125 transition-transform duration-300" />
                                <span className="text-[#15803d] font-bold text-xl mb-2 block">2010</span>
                                <h4 className="text-lg font-bold text-[#111827] mb-2">Khởi nghiệp</h4>
                                <p className="text-[#4b5563]">Thành lập cửa hàng bán lẻ vật liệu xây dựng cơ bản tại Đà Lạt với quy mô nhỏ.</p>
                            </div>
                        </Reveal>

                        {/* Timeline Item 2 */}
                        <Reveal>
                            <div className="mb-16 relative pl-8 md:pl-0 md:w-1/2 md:mr-auto md:pr-12 md:pl-12 text-left group">
                                <div className="absolute w-6 h-6 bg-white border-4 border-[#15803d] rounded-full -left-3 md:-right-3 md:left-auto top-1 group-hover:scale-125 transition-transform duration-300" />
                                <span className="text-[#15803d] font-bold text-xl mb-2 block">2015</span>
                                <h4 className="text-lg font-bold text-[#111827] mb-2">Mở rộng quy mô</h4>
                                <p className="text-[#4b5563]">Chuyển đổi thành nhà phân phối độc quyền cấp 1 cho nhiều thương hiệu Gạch ốp lát và Thiết bị vệ sinh danh tiếng.</p>
                            </div>
                        </Reveal>

                        {/* Timeline Item 3 */}
                        <Reveal>
                            <div className="mb-16 relative pl-8 md:pl-0 md:w-1/2 md:ml-auto md:pr-12 md:text-right group">
                                <div className="absolute w-6 h-6 bg-white border-4 border-[#15803d] rounded-full -left-3 md:-left-3 top-1 group-hover:scale-125 transition-transform duration-300" />
                                <span className="text-[#15803d] font-bold text-xl mb-2 block">2020</span>
                                <h4 className="text-lg font-bold text-[#111827] mb-2">Showroom Hiện Đại</h4>
                                <p className="text-[#4b5563]">Khai trương trung tâm trưng bày vật liệu cao cấp, mang lại trải nghiệm mua sắm không gian thực tế đầu tiên tại khu vực.</p>
                            </div>
                        </Reveal>

                        {/* Timeline Item 4 */}
                        <Reveal>
                            <div className="relative pl-8 md:pl-0 md:w-1/2 md:mr-auto md:pr-12 md:pl-12 text-left group">
                                <div className="absolute w-6 h-6 bg-[#15803d] border-4 border-green-200 rounded-full -left-3 md:-right-3 md:left-auto top-1 group-hover:scale-125 transition-transform duration-300 shadow-[0_0_15px_rgba(21,128,61,0.5)]" />
                                <span className="text-[#15803d] font-bold text-xl mb-2 block">Hiện tại & Tương lai</span>
                                <h4 className="text-lg font-bold text-[#111827] mb-2">Chuyển đổi số & Dịch vụ toàn diện</h4>
                                <p className="text-[#4b5563]">Ứng dụng công nghệ vào quản lý dự án, tiếp tục dẫn đầu xu hướng thiết kế và kiến trúc xanh tại Việt Nam.</p>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ── 5. Call to Action ── */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#15803d]" />
                <div className="absolute inset-0 bg-[url('/images/pattern-bg.png')] opacity-10 mix-blend-overlay" />

                <div className="max-w-[800px] mx-auto px-5 relative z-10 text-center text-white">
                    <Reveal>
                        <h2 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight leading-tight">
                            Sẵn sàng bắt đầu dự án <br />của bạn?
                        </h2>
                        <p className="text-green-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
                            Liên hệ ngay với các chuyên gia của chúng tôi để nhận bảng báo giá vật tư chi tiết
                            và giải pháp thi công tối ưu nhất cho công trình.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a href="tel:02633520316" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold bg-white text-[#15803d] rounded-full hover:bg-gray-100 transition-colors shadow-lg shadow-black/10 group">
                                Gọi tư vấn ngay
                            </a>
                            <Link href="/gach-op-lat" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold bg-transparent text-white border border-white/30 rounded-full hover:bg-white/10 transition-colors group">
                                Khám phá sản phẩm
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </section>

        </main>
    )
}
