import { getSiteRuntimeConfig } from '@/lib/site'

export const dynamic = 'force-dynamic'

export function GET() {
    const site = getSiteRuntimeConfig()

    if (!site.allowIndexing) {
        return new Response('User-agent: *\nDisallow: /\n', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    }

    return new Response(
        [
            'User-agent: *',
            'Allow: /',
            'Allow: /sitemap.xml',
            'Allow: /sitemap_static.xml',
            'Allow: /sitemap_product_*.xml',
            'Disallow: /api/',
            'Disallow: /admin/',
            'Disallow: /studio/',
            `Sitemap: ${site.siteUrl}/sitemap.xml`,
            '',
        ].join('\n'),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
}
