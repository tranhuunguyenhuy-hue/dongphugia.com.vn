import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()
const args = process.argv.slice(2)

function readArg(prefix: string, fallback: string) {
  const arg = args.find(item => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function normalizeRedirectPath(value: string) {
  try {
    const parsed = new URL(value, 'https://www.dongphugia.com.vn')
    return `${parsed.pathname}${parsed.search}` || '/'
  } catch {
    const trimmed = String(value || '').trim()
    if (!trimmed) return '/'
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }
}

function normalizeRedirectDestination(value: string) {
  try {
    const parsed = new URL(value, 'https://www.dongphugia.com.vn')
    if (
      parsed.hostname === 'dongphugia.com.vn'
      || parsed.hostname === 'www.dongphugia.com.vn'
    ) {
      return `${parsed.pathname}${parsed.search}` || '/'
    }

    return parsed.toString().replace(/\/$/, '')
  } catch {
    return normalizeRedirectPath(value)
  }
}

function stableStringify(value: unknown) {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current
    return Object.keys(current as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (current as Record<string, unknown>)[key]
        return acc
      }, {})
  }, 2)
}

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

async function main() {
  const reportPath = path.resolve(process.cwd(), readArg('--report=', 'scripts/output/canonical-slug-audit.json'))
  const redirectMapPath = path.resolve(process.cwd(), readArg('--redirect-map=', 'src/data/product-redirect-map.json'))
  const outputPath = path.resolve(process.cwd(), readArg('--output=', 'scripts/output/canonical-rollout-preflight.json'))

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing audit report: ${reportPath}. Run audit:canonical-slugs first.`)
  }
  if (!fs.existsSync(redirectMapPath)) {
    throw new Error(`Missing redirect map: ${redirectMapPath}. Run generate:redirect-map first.`)
  }

  const audit = loadJsonFile<Record<string, unknown>>(reportPath)
  const fileRedirectMap = loadJsonFile<Record<string, string>>(redirectMapPath)

  const redirects = await prisma.redirects.findMany({
    where: { is_active: true },
    orderBy: [{ old_url: 'asc' }],
    select: {
      old_url: true,
      new_url: true,
      status_code: true,
      is_active: true,
    },
  })

  const dbRedirectMap = Object.fromEntries(
    redirects
      .filter(row => row.old_url && row.new_url && (row.status_code ?? 301) >= 300 && (row.status_code ?? 301) < 400)
      .map(row => [normalizeRedirectPath(row.old_url), normalizeRedirectDestination(row.new_url)])
  )

  const fileRedirectKeys = Object.keys(fileRedirectMap).sort()
  const dbRedirectKeys = Object.keys(dbRedirectMap).sort()
  const mapMatchesDb = stableStringify(fileRedirectMap) === stableStringify(dbRedirectMap)

  const chainSamples: Array<{ start: string; end: string; hops: number; chain: string[] }> = []
  const loopSamples: Array<{ start: string; chain: string[] }> = []
  let maxChainDepth = 0

  for (const start of dbRedirectKeys) {
    const chain = [start]
    const visited = new Set<string>([start])
    let current = start
    let depth = 0

    while (true) {
      const next = dbRedirectMap[current]
      if (!next) break

      depth += 1
      chain.push(next)
      if (visited.has(next)) {
        loopSamples.push({ start, chain })
        break
      }

      if (!dbRedirectMap[next]) {
        break
      }

      visited.add(next)
      current = next
      if (depth > 20) break
    }

    maxChainDepth = Math.max(maxChainDepth, depth)
    if (depth > 1 && chain.length > 1) {
      chainSamples.push({ start, end: chain[chain.length - 1], hops: depth, chain })
    }
  }

  const canonicalHost = 'www.dongphugia.com.vn'
  const nonCanonicalDestinations = Object.entries(dbRedirectMap)
    .filter(([, destination]) => destination.startsWith('http') && !destination.includes(canonicalHost))
    .slice(0, 50)

  const report = {
    generated_at: new Date().toISOString(),
    audit,
    redirect_map_file_entries: fileRedirectKeys.length,
    redirect_map_db_entries: dbRedirectKeys.length,
    redirect_map_matches_db: mapMatchesDb,
    redirect_loops: loopSamples.length,
    redirect_chain_count_gt1: chainSamples.length,
    max_redirect_chain_depth: maxChainDepth,
    non_canonical_redirect_destinations: nonCanonicalDestinations,
    ready_for_execute: mapMatchesDb && loopSamples.length === 0 && chainSamples.length === 0 && nonCanonicalDestinations.length === 0,
    loop_samples: loopSamples.slice(0, 20),
    chain_samples: chainSamples.slice(0, 20),
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)

  console.log('🧭 Canonical rollout preflight')
  console.log(`  audit report: ${reportPath}`)
  console.log(`  redirect map file entries: ${report.redirect_map_file_entries}`)
  console.log(`  redirect map DB entries: ${report.redirect_map_db_entries}`)
  console.log(`  redirect map matches DB: ${report.redirect_map_matches_db ? 'yes' : 'no'}`)
  console.log(`  redirect loops: ${report.redirect_loops}`)
  console.log(`  redirect chain count > 1: ${report.redirect_chain_count_gt1}`)
  console.log(`  max redirect chain depth: ${report.max_redirect_chain_depth}`)
  console.log(`  ready for execute: ${report.ready_for_execute ? 'yes' : 'no'}`)
  console.log(`  report: ${outputPath}`)

  if (!report.ready_for_execute) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('❌ Canonical rollout preflight failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
