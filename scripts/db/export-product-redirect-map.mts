import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

function readArg(prefix: string, fallback: string) {
  const arg = process.argv.slice(2).find(item => item.startsWith(prefix))
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

async function main() {
  const output = path.resolve(process.cwd(), readArg('--output=', 'src/data/product-redirect-map.json'))
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

  const map = Object.fromEntries(
    redirects
      .filter(row => row.old_url && row.new_url && (row.status_code ?? 301) >= 300 && (row.status_code ?? 301) < 400)
      .map(row => [normalizeRedirectPath(row.old_url), row.new_url])
  )

  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(map, null, 2)}\n`)
  console.log(`✅ Redirect map exported: ${Object.keys(map).length} entries → ${output}`)
}

main()
  .catch((error) => {
    console.error('❌ Failed to export redirect map:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })

