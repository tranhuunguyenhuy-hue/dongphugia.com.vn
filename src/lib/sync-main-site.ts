/**
 * Cross-domain cache sync helper for the Admin CMS.
 *
 * After any write operation (create/update/delete product, blog post, etc.),
 * call this function to trigger revalidation on the main site.
 *
 * Non-blocking: errors are logged but never thrown, so admin CRUD
 * operations always succeed even if the main site is temporarily unavailable.
 *
 * Usage in server actions:
 *   await syncMainSite(['/thiet-bi-ve-sinh', '/'])
 *   await syncMainSite([], ['products', 'blog'])
 */
export async function syncMainSite(
  paths: string[] = [],
  tags: string[] = []
): Promise<void> {
  const mainSiteUrl = process.env.MAIN_SITE_URL
  const secret = process.env.REVALIDATION_SECRET

  if (!mainSiteUrl || !secret) {
    console.warn('[syncMainSite] MAIN_SITE_URL or REVALIDATION_SECRET not set — skipping sync')
    return
  }

  if (paths.length === 0 && tags.length === 0) return

  try {
    const res = await fetch(`${mainSiteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidation-secret': secret,
      },
      body: JSON.stringify({ paths, tags }),
      // Don't hang admin operations if main site is slow
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[syncMainSite] Failed: HTTP ${res.status} — ${body}`)
    }
  } catch (err) {
    // Non-blocking: log and continue
    console.error('[syncMainSite] Network error:', err)
  }
}

// ─── PATH MAPS — common revalidation targets ──────────────────────────────────

/**
 * Paths to revalidate when a product is created/updated/deleted.
 * Call: await syncMainSite(productSyncPaths(categorySlug))
 */
export function productSyncPaths(categorySlug?: string): string[] {
  const paths = ['/', '/thiet-bi-ve-sinh', '/thiet-bi-bep', '/gach-op-lat', '/vat-lieu-nuoc']
  if (categorySlug) paths.push(`/${categorySlug}`)
  return paths
}

/**
 * Paths to revalidate when a blog post is created/updated/deleted.
 */
export function blogSyncPaths(postSlug?: string): string[] {
  const paths = ['/blog', '/tin-tuc']
  if (postSlug) paths.push(`/blog/${postSlug}`, `/tin-tuc/${postSlug}`)
  return paths
}

/**
 * Paths to revalidate when a banner is created/updated/deleted.
 */
export function bannerSyncPaths(): string[] {
  return ['/']
}
