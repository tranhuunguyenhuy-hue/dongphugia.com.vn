import { getPendingQuotes, getPendingOrders } from "@/lib/admin-dashboard-queries"
import { formatPrice } from "@/lib/utils"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import Link from "next/link"
import Image from "next/image"
import prisma from "@/lib/prisma"

export const metadata = {
    title: "Tổng quan — Admin",
}

async function getDashboardProducts() {
    const products = await prisma.products.findMany({
        take: 12,
        where: { is_active: true },
        include: {
            categories: { select: { name: true } }
        },
        orderBy: { created_at: 'desc' }
    });
    return products;
}

export default async function AdminDashboardPage() {
    const [pendingQuotes, pendingOrders, products] = await Promise.all([
        getPendingQuotes(),
        getPendingOrders(),
        getDashboardProducts(),
    ])

    return (
        <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-8rem)]">
            {/* Left: Sản phẩm nổi bật (2/3) */}
            <div className="w-full lg:w-2/3 flex flex-col h-full lg:min-h-0">
                <Card className="flex-1 bg-[#F6F5F8] border-0 shadow-none rounded-2xl p-1.5 flex flex-col h-full">
                    <div className="px-3 py-2.5 flex items-center justify-between">
                        <h2 className="text-[14px] font-semibold text-slate-800">Sản phẩm nổi bật</h2>
                        <div className="flex items-center gap-2">
                            {/* Pagination mockup */}
                            <div className="flex items-center bg-white rounded-md overflow-hidden shadow-sm">
                                <button className="px-2 py-1 hover:bg-slate-50 text-slate-400 border-r border-slate-100/50">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="px-3 text-[12px] font-medium text-slate-600">1 / 10</span>
                                <button className="px-2 py-1 hover:bg-slate-50 text-slate-600 border-l border-slate-100/50">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-sm flex flex-col relative">
                        <div className="absolute inset-0 overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                    <TableRow className="hover:bg-transparent border-b border-slate-100">
                                        <TableHead className="w-10 py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50 rounded-tl-xl">
                                            <div className="w-4 h-4 rounded border border-slate-200 bg-white"></div>
                                        </TableHead>
                                        <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">
                                            <div className="flex items-center gap-1.5">Sản phẩm <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg></div>
                                        </TableHead>
                                        <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">
                                            <div className="flex items-center gap-1.5">Danh mục <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg></div>
                                        </TableHead>
                                        <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Giá bán</TableHead>
                                        <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50 text-right">Tồn kho</TableHead>
                                        <TableHead className="w-10 py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50 rounded-tr-xl"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                                            <TableCell className="py-2 px-4">
                                                <div className="w-4 h-4 rounded border border-slate-200 bg-white"></div>
                                            </TableCell>
                                            <TableCell className="py-2 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-md bg-slate-100 overflow-hidden relative shrink-0 border border-slate-200/60">
                                                        {product.image_main_url ? (
                                                            <Image src={product.image_main_url} alt={product.name} fill className="object-cover" sizes="36px" />
                                                        ) : (
                                                            <div className="w-full h-full bg-slate-100" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col justify-center max-w-[200px]">
                                                        <span className="text-[13px] font-medium text-slate-900 truncate" title={product.name}>{product.name}</span>
                                                        <span className="text-[11px] text-slate-400 font-medium truncate">{product.sku}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 px-4">
                                                <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-[12px] text-slate-600 font-medium truncate max-w-[120px]">
                                                    {product.categories?.name || "Chưa phân loại"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2 px-4 text-[13px] font-medium text-slate-700">
                                                {formatPrice(Number(product.price) || 0)}
                                            </TableCell>
                                            <TableCell className="py-2 px-4 text-[13px] text-right font-medium">
                                                {product.stock_status === 'in_stock' ? (
                                                    <span className="text-emerald-600">Còn hàng</span>
                                                ) : product.stock_status === 'out_of_stock' ? (
                                                    <span className="text-red-600">Hết hàng</span>
                                                ) : (
                                                    <span className="text-amber-600">Đặt trước</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2 px-4 text-right text-slate-400 hover:text-slate-600 cursor-pointer">
                                                <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Right: Chăm sóc khách hàng + Google Analytics (1/3) */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full lg:min-h-0">
                <Card className="flex-1 bg-[#F6F5F8] border-0 shadow-none rounded-2xl p-1.5 flex flex-col h-full lg:min-h-0">
                    <Tabs defaultValue="orders" className="flex-1 flex flex-col h-full lg:min-h-0">
                        <div className="px-3 py-2 flex flex-col gap-2">
                            <h2 className="text-[14px] font-semibold text-slate-800">Chăm sóc khách hàng</h2>
                            <TabsList className="h-8 bg-black/5 p-0.5 w-full justify-start rounded-[8px]">
                                <TabsTrigger value="orders" className="text-[12px] h-7 px-3 rounded-[6px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-600">Đơn hàng mới</TabsTrigger>
                                <TabsTrigger value="quotes" className="text-[12px] h-7 px-3 rounded-[6px] data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-600">Báo giá</TabsTrigger>
                            </TabsList>
                        </div>
                        <div className="flex-1 bg-white rounded-xl shadow-sm relative overflow-hidden">
                            <TabsContent value="orders" className="absolute inset-0 overflow-auto m-0 p-0 border-0 outline-none">
                                <Table className="min-w-[500px]">
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow className="hover:bg-transparent border-b border-slate-100">
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Khách hàng</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Sản phẩm</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">SL</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Trạng thái</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50 text-right">Thời gian</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingOrders.map((order) => {
                                            const totalQty = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
                                            const firstProductName = order.order_items[0]?.product_name || "N/A";
                                            const otherCount = order.order_items.length - 1;
                                            return (
                                                <TableRow key={order.id} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0 group cursor-pointer">
                                                    <TableCell className="py-2.5 px-4">
                                                        <div className="flex flex-col">
                                                            <Link href={`/admin/orders/${order.id}`} className="text-[13px] font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors whitespace-nowrap">
                                                                {order.customer_name}
                                                            </Link>
                                                            <span className="text-[11px] text-slate-500">{order.customer_phone}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4">
                                                        <div className="text-[12px] text-slate-700 max-w-[150px] truncate" title={firstProductName}>
                                                            {firstProductName} {otherCount > 0 && <span className="text-slate-400">(+{otherCount})</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4 text-[13px] font-medium text-slate-700">
                                                        {totalQty}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-600 whitespace-nowrap">
                                                            Chờ XL
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4 text-[12px] text-right text-slate-500 whitespace-nowrap">
                                                        {format(new Date(order.created_at), 'dd/MM, HH:mm')}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {pendingOrders.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-[13px] text-slate-500">
                                                    Không có đơn hàng mới.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="quotes" className="absolute inset-0 overflow-auto m-0 p-0 border-0 outline-none">
                                <Table className="min-w-[500px]">
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow className="hover:bg-transparent border-b border-slate-100">
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Khách hàng</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Sản phẩm</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">SL</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50">Trạng thái</TableHead>
                                            <TableHead className="py-2.5 px-4 h-auto text-slate-500 font-medium text-[12px] bg-slate-50/50 text-right">Thời gian</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingQuotes.map((quote) => {
                                            const totalQty = quote.quote_items.reduce((sum, item) => sum + item.quantity, 0);
                                            const firstProductName = quote.quote_items[0]?.products?.name || "N/A";
                                            const otherCount = quote.quote_items.length - 1;
                                            return (
                                                <TableRow key={quote.id} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0 group cursor-pointer">
                                                    <TableCell className="py-2.5 px-4">
                                                        <div className="flex flex-col">
                                                            <Link href={`/admin/quotes/${quote.id}`} className="text-[13px] font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors whitespace-nowrap">
                                                                {quote.name}
                                                            </Link>
                                                            <span className="text-[11px] text-slate-500">{quote.phone}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4">
                                                        <div className="text-[12px] text-slate-700 max-w-[150px] truncate" title={firstProductName}>
                                                            {firstProductName} {otherCount > 0 && <span className="text-slate-400">(+{otherCount})</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4 text-[13px] font-medium text-slate-700">
                                                        {totalQty}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-600 whitespace-nowrap">
                                                            Chờ XL
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 px-4 text-[12px] text-right text-slate-500 whitespace-nowrap">
                                                        {format(new Date(quote.created_at), 'dd/MM, HH:mm')}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {pendingQuotes.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-[13px] text-slate-500">
                                                    Không có báo giá mới.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>

                <Card className="h-44 shrink-0 bg-[#F6F5F8] border-0 shadow-none rounded-2xl p-1.5 flex flex-col">
                    <div className="px-3 py-2.5">
                        <h2 className="text-[14px] font-semibold text-slate-800">Google analytic</h2>
                    </div>
                    <div className="flex-1 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm gap-3">
                        <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <span className="text-[13px] font-medium text-slate-400">Chưa tích hợp</span>
                    </div>
                </Card>
            </div>
        </div>
    )
}
