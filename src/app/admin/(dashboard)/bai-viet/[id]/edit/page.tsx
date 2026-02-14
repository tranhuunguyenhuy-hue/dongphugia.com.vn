import prisma from "@/lib/prisma"
import PostForm from "../../post-form"
import { notFound } from "next/navigation"

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const post = await prisma.post.findUnique({
        where: { id }
    })

    if (!post) {
        notFound()
    }

    return <PostForm post={post} />
}
