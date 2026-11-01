// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const entropyPreload = fileURLToPath(new URL('./deterministic-build-entropy.mjs', import.meta.url))

function evaluate(seed, code, extraEnv = {}) {
  const output = execFileSync(process.execPath, [
    '--import', entropyPreload,
    '--input-type=module',
    '--eval', code,
  ], {
    encoding: 'utf8',
    env: { ...process.env, DPG_DETERMINISTIC_BUILD_SEED: seed, ...extraEnv },
  })
  return JSON.parse(output)
}

function randomSequence(seed) {
  return evaluate(seed, 'process.stdout.write(JSON.stringify(Array.from({ length: 8 }, () => Math.random())))')
}

describe('deterministic build entropy', () => {
  it('returns the same source-seeded Math.random sequence at identical callsites', () => {
    const first = randomSequence('a'.repeat(64))
    const second = randomSequence('a'.repeat(64))

    expect(first).toEqual(second)
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true)
    expect(randomSequence('b'.repeat(64))).not.toEqual(first)
  })

  it('keeps a build callsite stable when another callsite consumes more values', () => {
    const code = `
      function unrelated() { return Math.random() }
      function identifier() { return Math.random() }
      const first = identifier()
      for (let i = 0; i < Number(process.env.EXTRA_CALLS); i++) unrelated()
      process.stdout.write(JSON.stringify([first, identifier()]))
    `
    const first = evaluate('a'.repeat(64), code, { EXTRA_CALLS: '0' })
    const second = evaluate('a'.repeat(64), code, { EXTRA_CALLS: '100' })
    expect(first).toEqual(second)
    expect(first[0]).not.toBe(first[1])
  })
})
