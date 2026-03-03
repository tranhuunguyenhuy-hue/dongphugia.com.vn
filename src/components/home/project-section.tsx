'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MOCK_PROJECTS = [
    {
        id: 1,
        title: "Biệt thự nghỉ dưỡng Samten Hills",
        location: "Đơn Dương, Lâm Đồng",
        image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1000&auto=format&fit=crop",
        tags: ["Gạch ốp lát", "Thiết bị vệ sinh"]
    },
    {
        id: 2,
        title: "Khu resort cao cấp Swiss-Belresort",
        location: "Hồ Tuyền Lâm, Đà Lạt",
        image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop",
        tags: ["Thiết bị vệ sinh", "Sàn gỗ"]
    },
    {
        id: 3,
        title: "Khách sạn Colline Hotel",
        location: "Phường 10, Đà Lạt",
        image: "https://images.unsplash.com/photo-1613490900233-141c5560d75d?q=80&w=1000&auto=format&fit=crop",
        tags: ["Toàn bộ vật liệu"]
    },
    {
        id: 4,
        title: "Villa đồi thông The Nest",
        location: "Trại Mát, Đà Lạt",
        image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=1000&auto=format&fit=crop",
        tags: ["Thiết bị bếp", "Gạch ốp lát"]
    },
    {
        id: 5,
        title: "Nhà phố hiện đại The Panorama",
        location: "Phường 2, Đà Lạt",
        image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1000&auto=format&fit=crop",
        tags: ["Vật liệu nước", "Thiết bị vệ sinh"]
    }
]

export function ProjectSection() {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const clientWidth = scrollRef.current.clientWidth
            const scrollAmount = direction === 'left' ? -clientWidth / 1.5 : clientWidth / 1.5
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

    return (
        <section className="py-20 bg-white overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-5">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <div>
                        <h2 className="text-3xl lg:text-[40px] leading-tight font-bold text-[#111827] tracking-tight">
                            Dự án tiêu biểu
                        </h2>
                        <p className="text-[#4b5563] mt-3 text-lg">
                            Những công trình đẳng cấp sử dụng vật liệu từ Đông Phú Gia
                        </p>
                    </div>
                    <div className="hidden md:flex gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-12 h-12 border-gray-300 text-gray-600 hover:text-[#15803d] hover:border-[#15803d]"
                            onClick={() => scroll('left')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-12 h-12 border-gray-300 text-gray-600 hover:text-[#15803d] hover:border-[#15803d]"
                            onClick={() => scroll('right')}
                        >
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Carousel Container */}
                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 -mx-5 px-5 md:mx-0 md:px-0 hide-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {MOCK_PROJECTS.map((project) => (
                        <div key={project.id} className="snap-start shrink-0 w-[85vw] sm:w-[60vw] md:w-[calc(40%-16px)]">
                            <div className="group relative aspect-[4/5] rounded-[32px] overflow-hidden bg-gray-200 cursor-pointer">
                                {/* Image */}
                                <Image
                                    src={project.image}
                                    alt={project.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                />

                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300" />

                                {/* Tags (Top left) */}
                                <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                                    {project.tags.map((tag, idx) => (
                                        <span key={idx} className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1 rounded-full text-xs font-medium">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Content (Bottom) */}
                                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col gap-2 transform transition-transform duration-300 translate-y-0">
                                    <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                                        {project.title}
                                    </h3>
                                    <div className="flex items-center text-white/80 gap-1.5 mt-1">
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-sm font-medium">{project.location}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
