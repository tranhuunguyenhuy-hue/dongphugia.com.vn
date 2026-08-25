import { describe, expect, it } from 'vitest'
import { compare, driftKey, objectMap } from './postgres-schema-verify'

const manifest = (objects: Array<{ kind: string; identity: string; properties: unknown }>) => ({
  formatVersion: 2,
  objects,
})

describe('schema drift comparison', () => {
  it('classifies missing, unexpected and changed objects deterministically', () => {
    const expected = manifest([
      { kind: 'table', identity: 'public.keep', properties: { columns: 1 } },
      { kind: 'table', identity: 'public.changed', properties: { columns: 1 } },
    ])
    const actual = manifest([
      { kind: 'table', identity: 'public.keep', properties: { columns: 1 } },
      { kind: 'table', identity: 'public.changed', properties: { columns: 2 } },
      { kind: 'table', identity: 'public.extra', properties: { columns: 1 } },
    ])
    const drift = compare(expected, actual)
    expect(drift.map((entry) => `${entry.type}:${entry.identity}`)).toEqual([
      'changed:public.changed',
      'unexpected:public.extra',
    ])
    expect(driftKey(drift[0])).toContain('expectedSha256')
  })

  it('rejects duplicate kind/identity entries instead of silently overwriting', () => {
    expect(() => objectMap(manifest([
      { kind: 'index', identity: 'public.dup', properties: {} },
      { kind: 'index', identity: 'public.dup', properties: {} },
    ]))).toThrow('duplicate object identity')
  })
})
