import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const RELEVANT_PREFIXES = [
  'src/app/(public)/', 'src/components/', 'src/lib/',
  'apps/public/', 'public/', 'prisma/', 'tests/readiness/',
  'docs/deploy/staging-db-bootstrap/', 'scripts/seo/',
]
const RELEVANT_FILES = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json',
  'next.config.ts', 'next.config.js', 'next.config.mjs',
  'postcss.config.mjs', 'playwright.homepage.config.ts',
  'lighthouserc.toilet-listing.cjs',
  'src/app/globals.css', 'src/app/layout.tsx',
  'src/proxy.ts', 'src/middleware.ts',
  '.github/workflows/homepage-quality.yml',
  'scripts/quality/homepage-scope.mjs',
  'scripts/quality/assert-lighthouse-toilet-median.mjs',
])

// A missing/indeterminate diff runs the full job instead of silently skipping.
export function needsHomepageChecks(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) return true
  return changedPaths.some((path) => {
    const normalized = path.replaceAll('\\', '/')
    return RELEVANT_FILES.has(normalized) ||
      RELEVANT_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
      normalized.startsWith('src/app/api/home') ||
      normalized.startsWith('scripts/quality/homepage-')
  })
}

export function readHomepageImpact({ eventName, baseSha }) {
  if (eventName !== 'pull_request') return true // manual runs keep full acceptance
  if (!/^[a-f0-9]{40}$/.test(baseSha || '')) return true
  try {
    execFileSync('git', ['fetch', '--quiet', '--no-tags', '--depth=1', 'origin', baseSha], { stdio: 'pipe' })
    const files = execFileSync(
      'git', ['diff', '--name-only', '--diff-filter=ACDMRT', '-z', baseSha, 'HEAD'],
      { encoding: 'utf8' },
    ).split('\\0').filter(Boolean)
    return needsHomepageChecks(files)
  } catch {
    return true
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const required = readHomepageImpact({
    eventName: process.env.GITHUB_EVENT_NAME,
    baseSha: process.env.BASE_SHA,
  })
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `homepage_required=${required}\n`)
  }
  console.log(`Homepage acceptance: ${required ? 'RUN' : 'SKIP_NONIMPACTING_DIFF'}`)
}
