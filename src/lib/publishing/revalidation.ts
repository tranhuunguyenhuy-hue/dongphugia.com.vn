import { revalidatePath, revalidateTag } from 'next/cache'

export function revalidatePublishingPublicSurfaces(input: {
    categorySlug: string
    postSlug: string
}) {
    revalidateTag('blog', { expire: 0 })
    revalidatePath('/')
    revalidatePath('/blog')
    revalidatePath(`/blog/${input.categorySlug}`)
    revalidatePath(`/blog/${input.categorySlug}/${input.postSlug}`)
    revalidatePath('/sitemap.xml')
    revalidatePath('/sitemap_static.xml')
}
