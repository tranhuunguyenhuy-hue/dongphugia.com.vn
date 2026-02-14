import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus } from "lucide-react"
import { ProjectActions } from "./project-actions"
import Image from "next/image"

export default async function ProjectsPage() {
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Quản lý Dự án</h1>
                <Button asChild>
                    <Link href="/admin/du-an/new">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Dự án
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Ảnh</TableHead>
                            <TableHead>Tên dự án</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    Chưa có dự án nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            projects.map((project) => {
                                const images = JSON.parse(project.images) as string[]
                                const firstImage = images.length > 0 ? images[0] : null
                                return (
                                    <TableRow key={project.id}>
                                        <TableCell>
                                            <div className="relative h-12 w-20 rounded overflow-hidden border bg-muted">
                                                {firstImage ? (
                                                    <Image src={firstImage} alt={project.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-400">NO IMG</div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{project.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                            {project.slug}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                                            {project.description || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <ProjectActions projectId={project.id} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
