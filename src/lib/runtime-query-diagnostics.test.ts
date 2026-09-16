import { describe, expect, it, vi } from 'vitest'
import { withRuntimeQueryDiagnostic } from './runtime-query-diagnostics'

describe('withRuntimeQueryDiagnostic', () => {
  it('logs only the fixed query marker and rethrows the original error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failure = new Error('DATABASE_URL=postgresql://user:secret@example.invalid/customer')

    await expect(withRuntimeQueryDiagnostic('homepage_banners', async () => {
      throw failure
    })).rejects.toBe(failure)

    expect(log).toHaveBeenCalledWith('DPG_RUNTIME_QUERY=homepage_banners')
    expect(log.mock.calls.flat().join(' ')).not.toContain('secret')
    expect(log.mock.calls.flat().join(' ')).not.toContain('customer')
    log.mockRestore()
  })
})
