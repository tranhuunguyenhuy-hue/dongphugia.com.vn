import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface BreadcrumbItem {
    label: string
    href?: string
}

interface CategoryHeaderProps {
    title: string
    description: string
    breadcrumbs: BreadcrumbItem[]
}

export function CategoryHeader({
    title,
    description,
    breadcrumbs,
}: CategoryHeaderProps) {
    return (
        <div className="mb-6 lg:mb-10 w-full max-w-[800px]">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-neutral-500 mb-5" aria-label="Breadcrumb">
                {breadcrumbs.map((bc, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                        {bc.href ? (
                            <Link href={bc.href} className="hover:text-neutral-900 transition-colors">
                                {bc.label}
                            </Link>
                        ) : (
                            <span className="text-neutral-900 font-medium">{bc.label}</span>
                        )}
                        {index < breadcrumbs.length - 1 && (
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                        )}
                    </div>
                ))}
            </nav>

            {/* Page Header */}
            <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 tracking-tight lg:tracking-tighter mb-3">
                {title}
            </h1>
            <p className="text-neutral-500 text-base lg:text-lg">
                {description}
            </p>
        </div>
    )
}
