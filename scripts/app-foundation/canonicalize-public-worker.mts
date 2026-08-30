import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv: string[]) {
  const index = argv.indexOf('--server-dir')
  const value = index >= 0 ? argv[index + 1] : undefined
  if (!value) throw new Error('PUBLIC_WORKER_SERVER_DIR_REQUIRED')
  return path.resolve(value)
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const child = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, child))
    else if (entry.isFile()) files.push(child)
  }
  return files
}

async function main() {
  const serverDir = parseArgs(process.argv.slice(2))
  const appRoot = path.dirname(path.dirname(serverDir))
  const canonicalRoot = '/workspace/apps/public'
  let replacements = 0

  for (const relativePath of await listFiles(serverDir)) {
    if (!/\.(?:js|json|map)$/.test(relativePath)) continue
    const filePath = path.join(serverDir, relativePath)
    const original = await readFile(filePath, 'utf8')
    const canonical = original.split(appRoot).join(canonicalRoot)
    if (canonical !== original) {
      replacements += 1
      await writeFile(filePath, canonical, 'utf8')
    }
  }

  const remaining = await Promise.all((await listFiles(serverDir)).map(async (relativePath) => {
    if (!/\.(?:js|json|map)$/.test(relativePath)) return false
    return (await readFile(path.join(serverDir, relativePath), 'utf8')).includes(appRoot)
  }))
  if (remaining.some(Boolean)) throw new Error('PUBLIC_WORKER_LOCAL_PATH_REMAINS')
  process.stdout.write(`LEO563_PUBLIC_WORKER_CANONICALIZED files=${replacements}\n`)
}

main().catch((error) => {
  console.error(`LEO563_PUBLIC_WORKER_CANONICALIZE_FAILED: ${error.message}`)
  process.exitCode = 1
})
