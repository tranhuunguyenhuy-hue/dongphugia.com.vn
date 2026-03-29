"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Phone } from "lucide-react"

// ─── Scroll Reveal Hook ───────────────────────────────────────────────
function useScrollReveal(threshold = 0.1) {
    const ref = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(false)
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target) } },
            { threshold, rootMargin: "0px 0px -60px 0px" }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [threshold])
    return { ref, isVisible }
}

// ─── Reveal Wrapper ───────────────────────────────────────────────────
function Reveal({
    children,
    delay = 0,
    direction = "up",
    className = "",
}: {
    children: React.ReactNode
    delay?: number
    direction?: "up" | "left" | "right" | "none"
    className?: string
}) {
    const { ref, isVisible } = useScrollReveal()
    const initClass =
        direction === "left" ? "-translate-x-10 opacity-0"
            : direction === "right" ? "translate-x-10 opacity-0"
                : direction === "none" ? "opacity-0"
                    : "translate-y-10 opacity-0"
    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-x-0 translate-y-0" : initClass} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    )
}

// ─── Animated Counter ─────────────────────────────────────────────────
function Counter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
    const { ref, isVisible } = useScrollReveal(0.5)
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (!isVisible) return
        let start: number
        let raf: number
        const update = (ts: number) => {
            if (!start) start = ts
            const p = Math.min((ts - start) / duration, 1)
            const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
            setCount(Math.floor(ease * end))
            if (p < 1) raf = requestAnimationFrame(update)
            else setCount(end)
        }
        raf = requestAnimationFrame(update)
        return () => cancelAnimationFrame(raf)
    }, [end, duration, isVisible])
    return <span ref={ref}>{count}{suffix}</span>
}

