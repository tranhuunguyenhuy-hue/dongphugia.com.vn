import { Button } from "@/components/ui/button"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"
import CollectionActions from "./collection-actions"

export default async function CollectionsPage() {
    const collections = await prisma.collection.findMany({
        include: {
            productType: true,
            _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Bộ sưu tập</h1>
                <Button asChild>
                    <Link href="/admin/collections/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Thêm BST
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Quản lý bộ sưu tập</CardTitle>
                    <CardDescription>Quản lý các bộ sưu tập gạch (VD: INSIDE ART, MOSAIC...)</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tên BST</TableHead>
                                <TableHead>Phân loại</TableHead>
                                <TableHead>Số SP</TableHead>
                                <TableHead className="text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {collections.map((col) => (
                                <TableRow key={col.id}>
                                    <TableCell className="font-medium">{col.name}</TableCell>
                                    <TableCell className="text-sm">{col.productType?.name || '—'}</TableCell>
                                    <TableCell>{col._count.products}</TableCell>
                                    <TableCell className="text-right">
                                        <CollectionActions collectionId={col.id} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {collections.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        Chưa có bộ sưu tập nào
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
