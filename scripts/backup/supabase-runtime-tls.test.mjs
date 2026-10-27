import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  supabaseRuntimeTlsOptions,
  validateSupabaseRuntimeRootCertificate,
} from './supabase-runtime-tls.mjs'

function generateCertificate(isCertificateAuthority) {
  const directory = mkdtempSync(path.join(tmpdir(), 'dpg-test-tls-'))
  const key = path.join(directory, 'key.pem')
  const certificate = path.join(directory, 'certificate.pem')
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
      '-keyout', key, '-out', certificate, '-subj', '/CN=synthetic.invalid',
      '-addext', `basicConstraints=critical,CA:${isCertificateAuthority ? 'TRUE' : 'FALSE'}`,
    ], { stdio: 'ignore' })
    return readFileSync(certificate, 'utf8')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('Supabase runtime TLS trust', () => {
  it('requires a current CA certificate and explicit hostname verification', () => {
    const ca = generateCertificate(true)
    expect(validateSupabaseRuntimeRootCertificate(ca)).toBe(`${ca.trim()}\n`)
    expect(supabaseRuntimeTlsOptions('db.bonxyxluzlxfkdetryoo.supabase.co', ca)).toEqual({
      ca: `${ca.trim()}\n`,
      rejectUnauthorized: true,
      servername: 'db.bonxyxluzlxfkdetryoo.supabase.co',
      minVersion: 'TLSv1.2',
    })
  })

  it.each([
    undefined,
    '',
    'not-a-certificate',
    generateCertificate(false),
  ])('rejects missing, malformed, or non-CA certificates', (certificate) => {
    expect(() => validateSupabaseRuntimeRootCertificate(certificate))
      .toThrow('supabase_runtime_tls_certificate_invalid')
  })

  it('rejects invalid hosts before constructing TLS options', () => {
    expect(() => supabaseRuntimeTlsOptions('db.example.com?host=other', generateCertificate(true)))
      .toThrow('supabase_runtime_tls_certificate_invalid')
  })
})
