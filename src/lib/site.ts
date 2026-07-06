export const DEFAULT_CANONICAL_SITE_URL = "https://www.dongphugia.com.vn"

function normalizeAbsoluteUrl(value: string) {
  const url = new URL(value)

  if (url.hostname === "dongphugia.com.vn" || url.hostname === "www.dongphugia.com.vn") {
    url.hostname = "www.dongphugia.com.vn"
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
