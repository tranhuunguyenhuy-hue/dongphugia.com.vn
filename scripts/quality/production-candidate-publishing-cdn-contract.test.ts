// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/production-candidate.yml'),
  'utf8',
)

describe('production candidate Publishing CDN contract', () => {
  it('fails before Docker build when the production Publishing CDN hostname is absent', () => {
    const requireStep = workflow.indexOf('name: Require production Publishing CDN hostname')
    const buildStep = workflow.indexOf('name: Build and push exact candidate')

    expect(requireStep).toBeGreaterThan(-1)
    expect(buildStep).toBeGreaterThan(requireStep)
    expect(workflow).toContain(
      'PUBLISHING_BUNNY_CDN_HOSTNAME: ${{ vars.PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME }}',
    )
    expect(workflow).toContain('test -n "$PUBLISHING_BUNNY_CDN_HOSTNAME"')
  })

  it('passes the exact production Publishing CDN hostname to the Next build without fallback', () => {
    expect(workflow).toContain(
      'PUBLISHING_BUNNY_CDN_HOSTNAME=${{ vars.PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME }}',
    )
    expect(workflow).not.toContain(
      'PUBLISHING_BUNNY_CDN_HOSTNAME=${{ vars.PRODUCTION_PUBLISHING_BUNNY_CDN_HOSTNAME || env.BUNNY_CDN_HOSTNAME }}',
    )
  })
})
