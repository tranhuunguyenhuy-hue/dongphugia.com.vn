import { NextResponse } from "next/server"

export function sitemapUnavailable(route: string) {
  console.error(`[sitemap] ${route} generation unavailable`)

  return new NextResponse("Sitemap temporarily unavailable", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "300",
    },
  })
}
