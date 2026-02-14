import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, Users, Globe } from "lucide-react"
import { PartnerActions } from "./partner-actions"
import Image from "next/image"

export default async function PartnersPage() {
    const partners = await prisma.partner.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-6 fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quản lý Đối tác</h2>
                    <p className="text-sm text-muted-foreground">Danh sách các thương hiệu và đối tác đồng hành</p>
                </div>
                <Button asChild className="press-effect shadow-md">
                    <Link href="/admin/doi-tac/new">
                        <Plus className="mr-2 h-4 w-4" /> Thêm Đối tác
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng số Đối tác</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{partners.length}</div>
                    </CardContent>
                </Card>
            </div>

            {partners.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-4 min-h-[300px] border-2 border-dashed rounded-lg bg-muted/30">
                    <div className="p-6 rounded-full bg-muted">
                        <Users className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-lg">Chưa có đối tác nào</h3>
                        <p className="text-muted-foreground text-sm mt-1">Thêm đối tác để hiển thị logo trên trang chủ</p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/admin/doi-tac/new">
                            <Plus className="mr-2 h-4 w-4" /> Thêm Đối tác
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {partners.map((partner) => (
                        <div key={partner.id} className="group relative bg-white border rounded-xl p-4 flex flex-col items-center justify-center gap-4 shadow-sm hover:shadow-lg transition-all duration-300 card-hover aspect-square">
                            <div className="relative h-20 w-full">
                                <Image
                                    src={partner.logo}
                                    alt={partner.name}
                                    fill
                                    className="object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                                />
                            </div>
                            <div className="text-center w-full">
                                <h3 className="font-semibold text-sm truncate" title={partner.name}>{partner.name}</h3>
                                {partner.websiteUrl && (
                                    <a
                                        href={partner.websiteUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 mt-1"
                                    >
                                        <Globe className="h-3 w-3" /> Website
                                    </a>
                                )}
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <PartnerActions partnerId={partner.id} />
                            </div>
                        </div>
                    ))}

                    {/* Ghost card for adding new */}
                    <Link href="/admin/doi-tac/new" className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 gap-2 text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-all aspect-square">
                        <Plus className="h-8 w-8" />
                        <span className="text-sm font-medium">Thêm mới</span>
                    </Link>
                </div>
            )}
        </div>
    )
}
