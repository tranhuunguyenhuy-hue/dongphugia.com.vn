// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assertTargetPrivate } from './run.mjs'

describe('assertTargetPrivate', () => {
  async function queryForRole(role) {
    let captured
    const client = {
      async query(sql, values) {
        captured = { sql, values }
        return { rows: [{ unsafe: false }] }
      },
    }

    await assertTargetPrivate(client, role)
    return captured
  }

  it('checks the canonical authenticated role by default', async () => {
    const captured = await queryForRole()

    expect(captured.values[2]).toBe('authenticated')
    expect(captured.sql).toContain("r.rolname in ('anon',$3::name)")
    expect(captured.sql).toContain('r.rolname=$3::name')
  })

  it('accepts a unique authenticated test role without changing production defaults', async () => {
    const captured = await queryForRole('direct_authenticated_123_456')

    expect(captured.values[2]).toBe('direct_authenticated_123_456')
    expect(captured.sql).toContain("r.rolname in ('anon',$3::name)")
    expect(captured.sql).toContain('r.rolname=$3::name')
  })
})
