export function parseListingPage(raw: string | undefined): number | null {
  if (raw === undefined) return 1
  if (!/^[1-9]\d*$/.test(raw)) return null

  const page = Number(raw)
  return Number.isSafeInteger(page) ? page : null
}

export function isListingPageInRange(page: number, totalPages: number): boolean {
  return page <= Math.max(1, totalPages)
}
