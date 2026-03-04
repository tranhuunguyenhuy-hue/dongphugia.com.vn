import prisma from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, ImageIcon, Globe } from "lucide-react"
import { PartnerDeleteButton } from "./partner-delete-button"

const TIER_COLORS: Record<string, string> = {
    'Bạch kim': 'bg-purple-50 text-purple-700 border-purple-200',
    'Vàng': 'bg-amber-50 text-amber-700 border-amber-200',
    'Đồng': 'bg-orange-50 text-orange-700 border-orange-200',
}

export default async function PartnersAdminPage() {
    const partners = await prisma.partners.findMany({ orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Đối tác</h1>
                    <p className="text-sm text-muted-foreground mt-1">{partners.length} đối tác</p>
                </div>
                <Button asChild className="press-effect">
                    <Link href="/admin/doi-tac/new"><Plus className="mr-1.5 h-4 w-4" /> Thêm đối tác</Link>
                </Button>
            </div>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead className="w-[80px]">Logo</TableHead>
                                <TableHead>Tên đối tác</TableHead>
                                <TableHead>Cấp độ</TableHead>
                                <TableHead>Website</TableHead>
                                <TableHead>Thứ tự</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right w-[80px]">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {partners.map((p) => (
                                <TableRow key={p.id} className="table-row-hover">
                                    <TableCell>
                                        {p.logo_url ? (
                                            <div className="h-10 w-20 relative rounded overflow-hidden border border-[#e2e8f0] bg-slate-50">
                                                <Image src={p.logo_url} alt={p.name} fill className="object-contain p-1" sizes="80px" />
                                            </div>
                                        ) : (
                                            <div className="h-10 w-20 rounded border border-[#e2e8f0] bg-slate-50 flex items-center justify-center">
                                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-sm">{p.name}</div>
                                        {p.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {p.tier && (
                                            <Badge variant="outline" className={`text-[11px] ${TIER_COLORS[p.tier] || ''}`}>
                                                {p.tier}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {p.link_url ? (
                                            <a href={p.link_url} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1 hover:text-primary transition-colors">
                                                <Globe className="h-3.5 w-3.5" />
                                                <span className="truncate max-w-[120px]">{p.link_url.replace(/^https?:\/\//, '')}</span>
                                            </a>
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
                                            <Link href={`/admin/doi-tac/${p.id}`}
                                                className="h-8 w-8 rounded-lg border border-[#e2e8f0] flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                                                title="Chỉnh sửa">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Link>
                                            <PartnerDeleteButton id={p.id} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {partners.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>Chưa có đối tác nào</p>
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
