import { APPLICATIONS } from '@dpg/app-contracts'

import { ResetPasswordForm } from './reset-password-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  return (
    <main data-application={APPLICATIONS.admin.name} data-route-owner="admin">
      <h1>Đặt mật khẩu mới</h1>
      <p>Liên kết hợp lệ từ Supabase Auth sẽ tạo phiên tạm để hoàn tất bước này.</p>
      <ResetPasswordForm />
    </main>
  )
}
