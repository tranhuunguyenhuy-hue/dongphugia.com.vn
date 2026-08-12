import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"

type RedirectMap = Record<string, string>

type RedirectFailure = {
  destination: string
  status: number
  canonical: string | null
  reason: "request_failed" | "non_200" | "canonical_mismatch"
}

type CheckRedirectTargetsOptions = {
  /** Backwards-compatible shorthand when fetch and canonical origins are identical. */
  baseUrl?: string
  requestBaseUrl?: string
  canonicalBaseUrl?: string
  redirects: RedirectMap
  fetchImpl?: typeof fetch
}

function canonicalFromHtml(html: string) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]
    if (!rel?.split(/\s+/).some((value) => value.toLowerCase() === "canonical")) continue
    return tag.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? null
  }
  return null
}

export async function checkRedirectTargets({
  baseUrl,
  requestBaseUrl = baseUrl,
  canonicalBaseUrl = baseUrl,
  redirects,
  fetchImpl = fetch,
}: CheckRedirectTargetsOptions) {
  if (!requestBaseUrl || !canonicalBaseUrl) {
    throw new TypeError("requestBaseUrl and canonicalBaseUrl are required")
  }
  const requestOrigin = new URL(requestBaseUrl).origin
  const canonicalOrigin = new URL(canonicalBaseUrl).origin
  const destinations = [...new Set(Object.values(redirects))]
  const failures: RedirectFailure[] = []

  for (const destination of destinations) {
    const requestUrl = new URL(destination, `${requestOrigin}/`).toString()
    const expectedCanonical = new URL(destination, `${canonicalOrigin}/`).toString()
    try {
      const response = await fetchImpl(requestUrl, {
        redirect: "manual",
        headers: { "user-agent": "Dongphugia-SEO-Redirect-Validation/1.0" },
      })
      if (response.status !== 200) {
        failures.push({
          destination,
          status: response.status,
          canonical: null,
          reason: "non_200",
        })
        continue
      }

      const canonical = canonicalFromHtml(await response.text())
      if (canonical !== expectedCanonical) {
        failures.push({
          destination,
          status: response.status,
          canonical,
          reason: "canonical_mismatch",
        })
      }
    } catch {
      failures.push({
        destination,
        status: 0,
        canonical: null,
        reason: "request_failed",
      })
    }
  }

  return { checked: destinations.length, failures }
}

async function runCli() {
  const readArg = (name: string) => process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
  const baseUrl = readArg("--base-url")
  const requestBaseUrl = readArg("--request-base-url") ?? baseUrl
  const canonicalBaseUrl = readArg("--canonical-base-url") ?? baseUrl
  if (!requestBaseUrl || !canonicalBaseUrl) {
    console.error("Usage: tsx scripts/seo/check-redirect-targets.ts --base-url=https://example.com")
    console.error("   or: tsx scripts/seo/check-redirect-targets.ts --request-base-url=http://127.0.0.1:3000 --canonical-base-url=https://staging.example.com")
    process.exitCode = 2
    return
  }

  const loadMap = async (file: string) => JSON.parse(
    await readFile(path.resolve(process.cwd(), file), "utf8"),
  ) as RedirectMap
  const redirects = {
    ...await loadMap("src/data/product-redirect-map.json"),
    ...await loadMap("src/data/catalog-taxonomy-v2-redirect-map.json"),
  }
  const result = await checkRedirectTargets({ requestBaseUrl, canonicalBaseUrl, redirects })

  console.log(JSON.stringify(result, null, 2))
  if (result.failures.length > 0) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli()
}
