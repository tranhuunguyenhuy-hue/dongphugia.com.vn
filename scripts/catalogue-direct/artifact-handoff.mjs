import { createHash, timingSafeEqual } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, open, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Transform, Readable } from 'node:stream'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const PINNED_BYTES = 170366858
export const PINNED_SHA256 = '4e3ad7bb1fbd6f1a33f5c88cf5691837edd07230828d898913f4492b34cd22bf'
const MAX_TTL_MS = 30 * 60 * 1000
function gate(value, code) { if (!value) throw new Error(code) }
export function validateToken(token) { gate(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token), 'HANDOFF_TOKEN_INVALID'); return token }
export function authorized(header, token) {
  validateToken(token)
  const expected = Buffer.from(`Bearer ${token}`)
  const supplied = Buffer.from(typeof header === 'string' ? header : '')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
export function validateEndpoint(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('HANDOFF_URL_INVALID') }
  gate(url.protocol === 'https:' && /^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(url.hostname) && !url.port && !url.username && !url.password && url.pathname === '/artifact' && !url.search && !url.hash, 'HANDOFF_URL_INVALID')
  return url
}
const zipProgram = `
import sys,zipfile,pathlib,stat,json
archive,destination=sys.argv[1:]
with zipfile.ZipFile(archive) as z:
 infos=z.infolist(); seen=set(); total=0
 if not 1<=len(infos)<=25000: raise ValueError('count')
 for i in infos:
  n=i.filename; p=pathlib.PurePosixPath(n); mode=i.external_attr>>16
  if not n or n.startswith('/') or '\\\\' in n or any(x in ('','..','.') for x in n.rstrip('/').split('/')) or ':' in n or '\\x00' in n or n in seen or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0,stat.S_IFREG,stat.S_IFDIR)) or i.flag_bits&1: raise ValueError('path')
  seen.add(n); total+=i.file_size
  if i.file_size>25*1024*1024 or total>1024*1024*1024: raise ValueError('size')
 if z.testzip() is not None: raise ValueError('crc')
 if destination:
  root=pathlib.Path(destination)
  for i in infos:
   target=root.joinpath(*pathlib.PurePosixPath(i.filename).parts)
   if i.is_dir(): target.mkdir(parents=True,exist_ok=True)
   else:
    target.parent.mkdir(parents=True,exist_ok=True)
    with z.open(i) as source, target.open('xb') as output:
     import shutil
     shutil.copyfileobj(source,output,1024*1024)
 print(json.dumps({'entries':len(infos),'inflatedBytes':total,'crc':'PASS'}))
`
export async function inspectZip(archive, destination = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', zipProgram, archive, destination], { stdio: ['ignore', 'pipe', 'ignore'] })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 4096) child.kill() })
    child.on('error', () => reject(new Error('HANDOFF_ZIP_CHECK_FAILED')))
    child.on('close', code => { if (code !== 0) return reject(new Error('HANDOFF_ZIP_CHECK_FAILED')); try { resolve(JSON.parse(output)) } catch { reject(new Error('HANDOFF_ZIP_CHECK_FAILED')) } })
  })
}
export async function verifyArchive(file) {
  const info = await lstat(file)
  gate(info.isFile() && info.size === PINNED_BYTES, 'HANDOFF_ARCHIVE_SIZE_INVALID')
  const hash = createHash('sha256'); let bytes = 0
  for await (const chunk of createReadStream(file)) { bytes += chunk.length; gate(bytes <= PINNED_BYTES, 'HANDOFF_ARCHIVE_SIZE_INVALID'); hash.update(chunk) }
  gate(bytes === PINNED_BYTES && hash.digest('hex') === PINNED_SHA256, 'HANDOFF_ARCHIVE_DIGEST_INVALID')
  return inspectZip(file)
}
export function artifactHandler({ token, streamArchive, ttlMs = MAX_TTL_MS, now = Date.now }) {
  validateToken(token); gate(Number.isInteger(ttlMs) && ttlMs > 0 && ttlMs <= MAX_TTL_MS, 'HANDOFF_TTL_INVALID')
  const expires = now() + ttlMs; let consumed = false; let active = false
  return async (request, response) => {
    if (!authorized(request.headers.authorization, token) || request.method !== 'GET' || request.url !== '/artifact' || now() >= expires || consumed || active) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end(); return
    }
    active = true
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(PINNED_BYTES), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    try { await streamArchive(response); consumed = true } catch { response.destroy() } finally { active = false }
  }
}
export async function serveArchive({ file, token, port = 8798, ttlMs = MAX_TTL_MS }) {
  await verifyArchive(file)
  const server = createServer(artifactHandler({ token, ttlMs, streamArchive: response => pipeline(createReadStream(file), response) }))
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  const expiry = setTimeout(() => { server.closeAllConnections(); server.close() }, ttlMs)
  server.once('close', () => clearTimeout(expiry))
  return server
}
export async function receiveArchive({ endpoint, token, archive, destination, fetchImpl = fetch }) {
  validateEndpoint(endpoint); validateToken(token)
  const response = await fetchImpl(endpoint, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(MAX_TTL_MS) })
  gate(response.status === 200 && response.body && response.headers.get('content-length') === String(PINNED_BYTES), 'HANDOFF_RESPONSE_INVALID')
  const handle = await open(archive, 'wx', 0o600); await handle.close()
  let bytes = 0; const hash = createHash('sha256')
  const bounded = new Transform({ transform(chunk, encoding, callback) { bytes += chunk.length; if (bytes > PINNED_BYTES) return callback(new Error('HANDOFF_ARCHIVE_SIZE_INVALID')); hash.update(chunk); callback(null, chunk) } })
  await pipeline(Readable.fromWeb(response.body), bounded, createWriteStream(archive, { flags: 'r+' }))
  gate(bytes === PINNED_BYTES && hash.digest('hex') === PINNED_SHA256, 'HANDOFF_ARCHIVE_DIGEST_INVALID')
  await inspectZip(archive)
  const staged = await mkdtemp(path.join(path.dirname(destination), '.handoff-extract-'))
  const result = await inspectZip(archive, staged)
  try { await mkdir(destination, { mode: 0o700 }) } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const info = await lstat(destination)
    gate(info.isDirectory() && !info.isSymbolicLink(), 'HANDOFF_DESTINATION_UNSAFE')
    const names = await readdir(destination)
    gate(names.length === 1 && names[0] === 'evidence', 'HANDOFF_DESTINATION_NOT_EMPTY')
    const evidence = await lstat(path.join(destination, 'evidence'))
    gate(evidence.isDirectory() && !evidence.isSymbolicLink() && (await readdir(path.join(destination, 'evidence'))).length === 0, 'HANDOFF_DESTINATION_NOT_EMPTY')
  }
  await cp(staged, destination, { recursive: true, force: false, errorOnExist: true })
  return { status: 'PASS', bytes, sha256: PINNED_SHA256, ...result }
}
async function main() {
  const mode = process.argv[2]
  const args = process.argv.slice(3)
  const option = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1] }
  if (mode === 'serve') { const server = await serveArchive({ file: option('--archive'), token: process.env.DPG_ARTIFACT_HANDOFF_TOKEN, port: Number(option('--port') || 8798) }); console.log(JSON.stringify({ status: 'READY', bind: 'loopback', port: server.address().port, ttlSeconds: 1800, downloads: 1 })) }
  else if (mode === 'receive') console.log(JSON.stringify(await receiveArchive({ endpoint: process.env.DPG_ARTIFACT_HANDOFF_URL, token: process.env.DPG_ARTIFACT_HANDOFF_TOKEN, archive: path.join(path.dirname(option('--output')), '.handoff-received.zip'), destination: option('--output') })))
  else throw new Error('HANDOFF_MODE_INVALID')
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error('HANDOFF_FAILED'); process.exitCode = 1 })
