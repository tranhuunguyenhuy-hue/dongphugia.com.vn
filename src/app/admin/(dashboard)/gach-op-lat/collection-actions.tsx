"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MoreHorizontal, Trash2 } from "lucide-react"
import { deleteCollection } from "@/lib/actions"
import { toast } from "sonner"
import CollectionDialog from "./collection-dialog"

interface CollectionActionsProps {
    collectionId: string
    collectionName: string
    productTypeId: string
    productTypeName: string
    currentImage: string | null
}

export default function CollectionActions({
    collectionId,
    collectionName,
    productTypeId,
    productTypeName,
    currentImage,
}: CollectionActionsProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteCollection(collectionId)
            toast.success(`Đã xóa bộ sưu tập "${collectionName}"`)
            setShowDeleteDialog(false)
            router.refresh()
        } catch (error) {
            toast.error("Không thể xóa. Có thể đang có sản phẩm trong bộ sưu tập này.")
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Thao tác</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                    <CollectionDialog
                        editMode
                        productTypeId={productTypeId}
                        productTypeName={productTypeName}
                        initialName={collectionName}
                        initialImage={currentImage}
                        collectionId={collectionId}
                    />
                    <button
                        onClick={() => setShowDeleteDialog(true)}
                        className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-accent rounded-sm flex items-center gap-2"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                    </button>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa bộ sưu tập &quot;{collectionName}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này không thể hoàn tác. Tất cả sản phẩm trong bộ sưu tập sẽ trở thành &quot;Chưa phân bộ sưu tập&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Đang xóa..." : "Xóa"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
