import prisma from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, ImageIcon, MapPin } from "lucide-react"
import { ProjectDeleteButton } from "./project-delete-button"

export default async function ProjectsAdminPage() {
    const projects = await prisma.projects.findMany({ orderBy: { sort_order: 'asc' } })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dự án tiêu biểu</h1>
                    <p className="text-sm text-muted-foreground mt-1">{projects.length} dự án</p>
                </div>
                <Button asChild className="press-effect">
                    <Link href="/admin/du-an/new"><Plus className="mr-1.5 h-4 w-4" /> Thêm dự án</Link>
                </Button>
            </div>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead className="w-[80px]">Ảnh</TableHead>
                                <TableHead>Tên dự án</TableHead>
                                <TableHead>Danh mục</TableHead>
                                <TableHead>Vị trí</TableHead>
                                <TableHead>Thứ tự</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right w-[80px]">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.map((p) => (
                                <TableRow key={p.id} className="table-row-hover">
                                    <TableCell>
                                        {p.thumbnail_url ? (
                                            <div className="h-12 w-20 relative rounded overflow-hidden border border-[#E4EEF2] bg-slate-50">
                                                <Image src={p.thumbnail_url} alt={p.title} fill className="object-cover" sizes="80px" />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-20 rounded border border-[#E4EEF2] bg-slate-50 flex items-center justify-center">
                                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-sm">{p.title}</div>
                                        {p.is_featured && (
                                            <Badge variant="outline" className="text-[10px] mt-0.5 text-amber-600 border-amber-200">Nổi bật</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{p.category || '—'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[160px]">
                                        {p.location ? (
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{p.location}</span>
                                            </div>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground tabular-nums">{p.sort_order}</TableCell>
                                    <TableCell>
                                        <Badge variant={p.is_active ? "default" : "secondary"}
                                            className={p.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : ""}>
                                            {p.is_active ? "Hiển thị" : "Ẩn"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <Link href={`/admin/du-an/${p.id}`}
                                                className="h-8 w-8 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                                                title="Chỉnh sửa">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Link>
                                            <ProjectDeleteButton id={p.id} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {projects.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>Chưa có dự án nào</p>
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
