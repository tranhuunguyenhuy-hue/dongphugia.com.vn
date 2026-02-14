import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PartnerActions } from "./partner-actions"
import Image from "next/image"

export default async function PartnersPage() {
    const partners = await prisma.partner.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Quản lý Đối tác</h1>
                <Button asChild>
                    <Link href="/admin/doi-tac/new">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Đối tác
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Logo</TableHead>
                            <TableHead>Tên đối tác</TableHead>
                            <TableHead>Website</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {partners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    Chưa có đối tác nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            partners.map((partner) => (
                                <TableRow key={partner.id}>
                                    <TableCell>
                                        <div className="relative h-12 w-24 rounded overflow-hidden border bg-muted">
                                            <Image src={partner.logo} alt={partner.name} fill className="object-contain p-1" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{partner.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {partner.websiteUrl ? (
                                            <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                                                {partner.websiteUrl}
                                            </a>
                                        ) : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <PartnerActions partnerId={partner.id} />
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
