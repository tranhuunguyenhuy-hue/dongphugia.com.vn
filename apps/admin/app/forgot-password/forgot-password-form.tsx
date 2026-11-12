'use client'

import { FormEvent, useState } from 'react'

import { createAdminBrowserClient } from '../../src/supabase/browser'
import { getAdminPath, isAdminAuthEnabled } from '../../src/config/env'

export function ForgotPasswordForm() {
  const authEnabled = isAdminAuthEnabled()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!authEnabled) return
    setPending(true)
    const supabase = createAdminBrowserClient()
    const callbackUrl = new URL(getAdminPath('/auth/callback'), window.location.origin)
    callbackUrl.searchParams.set('next', getAdminPath('/reset-password'))
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl.toString(),
    })
    setSubmitted(true)
    setPending(false)
  }

  return submitted ? (
    <p role="status">Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi.</p>
  ) : (
    <form onSubmit={submit}>
      {!authEnabled ? <p role="status">Khôi phục tài khoản bị tắt trong môi trường này để tránh thay đổi dữ liệu Auth của Production.</p> : null}
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={!authEnabled}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" disabled={!authEnabled || pending}>
        {pending ? 'Đang gửi…' : 'Gửi hướng dẫn'}
      </button>
    </form>
  )
}
