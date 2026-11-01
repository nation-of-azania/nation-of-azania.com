/**
 * Who is signed in, for the site's navs and Azania Maps' drawing rights:
 * `{ user }` as Payload's /api/users/me gives it, or `{ user: null }`.
 *
 * Asked by every page a visitor opens, so it must cost next to nothing for
 * the visitor who isn't signed in, which is nearly all of them: without
 * Payload's session cookie the answer is null at once, and Payload (which
 * connects to the database as it starts, and so wakes it) isn't started.
 * Only with the cookie is the session checked, by Payload, as /api/users/me
 * would. Vercel's free plan meters the functions' CPU and Neon's the
 * database's (CLAUDE.md).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRIVATE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  if (!/(?:^|;\s*)payload-token=/.test(cookie)) return Response.json({ user: null }, { headers: PRIVATE })
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  return Response.json({ user: user ?? null }, { headers: PRIVATE })
}
