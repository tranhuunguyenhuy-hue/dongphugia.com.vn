/**
 * Static Sitemap Route — /sitemap_static.xml
 *
 * Moved from /api/sitemap_static to avoid the `Disallow: /api/` robots.txt rule
 * blocking Googlebot from reading this sitemap.
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCanonicalSiteUrl } from "@/lib/site"
import { sitemapUnavailable } from "@/lib/seo/sitemap-response"
import { buildPublicSitemapVisibilityWhere } from "@/lib/public-product-visibility"

export const revalidate = 300
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const baseUrl = getCanonicalSiteUrl()
    const [subcategories, blogPosts] = await Promise.all([
      prisma.subcategories.findMany({
        where: {
          is_active: true,
          categories: { is_active: true },
          products: { some: buildPublicSitemapVisibilityWhere() },
        },
        select: {
          slug: true,
          updated_at: true,
          categories: { select: { slug: true } },
        },
        orderBy: { sort_order: "asc" },
      }),
      prisma.blog_posts.findMany({
        where: {
          status: "published",
          published_at: { lte: new Date() },
        },
        select: {
          slug: true,
          updated_at: true,
          blog_categories: { select: { slug: true } },
        },
        orderBy: { published_at: "desc" },
      }),
    ])

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`

    const addUrl = (
      url: string,
      lastMod: string,
      changeFreq: string,
      priority: number,
    ) => {
      xml += `  <url>\n`
      xml += `    <loc>${url}</loc>\n`
      xml += `    <lastmod>${lastMod}</lastmod>\n`
      xml += `    <changefreq>${changeFreq}</changefreq>\n`
      xml += `    <priority>${priority.toFixed(1)}</priority>\n`
      xml += `  </url>\n`
    }

    const now = new Date().toISOString()
    addUrl(baseUrl, now, "daily", 1.0)
    addUrl(`${baseUrl}/thiet-bi-ve-sinh`, now, "weekly", 0.9)
    addUrl(`${baseUrl}/gach-op-lat`, now, "weekly", 0.9)
    addUrl(`${baseUrl}/thiet-bi-bep`, now, "weekly", 0.9)
    addUrl(`${baseUrl}/vat-lieu-nuoc`, now, "weekly", 0.9)
    addUrl(`${baseUrl}/blog`, now, "daily", 0.8)
    addUrl(`${baseUrl}/lien-he`, now, "monthly", 0.7)
    addUrl(`${baseUrl}/ve-chung-toi`, now, "monthly", 0.6)
    addUrl(`${baseUrl}/doi-tac`, now, "monthly", 0.5)
    addUrl(`${baseUrl}/du-an`, now, "monthly", 0.5)

    for (const sub of subcategories) {
      addUrl(
        `${baseUrl}/${sub.categories.slug}/${sub.slug}`,
        sub.updated_at.toISOString(),
        "weekly",
        0.8,
      )
    }

    for (const post of blogPosts) {
      if (post.blog_categories?.slug) {
        addUrl(
          `${baseUrl}/blog/${post.blog_categories.slug}/${post.slug}`,
          (post.updated_at || new Date()).toISOString(),
          "weekly",
          0.6,
        )
      }
    }

    xml += `</urlset>`

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "text/xml",
        "Cache-Control":
          "public, max-age=300, s-maxage=300, must-revalidate",
      },
    })
  } catch {
    return sitemapUnavailable("static")
  }
}
