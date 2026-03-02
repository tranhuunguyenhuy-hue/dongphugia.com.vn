"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const VALUES = [
    {
        icon: "/images/icons/truck.svg",
        alt: "truck",
        title: "Giao hàng nhanh chóng",
        desc: "Hỗ trợ giao hàng nội thành trong ngày, toàn quốc đúng hẹn, đảm bảo nguyên vẹn và đúng mẫu mã.",
    },
    {
        icon: "/images/icons/document-check.svg",
        alt: "document-check",
        title: "Cam kết chính hãng 100%",
        desc: "Tất cả sản phẩm đều nhập khẩu trực tiếp từ thương hiệu uy tín, đầy đủ tem bảo hành và chứng từ.",
    },
    {
        icon: "/images/icons/wrench.svg",
        alt: "wrench-screwdriver",
        title: "Lắp đặt chuyên nghiệp",
        desc: "Đội ngũ kỹ thuật viên lành nghề, thi công chuẩn quy trình, bàn giao đúng tiến độ và cam kết bảo hành.",
    },
    {
        icon: "/images/icons/newspaper.svg",
        alt: "newspaper",
        title: "Giá tốt - báo giá minh bạch",
        desc: "Cam kết giá cạnh tranh, minh bạch từng hạng mục, mang đến lựa chọn tối ưu cho mọi công trình.",
    },
]

export function ValuesSection() {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
            { threshold: 0.15 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <section className="max-w-[1280px] mx-auto px-5 py-6">
            <div
                ref={ref}
                className="flex flex-col items-center justify-between px-6 sm:px-10 py-12 sm:py-16 rounded-[24px] gap-10 sm:gap-14"
                style={{
                    backgroundImage:
                        "linear-gradient(179.946deg, rgb(220,252,231) 0.11%, rgb(247,254,241) 40.18%, rgb(255,254,244) 69.97%, rgb(220,252,231) 99.89%)",
                    boxShadow: "0px 6px 15px 0px rgba(16,24,40,0.08)",
                }}
            >
                {/* Heading */}
                <div
                    className="flex flex-col gap-1 items-start w-full"
                    style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? "translateY(0)" : "translateY(16px)",
                        transition: "opacity 0.6s ease, transform 0.6s ease",
                    }}
                >
                    <p className="text-[32px] sm:text-[36px] font-semibold text-[#15803d] leading-[40px] sm:leading-[44px] tracking-[-0.72px]">
                        Đông Phú Gia
                    </p>
                    <p className="text-[24px] sm:text-[28px] font-semibold text-[#14532d] leading-[32px] sm:leading-[36px] tracking-[-0.56px]">
                        Đồng Hành - Phát Triển
                    </p>
                </div>

                {/* 4 value cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 w-full">
                    {VALUES.map(({ icon, alt, title, desc }, i) => (
                        <div
                            key={title}
                            className="group flex flex-col gap-6 items-start p-5 rounded-[16px] cursor-default transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(21,128,61,0.14)] hover:bg-white/60"
                            style={{
                                opacity: visible ? 1 : 0,
                                transform: visible ? "translateY(0)" : "translateY(24px)",
                                transition: `opacity 0.6s ease ${0.1 + i * 0.1}s, transform 0.6s ease ${0.1 + i * 0.1}s`,
                            }}
                        >
                            {/* Icon */}
                            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 transition-transform duration-300 group-hover:scale-110">
                                <Image
                                    src={icon}
                                    alt={alt}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-contain"
                                    unoptimized
                                />
                            </div>

                            {/* Text */}
                            <div className="flex flex-col gap-2 items-start w-full">
                                <p className="text-[20px] sm:text-[24px] font-bold text-[#14532d] leading-[28px] sm:leading-[32px] tracking-[-0.48px]">
                                    {title}
                                </p>
                                <p className="text-[15px] sm:text-[16px] font-normal text-[#15803d] leading-[24px]">
                                    {desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
