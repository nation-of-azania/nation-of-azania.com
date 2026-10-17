import { type NextRequest, NextResponse } from 'next/server'

/**
 * Keeps residents out of the dark Payload admin *gracefully*: a signed-in
 * resident who lands on /admin is redirected to their branded register instead
 * of seeing Payload's plain "unauthorized" page. Staff and unauthenticated
 * requests pass through untouched (the latter so Payload's own login and
 * create-first-user flows keep working).
 *
 * This is UX routing, NOT the security boundary. It reads the role from the
 * session JWT WITHOUT verifying the signature — cheap and edge-safe. The real
 * gate is `Users.access.admin` (editors/admins only), which Payload enforces
 * server-side with a verified token, so a forged/edited cookie still cannot
 * reach the admin panel; at worst it changes where we redirect.
 */

const SESSION_COOKIE = 'payload-token'

/** Decode a base64url segment to a UTF-8 string (edge-safe, no Buffer). */
function decodeSegment(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

/** Best-effort role claim from the session token; null if absent/unreadable. */
function roleFromToken(token: string | undefined): null | string {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const claims = JSON.parse(decodeSegment(parts[1])) as { role?: unknown }
    return typeof claims.role === 'string' ? claims.role : null
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const role = roleFromToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (role === 'resident') {
    const url = request.nextUrl.clone()
    url.pathname = '/account'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // Only guard the admin panel's own page routes. /api and framework assets are
  // untouched, so login/logout and the front end are unaffected.
  matcher: ['/admin', '/admin/:path*'],
}
