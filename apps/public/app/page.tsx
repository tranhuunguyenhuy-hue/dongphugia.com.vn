import { APPLICATIONS } from '@dpg/app-contracts'

export const runtime = 'edge'
export const revalidate = 300

export default function PublicFoundationPage() {
  return (
    <main data-application={APPLICATIONS.public.name} data-route-owner="public">
      <h1>Dong Phu Gia Public Application</h1>
      <p>This is the New Production public application foundation.</p>
    </main>
  )
}
