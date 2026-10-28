// Node-only tests have no Worker bindings. Snapshot reads must still fail closed.
// This alias exists only in vitest.config.ts, never in the Public build config.
export const env = Object.freeze({})
