import { APPLICATIONS } from '@dpg/app-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function AdminFoundationPage() {
  return (
    <main data-application={APPLICATIONS.admin.name} data-route-owner="admin">
      <h1>Dong Phu Gia Admin Application</h1>
      <p>This is the New Production private application foundation.</p>
    </main>
  )
}
