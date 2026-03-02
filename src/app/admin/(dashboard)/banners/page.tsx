import prisma from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, ImageIcon } from "lucide-react"
import { BannerDeleteButton } from "./banner-delete-button"

export default async function BannersPage() {
    const banners = await prisma.banners.findMany({
        orderBy: { sort_order: 'asc' },
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
                    <p className="text-sm text-muted-foreground mt-1">{banners.length} banner</p>
                </div>
                <Button asChild className="press-effect">
                    <Link href="/admin/banners/new"><Plus className="mr-1.5 h-4 w-4" /> Thêm mới</Link>
                </Button>
            </div>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead className="w-[80px]">Ảnh</TableHead>
                                <TableHead>Tiêu đề</TableHead>
                                <TableHead>URL liên kết</TableHead>
                                <TableHead>Thứ tự</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right w-[80px]">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {banners.map((b) => (
                                <TableRow key={b.id} className="table-row-hover">
                                    <TableCell>
                                        {b.image_url ? (
                                            <div className="h-12 w-20 relative rounded overflow-hidden border border-[#e2e8f0] bg-slate-50">
                                                <Image
                                                    src={b.image_url}
                                                    alt={b.title || 'Banner'}
                                                    fill
                                                    className="object-cover"
                                                    sizes="80px"
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-20 rounded border border-[#e2e8f0] bg-slate-50 flex items-center justify-center">
                                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium text-sm">{b.title || <span className="text-muted-foreground italic">Không có tiêu đề</span>}</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                        {b.link_url ? (
                                            <a href={b.link_url} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                                                {b.link_url}
                                            </a>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground tabular-nums">{b.sort_order}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={b.is_active ? "default" : "secondary"}
                                            className={b.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : ""}
                                        >
                                            {b.is_active ? "Hiển thị" : "Ẩn"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <Link
                                                href={`/admin/banners/${b.id}`}
                                                className="h-8 w-8 rounded-lg border border-[#e2e8f0] flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                                                title="Chỉnh sửa"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Link>
                                            <BannerDeleteButton id={b.id} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {banners.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-16">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>Chưa có banner nào</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
