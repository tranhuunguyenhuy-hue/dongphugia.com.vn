import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, Briefcase, Calculator } from "lucide-react"
import { ProjectActions } from "./project-actions"
import Image from "next/image"

export default async function ProjectsPage() {
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-6 fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quản lý Dự án</h2>
                    <p className="text-sm text-muted-foreground">Danh sách dự án tiêu biểu đã thực hiện</p>
                </div>
                <Button asChild className="press-effect shadow-md">
                    <Link href="/admin/du-an/new">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Dự án
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng số Dự án</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{projects.length}</div>
                    </CardContent>
                </Card>
            </div>

            {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-4 min-h-[400px] border-2 border-dashed rounded-lg bg-muted/30">
                    <div className="p-6 rounded-full bg-muted">
                        <Briefcase className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-lg">Chưa có dự án nào</h3>
                        <p className="text-muted-foreground text-sm mt-1">Hãy thêm dự án đầu tiên để khách hàng tham khảo</p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/admin/du-an/new">
                            <Plus className="mr-2 h-4 w-4" /> Thêm Dự án
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => {
                        let thumbnail = null
                        try {
                            const images = JSON.parse(project.images)
                            if (Array.isArray(images) && images.length > 0) {
                                thumbnail = images[0]
                            }
                        } catch (e) {
                            console.error("Error parsing images JSON", e)
                        }

                        return (
                            <div key={project.id} className="group relative bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 card-hover">
                                <div className="aspect-video relative bg-muted overflow-hidden">
                                    {thumbnail ? (
                                        <Image
                                            src={thumbnail}
                                            alt={project.name}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Briefcase className="h-8 w-8 text-muted-foreground/30" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Link href={`/admin/du-an/${project.id}/edit`}>
                                            <Button variant="secondary" size="sm" className="h-8">
                                                Chi tiết
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1" title={project.name}>
                                            {project.name}
                                        </h3>
                                        <div className="shrink-0">
                                            <ProjectActions projectId={project.id} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 font-mono">/{project.slug}</p>
                                    {project.description && (
                                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                                            {project.description}
                                        </p>
                                    )}
                                    <div className="mt-4 pt-4 border-t flex items-center text-xs text-muted-foreground">
                                        <Layers className="h-3 w-3 mr-1" />
                                        {thumbnail && JSON.parse(project.images).length} ảnh
                                        <span className="mx-2">•</span>
                                        {new Date(project.createdAt).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function Layers({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
    )
}
