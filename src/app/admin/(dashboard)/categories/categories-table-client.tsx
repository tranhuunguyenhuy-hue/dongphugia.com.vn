'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Edit, Trash2, Eye, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function CategoriesTableClient({ categories }: { categories: any[] }) {
    return (
        <div className="border border-border/60 rounded-xl overflow-hidden bg-white">
            <Table>
                <TableHeader>
                    <TableRow className="bg-neutral-50/50">
                        <TableHead className="w-[60px] text-center">Icon</TableHead>
                        <TableHead>Tên danh mục</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="text-center">Danh mục con</TableHead>
                        <TableHead className="text-center">Sản phẩm</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {categories.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                <LayoutGrid className="h-8 w-8 mx-auto mb-3 opacity-30" />
                                Chưa có danh mục nào
                            </TableCell>
                        </TableRow>
                    ) : (
                        categories.map((category) => (
                            <TableRow key={category.id} className="hover:bg-neutral-50/50">
                                <TableCell className="text-center">
                                    <div className="w-10 h-10 mx-auto rounded border bg-neutral-50 flex items-center justify-center overflow-hidden">
                                        {category.thumbnail_url ? (
                                            <img src={category.thumbnail_url} alt={category.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <LayoutGrid className="h-4 w-4 text-neutral-300" />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                    <Link href={`/admin/categories/${category.id}`} className="hover:text-primary transition-colors">
                                        {category.name}
                                    </Link>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {category.slug}
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                    <Badge variant="secondary" className="font-mono">{category._count.subcategories}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                    <Badge variant="secondary" className="font-mono">{category._count.products}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={category.is_active ? 'default' : 'secondary'}>
                                        {category.is_active ? 'Hiển thị' : 'Ẩn'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/categories/${category.id}`}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Chỉnh sửa
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/danh-muc/${category.slug}`} target="_blank">
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Xem thực tế
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Xóa
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
