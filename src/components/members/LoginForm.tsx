'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { cn } from '@/blocks/components/shared'

/**
 * The resident sign-in form. Username-only auth (the nation issues no email),
 * so we POST straight to Payload's REST login endpoint, which sets the
 * httpOnly `payload-token` cookie for us — the front end never handles the
 * token itself. On success we move into the resident area and refresh the
 * server components so they see the new session.
 */

const FIELD =
  'w-full border border-parchment-300 bg-parchment-50 px-3.5 py-2.5 text-ink-900 placeholder:text-ink-400 focus:border-gold-400 focus:outline-none'
const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500'

/** Only follow a `?next=` that is a same-site absolute path (no open redirects). */
function safeNext(): string {
  if (typeof window === 'undefined') return '/account'
  const raw = new URLSearchParams(window.location.search).get('next')
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/account'
}

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<null | string>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (!res.ok) {
        setError('That username and password did not match our records.')
        setPending(false)
        return
      }
      // Payload has set the session cookie; enter the register.
      router.push(safeNext())
      router.refresh()
    } catch {
      setError('Could not reach the register. Please try again in a moment.')
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error ? (
        <p role="alert" className="border border-oxide-600/40 bg-oxide-600/5 px-3.5 py-2.5 text-sm text-oxide-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className={LABEL}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'mt-1 inline-flex w-full items-center justify-center bg-pine-800 px-5 py-2.5 text-sm font-semibold tracking-wide text-parchment-50 transition-colors hover:bg-pine-700',
          pending && 'cursor-not-allowed opacity-70',
        )}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
