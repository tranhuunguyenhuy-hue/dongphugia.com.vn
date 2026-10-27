import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/supabase-runtime-issue160-recovery-once.yml'),
  'utf8',
)
const reportJob = workflow.split('\n  report_stop:\n')[1] ?? ''

describe('Issue 160 recovery workflow failure reporting', () => {
  it('posts only a sanitized STOP from an Owner-dispatched run with issue-only permission', () => {
    expect(reportJob).not.toBe('')
    expect(reportJob).toContain("github.actor == 'tranhuunguyenhuy-hue'")
    expect(reportJob).toContain('issues: write')
    expect(reportJob).toContain('Target write state: UNKNOWN; do not retry.')
    expect(reportJob).toContain('Run: $RUN_URL')
    expect(reportJob).toContain('Source SHA: $SOURCE_SHA')
    expect(reportJob).not.toMatch(/secrets\./)
    expect(reportJob).not.toMatch(/stderr|database_rows|decrypted_dump|connection_string/i)
  })
})
