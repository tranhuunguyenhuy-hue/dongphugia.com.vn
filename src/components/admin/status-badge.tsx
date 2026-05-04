import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default'

interface StatusBadgeProps {
    status: StatusType
    children: React.ReactNode
    className?: string
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
    const dotVariants: Record<StatusType, string> = {
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        error: "bg-rose-500",
        info: "bg-blue-500",
        default: "bg-slate-500",
    }

    return (
        <Badge variant="outline" className={cn("font-medium gap-1.5 pl-2 pr-3 py-1 rounded-md bg-transparent border-none hover:bg-slate-50 text-slate-700 shadow-none", className)}>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotVariants[status])} />
            {children}
        </Badge>
    )
}
