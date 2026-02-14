import prisma from "@/lib/prisma"
import ProjectForm from "../../project-form"
import { notFound } from "next/navigation"

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const project = await prisma.project.findUnique({
        where: { id }
    })

    if (!project) {
        notFound()
    }

    return <ProjectForm project={project} />
}
