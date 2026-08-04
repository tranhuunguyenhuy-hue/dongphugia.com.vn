export const DEFAULT_CANONICAL_SITE_URL = "https://www.dongphugia.vn"

function normalizeAbsoluteUrl(value: string) {
  const url = new URL(value)

  if (["dongphugia.vn", "www.dongphugia.vn", "dongphugia.com.vn", "www.dongphugia.com.vn"].includes(url.hostname)) {
    url.hostname = "www.dongphugia.vn"
    url.protocol = "https:"
  }

  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

export function getCanonicalSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_CANONICAL_SITE_URL

  try {
    return normalizeAbsoluteUrl(raw)
  } catch {
    return DEFAULT_CANONICAL_SITE_URL
  }
}

export function canonicalUrl(pathname = "") {
  if (!pathname) return getCanonicalSiteUrl()

  try {
    return normalizeAbsoluteUrl(new URL(pathname, getCanonicalSiteUrl()).toString())
  } catch {
    return pathname
  }
}
