import { createHash } from 'node:crypto'

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stableValue)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, stableValue(nested)]),
        )
    }
    return value
}

export function stableStringify(value: unknown): string {
    return JSON.stringify(stableValue(value))
}

export function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex')
}

export function hashObject(value: unknown): string {
    return sha256(stableStringify(value))
}
