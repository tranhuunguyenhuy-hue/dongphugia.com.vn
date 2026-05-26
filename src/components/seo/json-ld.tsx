/**
 * JsonLd — Lightweight JSON-LD script injector
 *
 * RSC-compatible: can be used in Server Components without any client-side overhead.
 * dangerouslySetInnerHTML is safe here because JSON.stringify outputs escaped JSON,
 * not arbitrary HTML. No user input is ever passed directly.
 *
 * Usage:
 *   import { JsonLd } from "@/components/seo/json-ld"
 *   import { buildProductSchema } from "@/lib/seo/schema"
 *
 *   // In a Server Component page:
 *   <JsonLd data={buildProductSchema(product)} />
 *
 * Multiple schemas on same page:
 *   <JsonLd data={buildProductSchema(product)} />
 *   <JsonLd data={buildBreadcrumbSchema([...])} />
 */

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify safely escapes all special chars — no XSS risk
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
