import { describe, expect, it } from "vitest"
import { isListingPageInRange, parseListingPage } from "./listing-pagination"

describe("public listing pagination", () => {
  it.each([
    [undefined, 1],
    ["1", 1],
    ["12", 12],
  ])("parses a canonical positive page %s", (raw, expected) => {
    expect(parseListingPage(raw)).toBe(expected)
  })

  it.each(["", "0", "-1", "1.5", "abc", "1abc", " 1"])(
    "rejects malformed page input without passing NaN to Prisma: %s",
    (raw) => expect(parseListingPage(raw)).toBeNull(),
  )

  it("rejects an out-of-range page while allowing page one for an empty filtered result", () => {
    expect(isListingPageInRange(3, 2)).toBe(false)
    expect(isListingPageInRange(1, 0)).toBe(true)
  })
})
