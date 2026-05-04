import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: string
    description?: string
    action?: ReactNode
    className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8", className)}>
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
                {description && <p className="text-sm text-slate-500 mt-1.5">{description}</p>}
            </div>
            {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
    )
}
