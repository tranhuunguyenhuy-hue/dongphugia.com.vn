'use client'

import { FormEvent, useState } from 'react'

import { createAdminBrowserClient } from '../../src/supabase/browser'

export function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 12 || password !== confirmation) {
      setError('Mật khẩu phải dài tối thiểu 12 ký tự và khớp xác nhận.')
      return
    }
    setPending(true)
    const supabase = createAdminBrowserClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn.')
      setPending(false)
      return
    }
    window.location.assign('/')
  }

  return (
    <form onSubmit={submit}>
      <label>
        Mật khẩu mới
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Xác nhận mật khẩu
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
      </button>
    </form>
  )
}
