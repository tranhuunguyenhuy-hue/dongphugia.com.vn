#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const SOURCE_HOSTS = ['dongphugia.com.vn', 'www.dongphugia.com.vn']
const DEFAULT_REDIRECT_MAP = 'src/data/product-redirect-map.json'
const DEFAULT_OUTPUT = 'artifacts/legacy-web-urls.txt'

function parseArgs(argv) {
  const options = {
    redirectMap: DEFAULT_REDIRECT_MAP,
    output: DEFAULT_OUTPUT,
    input: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]

    if (argument === '--redirect-map' && value) {
      options.redirectMap = value
      index += 1
    } else if (argument === '--input' && value) {
      options.input = value
      index += 1
    } else if (argument === '--output' && value) {
      options.output = value
      index += 1
    } else if (argument === '--help') {
      console.log('Usage: node scripts/seo/build-legacy-url-inventory.mjs [--redirect-map FILE] [--input FILE] [--output FILE]')
      process.exit(0)
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${argument}`)
    }
  }

  return options
}

function resolveCandidate(line, host) {
  const value = line.trim()
  if (!value) return { status: 'EMPTY' }

  let url
  try {
    url = value.startsWith('/')
      ? new URL(value, `https://${host}`)
      : new URL(value)
  } catch {
    return { status: 'INVALID_URL' }
  }

  if (url.protocol !== 'https:') return { status: 'HTTPS_REQUIRED' }
  if (!SOURCE_HOSTS.includes(url.hostname)) return { status: 'SOURCE_HOST_REQUIRED' }
  if (url.username || url.password) return { status: 'AUTHORITY_FORBIDDEN' }

  return {
    status: 'ACCEPTED',
    value: `https://${url.hostname}${url.pathname}${url.search}`,
  }
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

async function readRedirectMap(file) {
  const parsed = JSON.parse(await readFile(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('REDIRECT_MAP_OBJECT_REQUIRED')
  }
  return Object.keys(parsed)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const counts = new Map()
  const urls = new Set()
  let mapEntries = 0
  let inputEntries = 0

  const addCandidate = (line, source) => {
    const candidates = line.startsWith('/')
      ? SOURCE_HOSTS.map((host) => resolveCandidate(line, host))
      : [resolveCandidate(line)]

    for (const candidate of candidates) {
      increment(counts, `${source}:${candidate.status}`)
      if (candidate.status === 'ACCEPTED') urls.add(candidate.value)
    }
  }

  for (const pathname of await readRedirectMap(options.redirectMap)) {
    mapEntries += 1
    addCandidate(pathname, 'redirect-map')
  }

  if (options.input) {
    const lines = (await readFile(options.input, 'utf8')).split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      inputEntries += 1
      addCandidate(trimmed, 'reviewed-input')
    }
  }

  const sortedUrls = [...urls].sort((left, right) => left.localeCompare(right))
  const outputPath = path.resolve(options.output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${sortedUrls.join('\n')}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: sortedUrls.length > 0,
    sourceHosts: SOURCE_HOSTS.length,
    redirectMapEntries: mapEntries,
    reviewedInputEntries: inputEntries,
    uniqueUrls: sortedUrls.length,
    rejectedOrSkipped: [...counts.entries()]
      .filter(([key]) => !key.endsWith(':ACCEPTED'))
      .reduce((total, [, value]) => total + value, 0),
    classifications: Object.fromEntries([...counts.entries()].sort()),
  }))
}

try {
  await main()
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  }))
  process.exitCode = 1
}
