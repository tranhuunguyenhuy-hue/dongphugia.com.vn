export type RuntimeRole = 'staging' | 'production'

export function getRuntimeRole(
    value = process.env.RUNTIME_ROLE,
): RuntimeRole | undefined {
    if (value === 'staging' || value === 'production') return value
    return undefined
}

export function isProductionRuntime() {
    return getRuntimeRole() === 'production'
}
