import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

function fail(code) {
  throw new Error(code)
}

async function listFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)))) {
    const child = path.join(relative, entry.name)
    if (entry.isSymbolicLink()) fail('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
    if (entry.isDirectory()) files.push(...await listFiles(root, child))
    else if (entry.isFile()) files.push(child)
    else fail('ENVIRONMENT_WORKER_ARTIFACT_ENTRY_INVALID')
  }
  return files
}

export async function digestEnvironmentWorkerArtifact(artifactRoot) {
  const root = path.resolve(artifactRoot)
  const files = await listFiles(root)
  if (files.length === 0) fail('ENVIRONMENT_WORKER_ARTIFACT_EMPTY')

  const hash = createHash('sha256')
  let totalBytes = 0
  for (const relative of files) {
    const content = await readFile(path.join(root, relative))
    const filename = Buffer.from(relative.split(path.sep).join('/'))
    const filenameLength = Buffer.alloc(4)
    filenameLength.writeUInt32BE(filename.byteLength)
    const contentLength = Buffer.alloc(8)
    contentLength.writeBigUInt64BE(BigInt(content.byteLength))
    hash.update(filenameLength)
    hash.update(filename)
    hash.update(contentLength)
    hash.update(content)
    totalBytes += content.byteLength
  }
  return { sha256: hash.digest('hex'), fileCount: files.length, totalBytes }
}

async function main() {
  const [artifactRoot] = process.argv.slice(2)
  if (!artifactRoot) fail('USAGE: environment-worker-artifact-digest <artifact-root>')
  const result = await digestEnvironmentWorkerArtifact(artifactRoot)
  process.stdout.write(`${result.sha256}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_ARTIFACT_DIGEST_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
