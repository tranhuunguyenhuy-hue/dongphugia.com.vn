import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FREE_WORKER_GZIP_LIMIT_KIB = 3 * 1024
const FREE_STATIC_ASSET_LIMIT = 20_000
const STATIC_ASSET_FILE_LIMIT_BYTES = 25 * 1024 * 1024

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--')) continue
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
    args[argument.slice(2)] = value
    index += 1
  }
  return args
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const child = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, child))
    else if (entry.isFile()) files.push(child)
  }
  return files.sort((left, right) => left.localeCompare(right))
}

async function digestDirectory(root: string, include: (relativePath: string) => boolean = () => true) {
  const hash = createHash('sha256')
  let totalBytes = 0
  let largestFile = { path: '', bytes: 0 }
  const files = (await listFiles(root)).filter(include)
  for (const relativePath of files) {
    const content = await readFile(path.join(root, relativePath))
    totalBytes += content.byteLength
    if (content.byteLength > largestFile.bytes) largestFile = { path: relativePath.split(path.sep).join('/'), bytes: content.byteLength }
    hash.update(`${relativePath.split(path.sep).join('/')}\0`)
    hash.update(content)
    hash.update('\0')
  }
  return { sha256: hash.digest('hex'), fileCount: files.length, totalBytes, largestFile }
}

async function runWranglerDryRun(repositoryRoot: string, artifactRoot: string) {
  const wrangler = path.join(repositoryRoot, 'apps', 'public', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, 'deploy', '--dry-run', '--config', 'wrangler.json'], {
      cwd: artifactRoot,
      env: { ...process.env, NO_COLOR: '1' },
    })
    let combined = ''
    child.stdout.on('data', (chunk) => { combined += chunk })
    child.stderr.on('data', (chunk) => { combined += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(combined) : reject(new Error(`WRANGLER_DRY_RUN_FAILED:${code}\n${combined}`)))
  })
  const match = output.match(/Total Upload:\s+([\d.]+) KiB\s+\/ gzip:\s+([\d.]+) KiB/)
  if (!match) throw new Error('WRANGLER_DRY_RUN_SIZE_MISSING')
  return { uploadKiB: Number(match[1]), gzipKiB: Number(match[2]) }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repositoryRoot = path.resolve(args['repository-root'] || '.')
  const serverDir = path.resolve(args['server-dir'] || '')
  const assetsDir = path.resolve(args['assets-dir'] || '')
  const outputDir = path.resolve(args.output || '')
  const sourceCommit = args['source-sha'] || ''
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error('PUBLIC_WORKER_ARTIFACT_SOURCE_INVALID')
  if (!await stat(serverDir).then((value) => value.isDirectory()).catch(() => false)) throw new Error('PUBLIC_WORKER_SERVER_MISSING')
  if (!await stat(assetsDir).then((value) => value.isDirectory()).catch(() => false)) throw new Error('PUBLIC_WORKER_ASSETS_MISSING')

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })
  await cp(serverDir, path.join(outputDir, 'worker'), {
    recursive: true,
    filter: (source) => !['wrangler.json', '.wrangler'].includes(path.basename(source)),
  })
  await cp(assetsDir, path.join(outputDir, 'assets'), { recursive: true })

  const generatedConfig = JSON.parse(await readFile(path.join(serverDir, 'wrangler.json'), 'utf8')) as Record<string, unknown>
  delete generatedConfig.configPath
  delete generatedConfig.userConfigPath
  generatedConfig.main = 'worker/index.js'
  generatedConfig.assets = { ...(generatedConfig.assets as object), directory: 'assets' }
  const configText = `${JSON.stringify(generatedConfig, null, 2)}\n`
  await writeFile(path.join(outputDir, 'wrangler.json'), configText, 'utf8')

  const worker = await digestDirectory(path.join(outputDir, 'worker'))
  const assets = await digestDirectory(path.join(outputDir, 'assets'))
  const configSha256 = createHash('sha256').update(configText).digest('hex')
  const dryRun = await runWranglerDryRun(repositoryRoot, outputDir)

  if (dryRun.gzipKiB > FREE_WORKER_GZIP_LIMIT_KIB) throw new Error('PUBLIC_WORKER_FREE_GZIP_LIMIT_EXCEEDED')
  if (assets.fileCount > FREE_STATIC_ASSET_LIMIT) throw new Error('PUBLIC_WORKER_FREE_ASSET_COUNT_EXCEEDED')
  if (assets.largestFile.bytes > STATIC_ASSET_FILE_LIMIT_BYTES) throw new Error('PUBLIC_WORKER_FREE_ASSET_SIZE_EXCEEDED')

  const evidence = {
    contract: 'dongphugia:public-worker-artifact:v1',
    sourceCommit,
    adapter: { name: 'vinext', version: '1.0.0-beta.8', command: 'vinext build' },
    packager: { name: 'wrangler', version: '4.127.1', command: 'wrangler deploy --dry-run' },
    worker: { ...worker, wranglerUploadKiB: dryRun.uploadKiB, wranglerGzipKiB: dryRun.gzipKiB },
    staticAssets: assets,
    configSha256,
    freeLimits: {
      workerGzipKiB: FREE_WORKER_GZIP_LIMIT_KIB,
      staticAssetFiles: FREE_STATIC_ASSET_LIMIT,
      individualStaticAssetBytes: STATIC_ASSET_FILE_LIMIT_BYTES,
      passed: true,
    },
  }
  await writeFile(path.join(outputDir, 'worker-artifact-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(evidence)}\n`)
}

main().catch((error) => {
  console.error(`LEO563_PUBLIC_WORKER_ARTIFACT_FAILED: ${error.message}`)
  process.exitCode = 1
})
