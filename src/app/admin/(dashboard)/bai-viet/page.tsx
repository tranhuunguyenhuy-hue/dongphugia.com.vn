import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Plus, FileText, Search, Eye } from "lucide-react"
import { PostActions } from "./post-actions"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export default async function PostsPage() {
    const posts = await prisma.post.findMany({
        orderBy: { createdAt: 'desc' }
    })

    const totalPosts = posts.length
    const publishedPosts = posts.filter(p => p.isPublished).length

    return (
        <div className="space-y-6 fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quản lý Bài viết</h2>
                    <p className="text-sm text-muted-foreground">Tin tức, blog và thông báo của hệ thống</p>
                </div>
                <Button asChild className="press-effect shadow-md">
                    <Link href="/admin/bai-viet/new">
                        <Plus className="mr-2 h-4 w-4" /> Viết bài mới
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng số bài viết</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalPosts}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Đã xuất bản</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{publishedPosts}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Tìm kiếm bài viết..."
                        className="pl-8 bg-white"
                    />
                </div>
            </div>

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[80px] text-center">Ảnh</TableHead>
                            <TableHead className="w-[400px]">Tiêu đề</TableHead>
                            <TableHead>Slug (Đường dẫn)</TableHead>
                            <TableHead className="w-[120px]">Trạng thái</TableHead>
                            <TableHead className="w-[150px]">Ngày tạo</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {posts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-[300px] text-center">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <div className="p-4 rounded-full bg-muted">
                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="font-medium text-lg">Chưa có bài viết nào</p>
                                        <p className="text-sm text-muted-foreground">Bắt đầu viết bài để chia sẻ thông tin</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            posts.map((post) => (
                                <TableRow key={post.id} className="group hover:bg-muted/30 transition-colors table-row-hover">
                                    <TableCell>
                                        <div className="relative h-10 w-16 rounded border bg-muted overflow-hidden">
                                            {post.thumbnail ? (
                                                <Image src={post.thumbnail} alt={post.title} fill className="object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-secondary">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">
                                        <div className="line-clamp-2" title={post.title}>{post.title}</div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                        /{post.slug}
                                    </TableCell>
                                    <TableCell>
                                        {post.isPublished ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 badge-pulse">
                                                Public
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                                                Draft
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(post.createdAt).toLocaleDateString('vi-VN')}
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
