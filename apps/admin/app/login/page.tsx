import { APPLICATIONS } from '@dpg/app-contracts'

import { LoginForm } from './login-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminLoginFoundationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next
  const nextPath = nextValue?.startsWith('/') && !nextValue.startsWith('//') ? nextValue : '/'

  return (
    <main data-application={APPLICATIONS.admin.name} data-route-owner="admin">
      <h1>Admin sign-in shell</h1>
      <p>Đăng nhập dành cho nhân sự đã được cấp quyền trong V1.</p>
      <LoginForm nextPath={nextPath} />
    </main>
  )
}
