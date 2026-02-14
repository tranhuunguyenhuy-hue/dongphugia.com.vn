import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PostActions } from "./post-actions"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export default async function PostsPage() {
    const posts = await prisma.post.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Quản lý Bài viết</h1>
                <Button asChild>
                    <Link href="/admin/bai-viet/new">
                        <Plus className="mr-2 h-4 w-4" /> Viết bài mới
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Ảnh</TableHead>
                            <TableHead>Tiêu đề</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {posts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    Chưa có bài viết nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            posts.map((post) => (
                                <TableRow key={post.id}>
                                    <TableCell>
                                        <div className="relative h-10 w-16 rounded overflow-hidden border bg-muted">
                                            {post.thumbnail ? (
                                                <Image src={post.thumbnail} alt={post.title} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-400">NO IMG</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium max-w-[300px] truncate" title={post.title}>
                                        {post.title}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                        {post.slug}
                                    </TableCell>
                                    <TableCell>
                                        {post.isPublished ? (
                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Xuất bản</Badge>
                                        ) : (
                                            <Badge variant="secondary">Nháp</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {post.createdAt.toLocaleDateString('vi-VN')}
                                    </TableCell>
                                    <TableCell>
                                        <PostActions postId={post.id} />
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
