/**
 * Static Sitemap Route — /sitemap_static.xml
 *
 * Moved from /api/sitemap_static to avoid the `Disallow: /api/` robots.txt rule
 * blocking Googlebot from reading this sitemap.
 *
 * Contains:
 * - Core pages (home, categories, contact, blog index)
 * - About pages (ve-chung-toi, doi-tac, du-an)
 * - Dynamic subcategory pages (from DB)
 * - Blog posts (from DB)
 *
 * Referenced by the sitemap index at /sitemap.xml
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const revalidate = 86400 // 24 hours

export async function GET() {
  // Canonical base URL — no trailing slash, no www
  const baseUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.com.vn").replace(
      /\/$/,
      ""
    )

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`

  const addUrl = (
    url: string,
    lastMod: string,
    changeFreq: string,
    priority: number
  ) => {
    xml += `  <url>\n`
    xml += `    <loc>${url}</loc>\n`
    xml += `    <lastmod>${lastMod}</lastmod>\n`
    xml += `    <changefreq>${changeFreq}</changefreq>\n`
    xml += `    <priority>${priority.toFixed(1)}</priority>\n`
    xml += `  </url>\n`
  }

  const now = new Date().toISOString()

  // ── Core pages ──────────────────────────────────────────────────────────────
  addUrl(baseUrl, now, "daily", 1.0)

  // Category landing pages
  addUrl(`${baseUrl}/thiet-bi-ve-sinh`, now, "weekly", 0.9)
  addUrl(`${baseUrl}/gach-op-lat`, now, "weekly", 0.9)
  addUrl(`${baseUrl}/thiet-bi-bep`, now, "weekly", 0.9)
  addUrl(`${baseUrl}/vat-lieu-nuoc`, now, "weekly", 0.9)

  // Blog index
  addUrl(`${baseUrl}/blog`, now, "daily", 0.8)

  // Static pages
  addUrl(`${baseUrl}/lien-he`, now, "monthly", 0.7)
  addUrl(`${baseUrl}/ve-chung-toi`, now, "monthly", 0.6)  // fixed: was /gioi-thieu (404)
  addUrl(`${baseUrl}/doi-tac`, now, "monthly", 0.5)
  addUrl(`${baseUrl}/du-an`, now, "monthly", 0.5)
  addUrl(`${baseUrl}/tin-tuc`, now, "weekly", 0.6)

  // ── Dynamic subcategory pages (from DB) ─────────────────────────────────────
  try {
    const subcategories = await prisma.subcategories.findMany({
      where: { is_active: true },
      select: {
        slug: true,
        updated_at: true,
        categories: { select: { slug: true } },
      },
      orderBy: { sort_order: "asc" },
    })

    for (const sub of subcategories) {
      addUrl(
        `${baseUrl}/${sub.categories.slug}/${sub.slug}`,
        sub.updated_at.toISOString(),
        "weekly",
        0.8
      )
    }
  } catch (e) {
    console.warn("[sitemap_static] Subcategory fetch error:", e)
  }

  // ── Blog posts (from DB) ─────────────────────────────────────────────────────
  try {
    const blogPosts = await prisma.blog_posts.findMany({
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
    })

    for (const post of blogPosts) {
      if (post.blog_categories?.slug) {
        addUrl(
          `${baseUrl}/blog/${post.blog_categories.slug}/${post.slug}`,
          (post.updated_at || new Date()).toISOString(),
          "weekly",
          0.6
        )
      }
    }
  } catch (e) {
    console.warn("[sitemap_static] Blog posts fetch error:", e)
  }

  xml += `</urlset>`

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "text/xml",
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate",
    },
  })
}
