"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"

// Category data — thumbnails now from public/images/categories/
const CATEGORIES = [
  {
    title: "Gạch ốp lát",
    href: "/gach-op-lat",
    img: "/images/categories/gach-op-lat.png",
    cta: "Xem tất cả",
    available: true,
    // image positioning within the card (matches Figma anchor: bottom-right)
    imgClass: "absolute bottom-0 right-0 h-full w-auto max-w-none",
  },
  {
    title: "Thiết bị vệ sinh",
    href: "/thiet-bi-ve-sinh",
    img: "/images/categories/thiet-bi-ve-sinh.png",
    cta: "Xem tất cả",
    available: true,
    imgClass: "absolute bottom-0 right-0 h-full w-auto max-w-none",
  },
  {
    title: "Vật liệu nước",
    href: "#",
    img: "/images/categories/vat-lieu-nuoc.png",
    cta: "Sắp có",
    available: false,
    imgClass: "absolute bottom-0 right-0 h-full w-auto max-w-none",
  },
  {
    title: "Thiết bị bếp",
    href: "#",
    img: "/images/categories/thiet-bi-bep.png",
    cta: "Sắp có",
    available: false,
    imgClass: "absolute bottom-0 right-0 h-full w-auto max-w-none",
  },
  {
    title: "Sàn gỗ",
    href: "#",
    img: "/images/categories/san-go.png",
    cta: "Sắp có",
    available: false,
    imgClass: "absolute bottom-0 right-0 w-full h-auto object-cover",
  },
]

interface CardProps {
  cat: typeof CATEGORIES[0]
  className?: string
  visible: boolean
  delay?: number
  isBig?: boolean
}

function CategoryCard({ cat, className = "", visible, delay = 0, isBig = false }: CardProps) {
  const Wrapper = cat.available ? Link : "div"
  const wrapperProps = cat.available ? { href: cat.href } : {}

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={`group relative overflow-hidden rounded-sm flex flex-col p-6 sm:p-8 border border-neutral-200 bg-neutral-50 transition-all duration-300 ease-out hover:border-[#2E7A96] hover:bg-white ${cat.available ? "cursor-pointer" : "cursor-default"} ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s, box-shadow 0.3s ease`,
      }}
    >
      {/* Text Content overlay */}
      <div className="relative z-10 flex flex-col gap-2.5 items-start mt-auto sm:mt-0">
        <p className={`font-medium tracking-tight text-neutral-900 group-hover:text-[#0F2E3A] transition-colors duration-200
                    ${isBig ? "text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px]" : "text-[20px] sm:text-[24px] leading-[28px] sm:leading-[32px]"}`}
        >
          {cat.title}
        </p>

        <div className="flex items-center gap-1.5 text-[15px] font-medium text-neutral-500 group-hover:text-[#2E7A96] transition-colors duration-200">
          <span>{cat.cta}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>

      {/* Thumbnail Background Image */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none flex justify-end items-end h-[80%]">
        {/* We use an img tag to handle simple bottom-right positioning without layout shifts */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cat.img}
          alt={cat.title}
          className={`object-contain object-bottom-right transition-transform duration-500 group-hover:scale-105 origin-bottom-right ${isBig ? 'max-h-full max-w-[80%]' : 'max-h-full max-w-[90%]'}`}
        />
      </div>
    </Wrapper>
  )
}

export function CategoryListing() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [gach, veSinh, vatLieu, bep, sanGo] = CATEGORIES

  return (
    <section ref={ref} className="max-w-[1280px] mx-auto px-5 py-16 lg:py-24">
      {/* Heading */}
      <div
        className="flex flex-col items-center mb-10 lg:mb-14"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <div className="h-1 w-8 bg-[#2E7A96] mb-4" />
        <h2 className="text-[13px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-2">
          Danh mục sản phẩm
        </h2>
        <p className="text-[28px] sm:text-[32px] font-medium text-neutral-900 leading-tight">
          Tại <span className="font-bold text-[#0F2E3A]">Đông Phú Gia</span>
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(1, 1fr)" }}>
        {/* Row 1: Big card + 2×1 */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-[417px_1fr]">
          {/* Big card */}
          <CategoryCard cat={gach} className="h-[260px] sm:h-[340px] lg:h-[507px]" visible={visible} delay={0.05} isBig />

          {/* 2×2 inner grid */}
          <div className="grid grid-cols-2 gap-5"
            style={{ gridTemplateRows: "1fr 1fr" }}
          >
            <CategoryCard cat={veSinh} className="h-[160px] sm:h-[200px] lg:h-auto" visible={visible} delay={0.12} />
            <CategoryCard cat={vatLieu} className="h-[160px] sm:h-[200px] lg:h-auto" visible={visible} delay={0.18} />
            <CategoryCard cat={bep} className="h-[160px] sm:h-[200px] lg:h-auto" visible={visible} delay={0.24} />
            <CategoryCard cat={sanGo} className="h-[160px] sm:h-[200px] lg:h-auto" visible={visible} delay={0.30} />
          </div>
        </div>
      </div>
    </section>
  )
}
