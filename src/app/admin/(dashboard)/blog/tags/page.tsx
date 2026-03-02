import prisma from '@/lib/prisma'
import { TagsClient } from './tags-client'

export default async function BlogTagsPage() {
    const tags = await prisma.blog_tags.findMany({
        orderBy: { name: 'asc' },
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Quản lý Tags</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{tags.length} tags</p>
            </div>
            <TagsClient initialTags={tags} />
        </div>
    )
}
