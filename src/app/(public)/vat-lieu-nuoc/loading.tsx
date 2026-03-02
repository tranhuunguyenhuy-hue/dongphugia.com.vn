import { ChevronRight } from "lucide-react"

export default function Loading() {
    return (
        <div className="relative min-h-screen bg-white">
            {/* Background gradient */}
            <div className="absolute left-0 right-0 top-0 h-[700px] bg-gradient-to-b from-[#dcfce7] to-white pointer-events-none" />

            <div className="max-w-[1280px] mx-auto px-5 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-[51px]">

                    {/* ── Left Sidebar Skeleton ── */}
                    <aside className="hidden lg:flex lg:w-[302px] shrink-0 flex-col gap-[24px]">
                        <div className="h-[600px] bg-gray-100/80 rounded-2xl animate-pulse" />
                    </aside>

                    {/* ── Main Content Skeleton ── */}
                    <div className="flex-1 flex flex-col gap-[40px] min-w-0">
                        {/* Breadcrumb Skeleton */}
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                            <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                        </div>

                        {/* Pattern Type Selector Skeleton */}
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-10 w-28 shrink-0 bg-gray-100 rounded-full animate-pulse" />
                            ))}
                        </div>

                        {/* Title Skeleton */}
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
                            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                        </div>

                        {/* Product Grid Skeleton */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <div key={i} className="flex flex-col gap-3">
                                    <div className="aspect-[4/5] bg-gray-100 rounded-[20px] animate-pulse" />
                                    <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse mt-2" />
                                    <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
