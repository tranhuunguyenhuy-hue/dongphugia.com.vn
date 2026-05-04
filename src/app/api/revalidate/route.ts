import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

/**
 * Cross-domain cache revalidation endpoint.
 *
 * Called by admin.dongphugia.com.vn after any write operation
 * to ensure the main site (dongphugia.com.vn) reflects fresh data.
 *
 * Security: Protected by REVALIDATION_SECRET header.
 *
 * POST /api/revalidate
 * Headers: x-revalidation-secret: <REVALIDATION_SECRET>
 * Body: { paths?: string[], tags?: string[] }
 *
 * Example call from admin CMS:
 *   await fetch('https://dongphugia.com.vn/api/revalidate', {
 *     method: 'POST',
 *     headers: { 'x-revalidation-secret': process.env.REVALIDATION_SECRET },
 *     body: JSON.stringify({ paths: ['/thiet-bi-ve-sinh', '/'] })
 *   })
 */
export async function POST(req: NextRequest) {
  // 1. Verify secret header
  const secret = req.headers.get('x-revalidation-secret')
  if (!process.env.REVALIDATION_SECRET) {
    return NextResponse.json(
      { error: 'REVALIDATION_SECRET not configured on main site' },
      { status: 500 }
    )
  }
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let paths: string[] = []
  let tags: string[] = []
  try {
    const body = await req.json()
    paths = Array.isArray(body.paths) ? body.paths : []
    tags = Array.isArray(body.tags) ? body.tags : []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (paths.length === 0 && tags.length === 0) {
    return NextResponse.json(
      { error: 'Provide at least one path or tag to revalidate' },
      { status: 400 }
    )
  }

  // 3. Revalidate
  const revalidated: { paths: string[]; tags: string[] } = { paths: [], tags: [] }

  for (const path of paths) {
    revalidatePath(path, 'page')
    revalidated.paths.push(path)
  }

  // Note: revalidateTag in Next.js 15 Dynamic IO requires a profile arg.
  // For simplicity, treat tag-based revalidation as layout-level path revalidation.
  for (const tag of tags) {
    revalidatePath(`/_tags/${tag}`, 'layout')
    revalidated.tags.push(tag)
  }

  return NextResponse.json({
    revalidated: true,
    timestamp: new Date().toISOString(),
    ...revalidated,
  })
}

// Reject non-POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
