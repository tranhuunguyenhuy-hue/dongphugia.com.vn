import { APPLICATIONS } from '@dpg/app-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function AdminLoginFoundationPage() {
  return (
    <main data-application={APPLICATIONS.admin.name} data-route-owner="admin">
      <h1>Admin sign-in shell</h1>
      <p>Supabase Auth lifecycle is owned by LEO-564.</p>
    </main>
  )
}
