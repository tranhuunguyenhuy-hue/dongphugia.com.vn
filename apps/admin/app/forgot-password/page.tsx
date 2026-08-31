import { APPLICATIONS } from '@dpg/app-contracts'

import { ForgotPasswordForm } from './forgot-password-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  return (
    <main data-application={APPLICATIONS.admin.name} data-route-owner="admin">
      <h1>Đặt lại mật khẩu</h1>
      <p>Nhập email nhân sự đã được cấp quyền. Phản hồi không tiết lộ email có tồn tại hay không.</p>
      <ForgotPasswordForm />
      <a href="/login">Quay lại đăng nhập</a>
    </main>
  )
}
