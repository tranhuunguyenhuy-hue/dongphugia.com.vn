// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { artifactHandler, authorized, inspectZip, receiveArchive, validateEndpoint, validateToken } from './artifact-handoff.mjs'
const token = 'a'.repeat(64)
function response() { return { status: null, headers: {}, writeHead(status, headers) { this.status = status; this.headers = headers }, end() {}, destroy() {} } }
describe('private pinned artifact handoff', () => {
  it('requires a full 256-bit token and exact bearer scheme', () => {
    expect(() => validateToken('short')).toThrow('HANDOFF_TOKEN_INVALID')
    expect(authorized(`Bearer ${token}`, token)).toBe(true)
    expect(authorized(`bearer ${token}`, token)).toBe(false)
    expect(authorized(`Bearer ${'b'.repeat(64)}`, token)).toBe(false)
    expect(authorized(undefined, token)).toBe(false)
  })
  it.each(['http://a.trycloudflare.com/artifact', 'https://trycloudflare.com/artifact', 'https://a.trycloudflare.com.evil.test/artifact', 'https://a.trycloudflare.com:444/artifact', 'https://a.trycloudflare.com/other', 'https://user@a.trycloudflare.com/artifact', 'https://a.trycloudflare.com/artifact?q=1'])('rejects unsafe transport %s', value => {
    expect(() => validateEndpoint(value)).toThrow('HANDOFF_URL_INVALID')
  })
  it('allows only the exact HTTPS handoff endpoint', () => expect(validateEndpoint('https://some-random-name.trycloudflare.com/artifact').protocol).toBe('https:'))
  it('hides metadata before authentication and permits one completed download', async () => {
    let streams = 0
    const handler = artifactHandler({ token, streamArchive: async () => { streams++ } })
    const denied = response(); await handler({ headers: {}, method: 'GET', url: '/artifact' }, denied)
    expect(denied).toMatchObject({ status: 404, headers: { 'Cache-Control': 'no-store' } }); expect(streams).toBe(0)
    const req = { headers: { authorization: `Bearer ${token}` }, method: 'GET', url: '/artifact' }
    const ok = response(); await handler(req, ok); expect(ok.status).toBe(200)
    const replay = response(); await handler(req, replay); expect(replay.status).toBe(404); expect(streams).toBe(1)
  })
  it('expires without serving and rejects an excessive TTL', async () => {
    let clock = 0; const handler = artifactHandler({ token, ttlMs: 1, now: () => clock, streamArchive: () => { throw Error('must not stream') } })
    clock = 2; const res = response(); await handler({ headers: { authorization: `Bearer ${token}` }, method: 'GET', url: '/artifact' }, res); expect(res.status).toBe(404)
    expect(() => artifactHandler({ token, ttlMs: 1800001 })).toThrow('HANDOFF_TTL_INVALID')
  })
  it.each(['../escape', '/absolute', 'back\\slash', 'duplicate', 'symlink'])('rejects ZIP entry risk %s', async name => {
    const root = await mkdtemp(path.join(tmpdir(), 'dpg-handoff-test-')); const archive = path.join(root, 'archive.zip')
    execFileSync('python3', ['-c', `import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n n=sys.argv[2]\n if n=='symlink':\n  i=zipfile.ZipInfo('link');i.create_system=3;i.external_attr=0o120777<<16;z.writestr(i,'outside')\n else:\n  z.writestr(n,'safe')\n  if n=='duplicate':z.writestr(n,'other')`, archive, name], { stdio: 'ignore' })
    await expect(inspectZip(archive)).rejects.toThrow('HANDOFF_ZIP_CHECK_FAILED')
  })
  it('checks ZIP CRC and extracts only safe files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dpg-handoff-test-')); const archive = path.join(root, 'archive.zip')
    execFileSync('python3', ['-c', "import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],'w') as z:z.writestr('build/worker.js','safe')", archive])
    const destination = path.join(root, 'out')
    await expect(inspectZip(archive, destination)).resolves.toMatchObject({ entries: 1, crc: 'PASS' })
    expect(await readFile(path.join(destination, 'build/worker.js'), 'utf8')).toBe('safe')
  })
  it('refuses redirects/incorrect sizes before creating a received file', async () => {
    let options
    await expect(receiveArchive({ endpoint: 'https://safe-name.trycloudflare.com/artifact', token, archive: '/unused', destination: '/unused', fetchImpl: async (_url, init) => { options = init; return new Response('', { status: 302 }) } })).rejects.toThrow('HANDOFF_RESPONSE_INVALID')
    expect(options.redirect).toBe('error')
  })
})
