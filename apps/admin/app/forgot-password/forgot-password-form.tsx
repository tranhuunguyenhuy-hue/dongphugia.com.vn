'use client'

import { FormEvent, useState } from 'react'

import { createAdminBrowserClient } from '../../src/supabase/browser'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const supabase = createAdminBrowserClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setSubmitted(true)
    setPending(false)
  }

  return submitted ? (
    <p role="status">Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi.</p>
  ) : (
    <form onSubmit={submit}>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Đang gửi…' : 'Gửi hướng dẫn'}
      </button>
    </form>
  )
}
