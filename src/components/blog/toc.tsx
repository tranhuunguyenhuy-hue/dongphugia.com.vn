'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'

interface TocItem {
    level: number
    id: string
    text: string
}

export function TableOfContents({ htmlContent }: { htmlContent: string }) {
    const [headings, setHeadings] = useState<TocItem[]>([])
    const [activeId, setActiveId] = useState<string>('')

    useEffect(() => {
        // 1. Phân tích Headings từ HTML (H2, H3)
        const extractHeadings = () => {
            // Vì React dangerouslySetInnerHTML chưa mount vào DOM lúc render lần đầu
            // nên parse bằng Regex từ chuỗi HTML là an toàn & nhanh nhất
            const matches = htmlContent.matchAll(/<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi)
            const parsedHeadings: TocItem[] = Array.from(matches).map(([, level, id, text]) => ({
                level: parseInt(level),
                id,
                // Loại bỏ thẻ HTML thừa bên trong heading (như <a>, <strong>)
                text: text.replace(/<[^>]*>?/gm, ''),
            }))
            setHeadings(parsedHeadings)
        }

        extractHeadings()
    }, [htmlContent])

    useEffect(() => {
        // 2. Observer để highlight item đang đọc
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id)
                    }
                })
            },
            { rootMargin: '-20% 0px -80% 0px' }
        )

        headings.forEach((h) => {
            const el = document.getElementById(h.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [headings])

    if (headings.length === 0) return null

    return (
        <div className="bg-slate-50 rounded-2xl p-6 border border-[#e2e8f0] sticky top-24">
            <h3 className="text-lg font-bold text-[#0f172a] mb-4 pb-4 border-b border-[#cbd5e1] flex items-center gap-2">
                Nội dung chính
            </h3>
            <nav className="flex flex-col gap-3 text-[14px]">
                {headings.map((h, i) => (
                    <a
                        key={i}
                        href={`#${h.id}`}
                        className={`flex items-start transition-colors ${h.level === 3 ? 'ml-4' : ''
                            } ${activeId === h.id
                                ? 'text-[#15803d] font-semibold'
                                : 'text-[#64748b] hover:text-[#15803d]'
                            }`}
                        onClick={(e) => {
                            e.preventDefault()
                            document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })
                            setActiveId(h.id)
                        }}
                    >
                        {h.level === 3 && <ChevronRight className="w-3.5 h-3.5 mt-0.5 mr-1 shrink-0 opacity-50" />}
                        <span className="line-clamp-2 leading-relaxed">{h.text}</span>
                    </a>
                ))}
            </nav>
        </div>
    )
}
