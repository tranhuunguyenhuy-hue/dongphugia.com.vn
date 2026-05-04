'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectItem } from '@/lib/public-api-projects'

interface ProjectSectionProps {
    projects: ProjectItem[]
}

export function ProjectSection({ projects }: ProjectSectionProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const clientWidth = scrollRef.current.clientWidth
            const scrollAmount = direction === 'left' ? -clientWidth / 1.5 : clientWidth / 1.5
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

    if (projects.length === 0) return null

    return (
        <section className="py-20 lg:py-28 bg-white overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-5">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <div>
                        <div className="h-1 w-8 bg-[#2E7A96] mb-4" />
                        <h2 className="text-[13px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-2">
                            Dự án tiêu biểu
                        </h2>
                        <p className="text-3xl lg:text-[36px] leading-tight font-medium text-neutral-900">
                            Những công trình đẳng cấp
                        </p>
                    </div>
                    <div className="hidden md:flex gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-sm w-12 h-12 border-neutral-300 text-neutral-600 hover:text-[#2E7A96] hover:border-[#2E7A96]"
                            onClick={() => scroll('left')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-sm w-12 h-12 border-neutral-300 text-neutral-600 hover:text-[#2E7A96] hover:border-[#2E7A96]"
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
                    {projects.map((project) => (
                        <div key={project.id} className="snap-start shrink-0 w-[85vw] sm:w-[60vw] md:w-[calc(40%-16px)]">
                            <div className="group relative aspect-[4/5] rounded-sm overflow-hidden bg-neutral-200 cursor-pointer">
                                {/* Image */}
                                <Image
                                    src={project.thumbnail_url || '/images/assets-v2/hero-banner.png'}
                                    alt={project.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                />

                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300" />

                                {/* Tags (Top left) */}
                                {project.tags && project.tags.length > 0 && (
                                    <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                                        {project.tags.slice(0, 2).map((tag, idx) => (
                                            <span key={idx} className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-3 py-1 text-xs font-medium">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Content (Bottom) */}
                                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col gap-2">
                                    <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                                        {project.title}
                                    </h3>
                                    {project.location && (
                                        <div className="flex items-center text-white/80 gap-1.5 mt-1">
                                            <MapPin className="w-4 h-4" />
                                            <span className="text-sm font-medium">{project.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
