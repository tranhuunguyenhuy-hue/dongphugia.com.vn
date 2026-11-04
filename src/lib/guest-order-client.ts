import { getPersistedOrderRequestNumber } from './guest-order-contract'

const RECEIPT_STORAGE_KEY = 'dpg-order-request-receipt-v1'
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RECEIPT_LIFETIME_MS = 24 * 60 * 60 * 1000
type StoredReceiptKey = { key: string; savedAt: number; state: 'pending' | 'verified' | 'conflict' }

function readStoredReceiptKeys(): StoredReceiptKey[] {
  try {
    const stored = localStorage.getItem(RECEIPT_STORAGE_KEY)
    if (!stored) return []
    const value: unknown = JSON.parse(stored)
    const candidates = value && typeof value === 'object' && !Array.isArray(value) && 'keys' in value
      ? (value as { keys?: unknown }).keys
      : value && typeof value === 'object' && !Array.isArray(value) && 'key' in value
        ? [{ key: (value as { key?: unknown }).key, savedAt: (value as { savedAt?: unknown }).savedAt, state: 'pending' }]
        : []
    if (!Array.isArray(candidates)) return []
    const now = Date.now()
    return candidates.filter((candidate): candidate is StoredReceiptKey => (
      !!candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      && 'key' in candidate && typeof candidate.key === 'string' && IDEMPOTENCY_KEY_PATTERN.test(candidate.key)
      && 'savedAt' in candidate && typeof candidate.savedAt === 'number'
      && Number.isFinite(candidate.savedAt) && candidate.savedAt <= now
      && now - candidate.savedAt <= RECEIPT_LIFETIME_MS
      && 'state' in candidate
      && (candidate.state === 'pending' || candidate.state === 'verified' || candidate.state === 'conflict')
    )).sort((left, right) => right.savedAt - left.savedAt)
  } catch {
    return []
  }
}

export function storeOrderRequestReceiptKey(key: string): boolean {
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) return false
  try {
    const keys = readStoredReceiptKeys().filter((entry) => entry.key !== key)
    keys.unshift({ key, savedAt: Date.now(), state: 'pending' })
    localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify({ activeKey: key, keys: keys.slice(0, 10) }))
    return true
  } catch {
    return false
  }
}

export function getStoredOrderRequestReceiptKey(): string | null {
  const keys = readStoredReceiptKeys()
  if (!keys.length) {
    try { localStorage.removeItem(RECEIPT_STORAGE_KEY) } catch { /* best effort */ }
    return null
  }
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECEIPT_STORAGE_KEY) ?? 'null')
    if (value && typeof value === 'object' && !Array.isArray(value) && 'activeKey' in value
      && typeof value.activeKey === 'string'
      && keys.some((entry) => entry.key === value.activeKey && entry.state !== 'conflict')) return value.activeKey
  } catch { /* Fall through to newest retained key. */ }
  return keys.find((entry) => entry.state !== 'conflict')?.key ?? null
}

export function getPendingOrderRequestReceiptKeys(): string[] {
  return readStoredReceiptKeys().filter((entry) => entry.state === 'pending').map((entry) => entry.key)
}

export function getConflictedOrderRequestReceiptKeys(): string[] {
  return readStoredReceiptKeys().filter((entry) => entry.state === 'conflict').map((entry) => entry.key)
}

export function markOrderRequestReceiptConflict(key: string): void {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECEIPT_STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('keys' in value) || !Array.isArray(value.keys)) return
    const keys = (value.keys as StoredReceiptKey[]).map((entry) => entry.key === key ? { ...entry, state: 'conflict' as const } : entry)
    const activeKey = value && 'activeKey' in value && value.activeKey === key ? null : ('activeKey' in value ? value.activeKey : null)
    localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify({ ...value, activeKey, keys }))
  } catch { /* Keep the cart and report the conflict even if persistence fails. */ }
}

export function markOrderRequestReceiptVerified(key: string): void {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECEIPT_STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('keys' in value) || !Array.isArray(value.keys)) return
    const keys = (value.keys as StoredReceiptKey[]).map((entry) => entry.key === key ? { ...entry, state: 'verified' as const } : entry)
    localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify({ ...value, activeKey: key, keys }))
  } catch { /* The server remains the source of the receipt. */ }
}

export async function lookupOrderRequestReceipt(key: string): Promise<string | null> {
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) return null
  try {
    const response = await fetch('/api/order-requests/receipt', {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Idempotency-Key': key },
    })
    if (!response.ok) return null
    return getPersistedOrderRequestNumber(await response.json())
  } catch {
    return null
  }
}