// ─── Main Component ───────────────────────────────────────────────────
export function AboutClient() {
    return (
        <main className="bg-white overflow-hidden">

            {/* ════════════════════════════════════════════
                SECTION 1 — HERO EDITORIAL
            ════════════════════════════════════════════ */}
            <section className="pt-28 pb-16 px-5 max-w-[1280px] mx-auto">
                <div className="max-w-3xl">
                    <Reveal delay={0}>
                        <p className="text-[#2E7A96] text-xs font-bold tracking-[0.2em] uppercase mb-5">
                            Về Chúng Tôi
                        </p>
                    </Reveal>
                    <Reveal delay={100}>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-[#192125] leading-[1.08] tracking-tight mb-6">
                            Hiểu bạn cần gì.<br />
                            <span className="text-[#2E7A96]">Kiến tạo</span> điều đó.
                        </h1>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-[#6A8A97] text-lg leading-relaxed max-w-xl">
                            Hơn một thập kỷ đồng hành cùng hàng nghìn công trình tại Đà Lạt và Tây Nguyên —
                            Đông Phú Gia không chỉ là nơi mua vật liệu, mà là người bạn đồng hành trong từng quyết định thiết kế.
                        </p>
                    </Reveal>
                </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 2 — PHOTO MOSAIC
            ════════════════════════════════════════════ */}
            <section className="pb-20 px-5 max-w-[1280px] mx-auto">
                <Reveal delay={0} direction="none">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-[380px] md:h-[480px]">
                        {/* Tall image 1 */}
                        <div className="relative rounded-2xl overflow-hidden group col-span-1 row-span-1">
                            <Image
                                src="/images/about-showroom.jpg"
                                alt="Showroom Đông Phú Gia"
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        {/* Tall image 2 */}
                        <div className="relative rounded-2xl overflow-hidden group col-span-1 row-span-1 mt-8">
                            <Image
                                src="/images/about-bathroom.jpg"
                                alt="Phòng tắm cao cấp"
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        {/* Square image */}
                        <div className="relative rounded-2xl overflow-hidden group col-span-1 row-span-1">
                            <Image
                                src="/images/about-interior.jpg"
                                alt="Không gian sống cao cấp"
                                fill
                                className="object-cover object-bottom transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        {/* Tall image 3 */}
                        <div className="relative rounded-2xl overflow-hidden group col-span-1 row-span-1 mt-8">
                            <Image
                                src="/images/about-showroom.jpg"
                                alt="Tư vấn chuyên nghiệp"
                                fill
                                className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 3 — CORE VALUES (Image + List)
            ════════════════════════════════════════════ */}
            <section className="py-20 px-5 max-w-[1280px] mx-auto">
                <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20 items-start">

                    {/* Left: Portrait Image */}
                    <Reveal direction="left">
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                            <Image
                                src="/images/about-bathroom.jpg"
                                alt="Đội ngũ Đông Phú Gia"
                                fill
                                className="object-cover"
                            />
                            {/* Green accent overlay */}
                            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#0F2E3A]/60 to-transparent" />
                            <div className="absolute bottom-6 left-6 text-white">
                                <p className="text-xs font-bold tracking-widest uppercase opacity-80 mb-1">Thành lập</p>
                                <p className="text-3xl font-bold">2010</p>
                            </div>
                        </div>
                    </Reveal>

                    {/* Right: Values List */}
                    <div className="flex flex-col gap-2 pt-4">
                        <Reveal delay={0}>
                            <p className="text-[#2E7A96] text-xs font-bold tracking-[0.2em] uppercase mb-4">
                                Giá trị cốt lõi
                            </p>
                            <h2 className="text-3xl md:text-4xl font-bold text-[#192125] mb-10 leading-tight tracking-tight">
                                Những nguyên tắc<br />dẫn đường chúng tôi
                            </h2>
                        </Reveal>

                        {[
                            {
                                num: "01",
                                title: "Chất Lượng Tiên Quyết",
                                desc: "Chúng tôi ưu tiên các sản phẩm được chế tác kỹ lưỡng, bền vững — được thiết kế để mang lại giá trị thực sự cho ngôi nhà của bạn.",
                            },
                            {
                                num: "02",
                                title: "Lấy Khách Hàng Làm Trung Tâm",
                                desc: "Sự hài lòng của bạn là ưu tiên số một — trải nghiệm mua sắm liền mạch, hỗ trợ kịp thời và các sản phẩm được tuyển chọn kỹ càng.",
                            },
                            {
                                num: "03",
                                title: "Minh Bạch & Trung Thực",
                                desc: "Giao tiếp chân thành, nguồn gốc rõ ràng, giao đúng những gì đã cam kết — không có bất ngờ nào.",
                            },
                            {
                                num: "04",
                                title: "Vì Cộng Đồng",
                                desc: "Chúng tôi xây dựng kết nối bằng cách đồng hành cùng khách hàng, hỗ trợ các doanh nghiệp địa phương và đóng góp cho cộng đồng.",
                            },
                        ].map((item, i) => (
                            <Reveal key={item.num} delay={i * 80}>
                                <div className="group flex gap-5 py-6 border-b border-[#E4EEF2] last:border-0 hover:bg-[#EAF6FB]/50 -mx-4 px-4 rounded-xl transition-colors duration-200 cursor-default">
                                    <span className="text-[#2E7A96]/40 font-bold text-sm mt-1 w-6 shrink-0 group-hover:text-[#2E7A96] transition-colors">
                                        {item.num}
                                    </span>
                                    <div>
                                        <h4 className="font-bold text-[#192125] mb-1.5 text-base md:text-lg group-hover:text-[#2E7A96] transition-colors">
                                            {item.title}
                                        </h4>
                                        <p className="text-[#6A8A97] leading-relaxed text-sm md:text-base">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 4 — NUMBERS (Stats Bar)
            ════════════════════════════════════════════ */}
            <section className="py-20 bg-[#192125]">
                <div className="max-w-[1280px] mx-auto px-5">
                    <Reveal>
                        <div className="grid grid-cols-2 md:grid-cols-4">
                            {[
                                { end: 10, suffix: "+", label: "Năm kinh nghiệm" },
                                { end: 50, suffix: "+", label: "Thương hiệu đối tác" },
                                { end: 1000, suffix: "+", label: "Dự án hoàn thành" },
                                { end: 100, suffix: "%", label: "Hàng chính hãng" },
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className={`flex flex-col items-center text-center py-10 px-6 border-white/10
                                        ${i > 0 ? "border-l" : ""}
                                        ${i >= 2 ? "border-t md:border-t-0" : ""}
                                    `}
                                >
                                    <span className="text-5xl md:text-6xl font-bold text-[#4ade80] mb-3 tracking-tight">
                                        <Counter end={stat.end} suffix={stat.suffix} />
                                    </span>
                                    <span className="text-[#88A3AE] text-xs font-semibold uppercase tracking-widest">
                                        {stat.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 5 — TIMELINE
            ════════════════════════════════════════════ */}
            <section className="py-24 px-5 bg-[#EAF6FB]">
                <div className="max-w-[1280px] mx-auto">
                    <Reveal>
                        <p className="text-[#2E7A96] text-xs font-bold tracking-[0.2em] uppercase text-center mb-3">
                            Hành trình
                        </p>
                        <h2 className="text-3xl md:text-5xl font-bold text-[#192125] text-center mb-16 tracking-tight">
                            Hơn một thập kỷ phát triển
                        </h2>
                    </Reveal>

                    {/* Horizontal timeline */}
                    <div className="relative">
                        {/* Line */}
                        <div className="hidden md:block absolute top-[28px] left-0 right-0 h-px bg-[#2E7A96]/20" />

                        <div className="grid md:grid-cols-4 gap-8 md:gap-6">
                            {[
                                {
                                    year: "2010",
                                    title: "Khởi nghiệp",
                                    desc: "Thành lập cửa hàng bán lẻ vật liệu xây dựng cơ bản tại Đà Lạt với quy mô nhỏ, tâm huyết lớn.",
                                    active: false,
                                },
                                {
                                    year: "2015",
                                    title: "Mở rộng quy mô",
                                    desc: "Trở thành nhà phân phối độc quyền cấp 1 cho nhiều thương hiệu gạch ốp lát và thiết bị vệ sinh danh tiếng.",
                                    active: false,
                                },
                                {
                                    year: "2020",
                                    title: "Showroom Hiện Đại",
                                    desc: "Khai trương trung tâm trưng bày cao cấp, mang lại trải nghiệm không gian thực tế đầu tiên tại khu vực.",
                                    active: false,
                                },
                                {
                                    year: "Nay",
                                    title: "Chuyển đổi số",
                                    desc: "Ứng dụng công nghệ vào quản lý dự án, dẫn đầu xu hướng thiết kế và kiến trúc xanh tại Việt Nam.",
                                    active: true,
                                },
                            ].map((item, i) => (
                                <Reveal key={i} delay={i * 100}>
                                    <div className="flex flex-col md:items-start gap-4">
                                        {/* Dot */}
                                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 md:mb-2 ${item.active
                                            ? "bg-[#2E7A96] border-[#2E7A96] shadow-[0_0_12px_rgba(22,163,74,0.4)]"
                                            : "bg-white border-[#2E7A96]/40"
                                            }`}
                                        />
                                        <div>
                                            <span className={`text-sm font-bold block mb-1 ${item.active ? "text-[#2E7A96]" : "text-[#6A8A97]"}`}>
                                                {item.year}
                                            </span>
                                            <h4 className="font-bold text-[#192125] mb-2 text-base">{item.title}</h4>
                                            <p className="text-[#6A8A97] text-sm leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 6 — CTA
            ════════════════════════════════════════════ */}
            <section className="py-24 px-5 bg-white border-t border-[#E4EEF2]">
                <div className="max-w-[1280px] mx-auto">
                    <div className="bg-[#2E7A96] rounded-3xl px-8 md:px-16 py-16 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
                        <Reveal direction="left" className="max-w-xl">
                            <p className="text-[#C5E8F5] text-xs font-bold tracking-[0.2em] uppercase mb-4">
                                Bắt đầu ngay hôm nay
                            </p>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
                                Sẵn sàng kiến tạo<br />không gian hoàn hảo?
                            </h2>
                            <p className="text-[#C5E8F5] text-base leading-relaxed">
                                Liên hệ với đội ngũ chuyên gia để nhận bảng báo giá chi tiết và giải pháp thi công tối ưu.
                            </p>
                        </Reveal>

                        <Reveal direction="right" delay={150} className="flex flex-col sm:flex-row gap-3 shrink-0">
                            <a
                                href="tel:02633520316"
                                className="inline-flex items-center justify-center gap-2 px-7 py-4 text-[#2E7A96] bg-white font-bold rounded-xl hover:bg-[#EAF6FB] transition-colors text-sm shadow-lg shadow-black/10 group"
                            >
                                <Phone className="w-4 h-4" />
                                Gọi tư vấn ngay
                            </a>
                            <Link
                                href="/gach-op-lat"
                                className="inline-flex items-center justify-center gap-2 px-7 py-4 text-white bg-white/15 border border-white/30 font-bold rounded-xl hover:bg-white/25 transition-colors text-sm group"
                            >
                                Khám phá sản phẩm
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Reveal>
                    </div>
                </div>
            </section>

        </main>
    )
}
