import prisma from "@/lib/prisma"
import PartnerForm from "../../partner-form"
import { notFound } from "next/navigation"

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const partner = await prisma.partner.findUnique({
        where: { id }
    })

    if (!partner) {
        notFound()
    }

    return <PartnerForm partner={partner} />
}
