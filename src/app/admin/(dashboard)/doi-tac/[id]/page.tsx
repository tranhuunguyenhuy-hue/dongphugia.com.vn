import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PartnerForm } from '../partner-form'

export default async function EditPartnerPage({ params }: { params: { id: string } }) {
    const id = parseInt(params.id)
    if (isNaN(id)) notFound()

    const partner = await prisma.partners.findUnique({ where: { id } })
    if (!partner) notFound()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa đối tác</h1>
                <p className="text-sm text-muted-foreground mt-1">{partner.name}</p>
            </div>
            <PartnerForm partner={partner} />
        </div>
    )
}
