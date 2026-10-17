'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Auth-aware entry point to the resident area, for the site navs. Shows a
 * "Sign in" link (→ /login) for visitors and the resident's name (→ /account)
 * once signed in.
 *
 * The session is checked on the CLIENT via Payload's /api/users/me so the
 * surrounding pages stay statically cacheable — reading the cookie on the server
 * would force every page that renders a nav to become dynamic. The signed-out
 * label is the initial (server-rendered) state, so hydration matches for the
 * common anonymous case; a signed-in visitor sees it resolve to their name.
 */
export function AccountLink({ className }: { className?: string }) {
  const [name, setName] = useState<null | string>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/users/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const user = data?.user as { name?: string; username?: string } | null | undefined
        if (user) setName(user.name ?? user.username ?? 'My Register')
      })
      .catch(() => {
        // Stay on the signed-out affordance if the check fails.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return name ? (
    <Link href="/account" className={className}>
      {name}
    </Link>
  ) : (
    <Link href="/login" className={className}>
      Sign in
    </Link>
  )
}
