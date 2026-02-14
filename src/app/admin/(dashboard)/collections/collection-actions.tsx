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
import { deleteCollection } from "@/lib/actions"

interface CollectionActionsProps {
    collectionId: string
}

export default function CollectionActions({ collectionId }: CollectionActionsProps) {
    async function handleDelete() {
        if (confirm("Bạn có chắc muốn xóa bộ sưu tập này?")) {
            const result = await deleteCollection(collectionId)
            if (result?.message) alert(result.message)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/admin/collections/${collectionId}/edit`}>
                        <FileEdit className="mr-2 h-4 w-4" /> Sửa
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 cursor-pointer">
                    <Trash2 className="mr-2 h-4 w-4" /> Xóa
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
