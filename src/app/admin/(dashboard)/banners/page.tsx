import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, ImageIcon, Layers } from "lucide-react"
import { BannerActions } from "./banner-actions"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export default async function BannersPage() {
    const [banners, totalBanners, activeBanners] = await Promise.all([
        prisma.banner.findMany({
            orderBy: { order: 'asc' },
            take: 20,
            select: {
                id: true,
                title: true,
                image: true,
                link: true,
                isPublished: true,
                order: true,
            }
        }),
        prisma.banner.count(),
        prisma.banner.count({ where: { isPublished: true } })
    ]) as [any[], number, number];

    return (
        <div className="space-y-6 fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quản lý Banner</h2>
                    <p className="text-sm text-muted-foreground">Quản lý hình ảnh quảng cáo trên trang chủ</p>
                </div>
                <Button asChild className="press-effect shadow-md">
                    <Link href="/admin/banners/new">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Banner
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng số Banner</CardTitle>
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalBanners}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Đang hiển thị</CardTitle>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{activeBanners}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[80px] text-center">Thứ tự</TableHead>
                            <TableHead className="w-[200px]">Hình ảnh</TableHead>
                            <TableHead>Tiêu đề</TableHead>
                            <TableHead>Link liên kết</TableHead>
                            <TableHead className="w-[120px]">Trạng thái</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {banners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-[300px] text-center">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <div className="p-4 rounded-full bg-muted">
                                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="font-medium text-lg">Chưa có banner nào</p>
                                        <p className="text-sm text-muted-foreground">Tạo banner đầu tiên để hiển thị trên trang chủ</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            banners.map((banner) => (
                                <TableRow key={banner.id} className="group hover:bg-muted/30 transition-colors table-row-hover">
                                    <TableCell className="font-medium text-center text-muted-foreground">
                                        {banner.order}
                                    </TableCell>
                                    <TableCell>
                                        <div className="relative h-12 w-24 rounded-md overflow-hidden border bg-muted shadow-sm group-hover:shadow transition-shadow">
                                            <Image
                                                src={banner.image}
                                                alt={banner.title}
                                                fill
                                                className="object-cover transition-transform group-hover:scale-105"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">{banner.title}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                        {banner.link ? (
                                            <a href={banner.link} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                                                {banner.link}
                                            </a>
                                        ) : (
                                            <span className="opacity-50">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {banner.isPublished ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 badge-pulse">
                                                Hiển thị
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                                                Đang ẩn
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <BannerActions bannerId={banner.id} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
