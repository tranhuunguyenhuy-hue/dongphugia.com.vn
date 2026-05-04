"use client"

import { useState, useTransition, useEffect } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import { getRevenueChart, RevenueDataPoint, RevenuePeriod } from "@/lib/admin-dashboard-queries"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

interface RevenueChartProps {
    initialData: RevenueDataPoint[]
}

export function RevenueChart({ initialData }: RevenueChartProps) {
    const [period, setPeriod] = useState<RevenuePeriod>('month')
    const [data, setData] = useState<RevenueDataPoint[]>(initialData)
    const [isPending, startTransition] = useTransition()
    const [activeIndex, setActiveIndex] = useState<number | string | null>(null)

    useEffect(() => {
        if (period === 'month') {
            setData(initialData)
            return
        }
        startTransition(async () => {
            const newData = await getRevenueChart(period)
            setData(newData)
        })
    }, [period, initialData])

    const formatDate = (dateStr: string) => {
        if (!dateStr) return ''
        const date = parseISO(dateStr)
        switch (period) {
            case 'day': return format(date, 'dd/MM', { locale: vi })
            case 'week': return `Tuần ${format(date, 'w', { locale: vi })}`
            case 'month': return format(date, 'MM/yyyy')
            case 'year': return format(date, 'yyyy')
            default: return format(date, 'dd/MM')
        }
    }

    return (
        <Card className="col-span-full rounded-2xl border-slate-100 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-8 pt-6 px-6 gap-4">
                <div>
                    <CardTitle className="text-base font-semibold text-slate-900">Doanh thu theo thời gian</CardTitle>
                    <CardDescription>Biểu đồ chi tiết doanh số bán hàng</CardDescription>
                </div>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as RevenuePeriod)} className="w-full sm:w-auto">
                    <TabsList className="grid w-full grid-cols-4 sm:w-auto h-9 bg-slate-100/50">
                        <TabsTrigger value="day" disabled={isPending} className="rounded-md">Ngày</TabsTrigger>
                        <TabsTrigger value="week" disabled={isPending} className="rounded-md">Tuần</TabsTrigger>
                        <TabsTrigger value="month" disabled={isPending} className="rounded-md">Tháng</TabsTrigger>
                        <TabsTrigger value="year" disabled={isPending} className="rounded-md">Năm</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="h-[300px] w-full">
                    {data.length === 0 ? (
                        <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
                            Không có dữ liệu trong khoảng thời gian này
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onMouseMove={(state) => {
                                if (state.activeTooltipIndex !== undefined) {
                                    setActiveIndex(state.activeTooltipIndex);
                                }
                            }} onMouseLeave={() => setActiveIndex(null)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={formatDate}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                    dy={10}
                                />
                                <YAxis 
                                    tickFormatter={(val) => `₫${(val / 1000000).toFixed(0)}M`}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={80}
                                    dx={-10}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }}
                                    labelFormatter={(label) => formatDate(label as string)}
                                    formatter={(value: any) => [formatPrice(Number(value) || 0), 'Doanh thu']}
                                />
                                <Bar
                                    dataKey="revenue"
                                    radius={[4, 4, 0, 0]}
                                    barSize={period === 'month' ? 40 : 20}
                                >
                                    {data.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={activeIndex === index ? "#0f172a" : "#f1f5f9"} 
                                            style={{ transition: 'fill 0.2s ease' }}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
