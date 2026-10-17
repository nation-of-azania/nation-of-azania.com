'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Clears the Payload session cookie via the REST logout endpoint, then returns
 * the resident to the sign-in screen. We navigate regardless of the request's
 * outcome — a failed logout should never strand someone on a page they can no
 * longer trust.
 */
export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    if (pending) return
    setPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // Fall through — we still send them to the login screen.
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="border border-gold-400/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-200 transition-colors hover:border-gold-300 hover:text-gold-100 disabled:opacity-60"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
