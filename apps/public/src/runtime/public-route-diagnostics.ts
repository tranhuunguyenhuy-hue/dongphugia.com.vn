const SAFE_PUBLIC_ERROR_CODES = new Set([
  'PUBLIC_DATABASE_BINDING_REQUIRED', 'PUBLIC_DATABASE_MODE_DISABLED',
  'PUBLIC_DATABASE_READ_ONLY_REQUIRED', 'PUBLIC_PRODUCT_DB_ROW_INVALID',
  'PUBLIC_DATABASE_LISTING_TOO_LARGE', 'PUBLIC_DATABASE_SOURCE_ID_REQUIRED',
  'PUBLIC_DATABASE_LISTING_INVALID', 'PUBLIC_CATALOGUE_UNAVAILABLE',
  'PUBLIC_CATALOGUE_CHECKPOINT_MISMATCH',
])
const SAFE_ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'])

/** Bounded route failure metadata. Arbitrary exception text is never returned. */
export function publicRouteFailureSummary(error: unknown) {
  const value = error && typeof error === 'object' ? error as { name?: unknown; message?: unknown; code?: unknown } : {}
  const errorName = typeof value.name === 'string' && SAFE_ERROR_CLASSES.has(value.name) ? value.name : 'OtherError'
  const message = typeof value.message === 'string' ? value.message : ''
  const publicErrorCode = message.split(/\s/, 1)[0]
  const code = typeof value.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code) ? value.code : undefined
  return {
    errorClass: errorName,
    ...(SAFE_PUBLIC_ERROR_CODES.has(publicErrorCode) ? { publicErrorCode } : {}),
    ...(code ? { sqlState: code } : {}),
  }
}
