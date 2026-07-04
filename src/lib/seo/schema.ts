/**
 * JSON-LD Schema Factory Functions
 *
 * Central module for generating structured data (JSON-LD) objects.
 * Each function returns a plain object — the caller is responsible
 * for rendering it via the <JsonLd> component.
 *
 * Usage:
 *   import { buildProductSchema } from "@/lib/seo/schema"
 *   import { JsonLd } from "@/components/seo/json-ld"
 *   // In a Server Component:
 *   <JsonLd data={buildProductSchema(product)} />
 */

import { siteConfig } from "@/config/site"

const BASE_URL = siteConfig.url // "https://dongphugia.com.vn"

// ─── Organization / LocalBusiness ─────────────────────────────────────────────

/**
 * Organization schema for the root layout.
 * Tells Google this is a local business with contact info.
 */
export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Đông Phú Gia",
    url: BASE_URL,
    logo: `${BASE_URL}/images/Logo.png`,
    telephone: siteConfig.contact.hotline,
    email: siteConfig.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.contact.address,
      addressLocality: "Đà Lạt",
      addressRegion: "Lâm Đồng",
      addressCountry: "VN",
    },
    openingHours: "Mo-Su 07:30-17:00",
    sameAs: ["https://facebook.com/dongphugia", "https://zalo.me/0855528688"],
  }
}

// ─── Product ──────────────────────────────────────────────────────────────────

type ProductSchemaInput = {
  name: string
  description?: string | null
  sku: string
  image_main_url?: string | null
  price?: number | null
  original_price?: number | null
  price_display?: string | null
  stock_status: string
  brands?: { name: string } | null
  slug: string
  categorySlug: string
  subcategorySlug?: string | null
  urlPath?: string | null
}

/**
 * Product schema for PDP (Product Detail Pages).
 * Enables Google to show price, availability, and brand in search results.
 */
export function buildProductSchema(product: ProductSchemaInput) {
  const availability =
    product.stock_status === "in_stock"
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock"

  const hasPrice = product.price && Number(product.price) > 0

  // Canonical URL: /category/subcategory/slug
  const productUrl = product.urlPath
    ? `${BASE_URL}${product.urlPath}`
    : `${BASE_URL}/${product.categorySlug}/${product.subcategorySlug ?? "_"}/${product.slug}`

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description?.slice(0, 500) || undefined,
    sku: product.sku,
    image: product.image_main_url ? [product.image_main_url] : undefined,
    brand: product.brands
      ? { "@type": "Brand", name: product.brands.name }
      : undefined,
    url: productUrl,
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: hasPrice ? Number(product.price) : undefined,
      // Valid for 30 days — refresh on next ISR cycle
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      availability,
      url: productUrl,
      seller: {
        "@type": "Organization",
        name: "Đông Phú Gia",
      },
    },
  }
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

type BreadcrumbItem = {
  name: string
  /** Relative path (e.g. "/thiet-bi-ve-sinh") or full URL */
  url: string
}

/**
 * BreadcrumbList schema for all pages.
 * Enables Google to show breadcrumbs in search results.
 *
 * @example
 * buildBreadcrumbSchema([
 *   { name: "Trang chủ", url: "/" },
 *   { name: "Thiết Bị Vệ Sinh", url: "/thiet-bi-ve-sinh" },
 *   { name: "Bồn cầu TOTO CS300EN", url: "/thiet-bi-ve-sinh/bon-cau/toto-cs300en" },
 * ])
 */
export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  }
}

// ─── Article ──────────────────────────────────────────────────────────────────

type ArticleSchemaInput = {
  title: string
  excerpt?: string | null
  thumbnail_url?: string | null
  published_at?: Date | null
  updated_at: Date
  author_name: string
  slug: string
  blog_categories: { slug: string }
}

/**
 * Article schema for blog posts.
 * Enables Google News / rich article snippets.
 */
export function buildArticleSchema(post: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.thumbnail_url ? [post.thumbnail_url] : undefined,
    author: {
      "@type": "Organization",
      name: post.author_name,
    },
    publisher: {
      "@type": "Organization",
      name: "Đông Phú Gia",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/images/Logo.png`,
      },
    },
    datePublished: post.published_at?.toISOString(),
    dateModified: post.updated_at.toISOString(),
    mainEntityOfPage: `${BASE_URL}/blog/${post.blog_categories.slug}/${post.slug}`,
  }
}
