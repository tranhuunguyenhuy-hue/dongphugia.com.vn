'use client'

import { FormEvent, useState } from 'react'

import { createAdminBrowserClient } from '../../src/supabase/browser'

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const supabase = createAdminBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Đăng nhập không thành công. Kiểm tra thông tin hoặc liên hệ Admin.')
      setPending(false)
      return
    }
    window.location.assign(nextPath)
  }

  return (
    <form onSubmit={submit} autoComplete="on">
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Đang xác thực…' : 'Đăng nhập'}
      </button>
      <a href="/forgot-password">Quên mật khẩu?</a>
    </form>
  )
}
