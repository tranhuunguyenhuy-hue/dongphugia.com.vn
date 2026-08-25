import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { PostgresTarget } from './postgres-target'

type SchemaObject = { kind: string; identity: string; properties: unknown }
type SchemaManifest = { formatVersion: number; objects: SchemaObject[] }
type Drift = {
  type: 'missing' | 'unexpected' | 'changed'
  kind: string
  identity: string
  expectedSha256?: string
  actualSha256?: string
}
type AllowlistEntry = Drift & { reason: string; owner: string; reviewBy: string }

function fail(message: string): never {
  throw new Error(`SCHEMA_VERIFY_FAILED: ${message}`)
}

function parseArgs(argv: string[]) {
  const value = (name: string, fallback?: string) => {
    const index = argv.indexOf(name)
    return index === -1 ? fallback : argv[index + 1]
  }
  const target = value('--target', 'isolated-staging') as PostgresTarget
  const expected = value('--expected', 'db/postgres-migrations/schema-manifest.json')
  const allowlist = value('--allowlist', 'db/postgres-migrations/schema-drift-allowlist.json')
  if (target !== 'disposable' && target !== 'isolated-staging') fail('invalid target')
  if (!expected || !allowlist) fail('expected and allowlist paths are required')
  return { target, expected: path.resolve(expected), allowlist: path.resolve(allowlist) }
}

function sha(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function readManifest(content: string, label: string): SchemaManifest {
  let parsed: SchemaManifest
  try {
    parsed = JSON.parse(content) as SchemaManifest
  } catch {
    fail(`${label} is invalid JSON`)
  }
  if (parsed.formatVersion !== 2 || !Array.isArray(parsed.objects)) fail(`${label} has an invalid format`)
  return parsed
}

function objectMap(manifest: SchemaManifest) {
  const map = new Map<string, { object: SchemaObject; hash: string }>()
  for (const object of manifest.objects) {
    const key = `${object.kind}|${object.identity}`
    if (map.has(key)) fail(`duplicate object identity: ${key}`)
    map.set(key, { object, hash: sha(object.properties) })
  }
  return map
}

function compare(expected: SchemaManifest, actual: SchemaManifest): Drift[] {
  const expectedMap = objectMap(expected)
  const actualMap = objectMap(actual)
  const keys = new Set([...expectedMap.keys(), ...actualMap.keys()])
  const result: Drift[] = []
  for (const key of [...keys].sort()) {
    const before = expectedMap.get(key)
    const after = actualMap.get(key)
    const [kind, identity] = key.split('|')
    if (!before && after) result.push({ type: 'unexpected', kind, identity, actualSha256: after.hash })
    else if (before && !after) result.push({ type: 'missing', kind, identity, expectedSha256: before.hash })
    else if (before && after && before.hash !== after.hash) result.push({ type: 'changed', kind, identity, expectedSha256: before.hash, actualSha256: after.hash })
  }
  return result
}

function driftKey(drift: Drift) {
  return JSON.stringify({
    type: drift.type,
    kind: drift.kind,
    identity: drift.identity,
    expectedSha256: drift.expectedSha256 ?? null,
    actualSha256: drift.actualSha256 ?? null,
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const expected = readManifest(await readFile(args.expected, 'utf8').catch(() => fail('expected schema manifest is missing')), 'expected schema manifest')
  let allowlist: { formatVersion: number; entries: AllowlistEntry[] }
  try {
    allowlist = JSON.parse(await readFile(args.allowlist, 'utf8')) as { formatVersion: number; entries: AllowlistEntry[] }
  } catch {
    fail('schema drift allowlist is missing or invalid JSON')
  }
  if (allowlist.formatVersion !== 1 || !Array.isArray(allowlist.entries)) fail('schema drift allowlist has an invalid format')
  for (const entry of allowlist.entries) {
    if (!entry.reason || !entry.owner || !entry.reviewBy || /[*?]/.test(entry.identity)) fail('schema drift allowlist entries must be exact and attributed')
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dpg-schema-verify-'))
  const actualPath = path.join(tempRoot, 'actual.json')
  try {
    execFileSync('npx', ['tsx', 'scripts/db/postgres-schema-manifest.ts', '--target', args.target, '--out', actualPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    const actual = readManifest(await readFile(actualPath, 'utf8'), 'actual schema manifest')
    const drift = compare(expected, actual)
    const allowlisted = new Map(allowlist.entries.map((entry) => [driftKey(entry), entry]))
    const unexpected = drift.filter((item) => !allowlisted.has(driftKey(item)))
    const used = new Set(drift.map(driftKey))
    const unused = allowlist.entries.filter((entry) => !used.has(driftKey(entry)))
    if (unexpected.length > 0 || unused.length > 0) {
      fail(`schema drift outside exact allowlist (unexpected=${unexpected.length}, unusedAllowlist=${unused.length})`)
    }
    const expectedText = await readFile(args.expected, 'utf8')
    const actualText = await readFile(actualPath, 'utf8')
    console.log(JSON.stringify({
      status: 'PASS',
      target: args.target,
      expectedSha256: sha(JSON.parse(expectedText)),
      actualSha256: sha(JSON.parse(actualText)),
      objectCount: actual.objects.length,
      driftCount: drift.length,
      allowlistedCount: drift.length,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SCHEMA_VERIFY_FAILED:')) {
      console.error(error.message)
    } else {
      console.error('SCHEMA_VERIFY_FAILED: actual schema manifest could not be collected')
    }
    process.exitCode = 1
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false
if (isDirectExecution) void main()

export { compare, driftKey, objectMap }
