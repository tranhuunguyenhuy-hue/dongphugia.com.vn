import { X509Certificate } from 'node:crypto'

const CERTIFICATE_LIMIT_BYTES = 64 * 1024

function fail() {
  throw new Error('supabase_runtime_tls_certificate_invalid')
}

export function validateSupabaseRuntimeRootCertificate(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > CERTIFICATE_LIMIT_BYTES) fail()

  const normalized = value.trim()
  if (!/^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+?\r?\n-----END CERTIFICATE-----$/.test(normalized)) fail()

  let certificate
  try {
    certificate = new X509Certificate(normalized)
  } catch {
    fail()
  }

  const now = Date.now()
  const validFrom = Date.parse(certificate.validFrom)
  const validTo = Date.parse(certificate.validTo)
  if (certificate.ca !== true || !Number.isFinite(validFrom) || !Number.isFinite(validTo)
    || now < validFrom || now > validTo) fail()

  return `${normalized}\n`
}

export function supabaseRuntimeTlsOptions(host, certificate = process.env.SUPABASE_REHOME_ROOT_CA_CERTIFICATE) {
  if (typeof host !== 'string' || !/^[a-z0-9.-]+$/.test(host)) fail()
  return {
    ca: validateSupabaseRuntimeRootCertificate(certificate),
    rejectUnauthorized: true,
    servername: host,
    minVersion: 'TLSv1.2',
  }
}
