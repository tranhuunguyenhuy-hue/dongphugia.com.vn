"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, FileEdit, Trash2 } from "lucide-react"
import Link from "next/link"
import { deleteProduct } from "@/lib/actions"

interface ProductActionsProps {
    productId: string
}

export default function ProductActions({ productId }: ProductActionsProps) {
    async function handleDelete() {
        if (confirm("Are you sure you want to delete this product?")) {
            await deleteProduct(productId)
            alert("Product deleted")
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/admin/products/${productId}/edit`}>
                        <FileEdit className="mr-2 h-4 w-4" /> Edit
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 cursor-pointer">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
