import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
import { Prisma, Product, Category, Brand } from "@prisma/client"
import Image from "next/image"
import prisma from "@/lib/prisma"
import ProductActions from "./product-actions"

export default async function ProductsPage() {
    const products: (Product & { category: Category | null; brand: Brand | null })[] = await prisma.product.findMany({
        include: {
            category: true,
            brand: true,
        },
        orderBy: {
            updatedAt: 'desc'
        }
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Products</h1>
                <Button asChild>
                    <Link href="/admin/products/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Product
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Products</CardTitle>
                    <CardDescription>
                        View and manage your product inventory.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Image</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        {product.images ? (
                                            <div className="relative aspect-square w-12 overflow-hidden rounded-md">
                                                {/* Simplified handling for MVP: assume comma separated or single URL for now */}
                                                <Image
                                                    src={product.images.split(',')[0] || '/placeholder.svg'}
                                                    alt={product.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-12 rounded-md bg-muted/50" />
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.category?.name || 'Uncategorized'}</TableCell>
                                    <TableCell>
                                        {product.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(product.price)) : 'Contact'}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${product.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {product.isPublished ? 'Published' : 'Draft'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <ProductActions productId={product.id} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
