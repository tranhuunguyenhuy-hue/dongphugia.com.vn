import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    description?: string
    trend?: {
        value: number
        label: string
    }
    className?: string
}

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
    const isPositive = trend && trend.value > 0;
    const isNegative = trend && trend.value < 0;

    return (
        <Card className={cn("overflow-hidden rounded-2xl border-slate-100 shadow-sm", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 px-5">
                <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
                {Icon && (
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                        <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                )}
            </CardHeader>
            <CardContent className="px-5 pb-5">
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
                        {trend && (
                            <div className="flex items-center mt-2 gap-1.5">
                                <span className={cn(
                                    "text-xs font-semibold px-2 py-0.5 rounded-full flex items-center",
                                    isPositive ? "text-emerald-700 bg-emerald-50" :
                                    isNegative ? "text-rose-700 bg-rose-50" :
                                    "text-slate-700 bg-slate-100"
                                )}>
                                    {isPositive ? "+" : ""}{trend.value}%
                                </span>
                                <span className="text-xs text-slate-500">{trend.label}</span>
                            </div>
                        )}
                        {!trend && description && (
                            <p className="text-xs text-slate-500 mt-2">{description}</p>
                        )}
                    </div>
                    {trend && (
                        <div className="w-16 h-10 opacity-80">
                            <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                                {isPositive ? (
                                    <>
                                        <path d="M0 35 Q 25 20, 50 25 T 100 5 L 100 40 L 0 40 Z" fill="url(#gradPositive)" />
                                        <path d="M0 35 Q 25 20, 50 25 T 100 5" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                                        <defs>
                                            <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                    </>
                                ) : (
                                    <>
                                        <path d="M0 5 Q 25 15, 50 10 T 100 35 L 100 40 L 0 40 Z" fill="url(#gradNegative)" />
                                        <path d="M0 5 Q 25 15, 50 10 T 100 35" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                                        <defs>
                                            <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                    </>
                                )}
                            </svg>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
