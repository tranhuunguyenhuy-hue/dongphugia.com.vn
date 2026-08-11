import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const verificationFilename = "google82c633aea2548883.html"
const verificationPayload = `google-site-verification: ${verificationFilename}`

describe("Google Search Console verification file", () => {
  it("exposes Google's exact verification payload at the public root", () => {
    const verificationFile = resolve(process.cwd(), "public", verificationFilename)

    expect(readFileSync(verificationFile, "utf8")).toBe(verificationPayload)
  })
})
