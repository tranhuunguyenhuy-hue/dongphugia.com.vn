import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus } from "lucide-react"
import { BannerActions } from "./banner-actions"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export default async function BannersPage() {
    const banners = await prisma.banner.findMany({
        orderBy: { order: 'asc' }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Quản lý Banner</h1>
                <Button asChild>
                    <Link href="/admin/banners/new">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Banner
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Thứ tự</TableHead>
                            <TableHead className="w-[200px]">Hình ảnh</TableHead>
                            <TableHead>Tiêu đề</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {banners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    Chưa có banner nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            banners.map((banner) => (
                                <TableRow key={banner.id}>
                                    <TableCell className="font-medium text-center">{banner.order}</TableCell>
                                    <TableCell>
                                        <div className="relative h-12 w-24 rounded overflow-hidden border bg-muted">
                                            <Image src={banner.image} alt={banner.title} fill className="object-cover" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{banner.title}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                        {banner.link || "—"}
                                    </TableCell>
                                    <TableCell>
                                        {banner.isPublished ? (
                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Hiển thị</Badge>
                                        ) : (
                                            <Badge variant="secondary">Ẩn</Badge>
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
