"use client"

import { useEffect, useRef, useState } from "react"

const STATS = [
    { value: 70, suffix: "+", label: "Đối tác và thương hiệu nổi tiếng, uy tín nhất thị trường." },
    { value: 10, suffix: "+", label: "Dự án hợp tác phân phối độc quyền" },
    { value: 1500, suffix: "+", label: "Cập nhật đầy đủ mẫu mã sản phẩm có mặt tại thị trường.", display: "1,5K" },
    { value: 88, suffix: "%", label: "Khách hàng hài lòng và quay trở lại với Đông Phú Gia" },
]

function useCountUp(target: number, duration = 1600, started: boolean) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (!started) return
        let start = 0
        const step = target / (duration / 16)
        const timer = setInterval(() => {
            start += step
            if (start >= target) { setCount(target); clearInterval(timer) }
            else setCount(Math.floor(start))
        }, 16)
        return () => clearInterval(timer)
    }, [target, duration, started])
    return count
}

function StatItem({ stat, index, started }: { stat: typeof STATS[0]; index: number; started: boolean }) {
    const count = useCountUp(stat.value, 1600, started)

    const displayValue = stat.display
        ? (started ? stat.display : "0")
        : (started ? count.toLocaleString("vi-VN") : "0")

    return (
        <div
            className="flex-1 min-w-0 flex flex-col gap-3 items-center text-center px-4"
            style={{
                opacity: started ? 1 : 0,
                transform: started ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.6s ease ${index * 0.12}s, transform 0.6s ease ${index * 0.12}s`
            }}
        >
            <p className="text-[#2E7A96] font-bold tracking-[-0.8px] leading-none whitespace-nowrap inline-flex items-start">
                <span className="text-[32px] md:text-[40px] leading-[1.2]">{displayValue}</span>
                <span className="text-[20px] md:text-[25px] leading-none mt-1">{stat.suffix}</span>
            </p>
            <p className="text-[14px] md:text-[16px] font-medium leading-[22px] md:leading-[24px] text-[#516A74]">
                {stat.label}
            </p>
        </div>
    )
}

export function StatsBar() {
    const ref = useRef<HTMLDivElement>(null)
    const [started, setStarted] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect() } },
            { threshold: 0.3 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={ref} className="flex items-stretch w-full px-4 py-4 md:px-8 md:py-6">
            {STATS.map((stat, index) => (
                <div key={stat.label} className="flex items-center flex-1 min-w-0">
                    <StatItem stat={stat} index={index} started={started} />
                    {index < STATS.length - 1 && (
                        <div className="shrink-0 w-px h-[100px] md:h-[136px] bg-gradient-to-b from-transparent via-[#C8D9E0] to-transparent" />
                    )}
                </div>
            ))}
        </div>
    )
}
