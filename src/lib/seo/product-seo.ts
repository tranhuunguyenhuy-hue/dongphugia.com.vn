import { Metadata } from "next"

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function getProductSeoDescription(
  description: string | null | undefined,
  fallback: string,
  maxLength = 160
) {
  const plain = description ? stripHtml(description) : ""
  if (!plain) return fallback
  return plain.slice(0, maxLength).trim()
}

type ProductMetadataInput = {
  name: string
  seo_title?: string | null
  seo_description?: string | null
  description?: string | null
  image_main_url?: string | null
  canonicalUrl: string
  categoryName: string
}

export function buildProductMetadata(input: ProductMetadataInput): Metadata {
  const title = input.seo_title?.trim() || `${input.name} | ${input.categoryName}`
  const fallbackDescription = `${input.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`
  const description = getProductSeoDescription(
    input.seo_description?.trim() || input.description,
    fallbackDescription
  )

  return {
    title,
    description,
    alternates: { canonical: input.canonicalUrl },
    openGraph: {
      title: input.name,
      description,
      url: input.canonicalUrl,
      images: input.image_main_url
        ? [{ url: input.image_main_url, width: 800, height: 600, alt: input.name }]
        : [],
    },
  }
}
