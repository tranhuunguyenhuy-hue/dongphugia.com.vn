import { describe, expect, it, vi } from "vitest"
import { checkRedirectTargets } from "./check-redirect-targets"

describe("redirect target HTTP gate", () => {
  it("accepts only an exact 200 response with a matching canonical URL", async () => {
    const baseUrl = "https://www.dongphugia.vn"
    const redirects = { "/old-product": "/new-product" }
    const fetchImpl = vi.fn(async () => new Response(
      '<html><head><link rel="canonical" href="https://www.dongphugia.vn/new-product"></head></html>',
      { status: 200 },
    ))

    await expect(checkRedirectTargets({ baseUrl, redirects, fetchImpl })).resolves.toEqual({
      checked: 1,
      failures: [],
    })
  })

  it.each([301, 404, 503])("rejects terminal HTTP %s", async (status) => {
    const fetchImpl = vi.fn(async () => new Response("", {
      status,
      headers: status === 301 ? { location: "/somewhere-else" } : undefined,
    }))

    const result = await checkRedirectTargets({
      baseUrl: "https://www.dongphugia.vn",
      redirects: { "/old-product": "/new-product" },
      fetchImpl,
    })

    expect(result.failures).toEqual([
      expect.objectContaining({ destination: "/new-product", status }),
    ])
  })

  it("rejects a 200 page whose canonical points elsewhere", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      '<link rel="canonical" href="https://www.dongphugia.vn/different-product">',
      { status: 200 },
    ))

    const result = await checkRedirectTargets({
      baseUrl: "https://www.dongphugia.vn",
      redirects: { "/old-product": "/new-product" },
      fetchImpl,
    })

    expect(result.failures).toEqual([
      expect.objectContaining({
        destination: "/new-product",
        canonical: "https://www.dongphugia.vn/different-product",
      }),
    ])
  })

  it("can fetch an isolated staging host while requiring the public staging canonical", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      '<link rel="canonical" href="https://staging.example.com/new-product">',
      { status: 200 },
    ))

    await expect(checkRedirectTargets({
      requestBaseUrl: "http://127.0.0.1:3000",
      canonicalBaseUrl: "https://staging.example.com",
      redirects: { "/old-product": "/new-product" },
      fetchImpl,
    })).resolves.toEqual({ checked: 1, failures: [] })

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/new-product",
      expect.objectContaining({ redirect: "manual" }),
    )
  })
})
