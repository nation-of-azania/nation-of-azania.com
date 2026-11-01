import config from '@payload-config'
import { getPayload } from 'payload'

import { knownAlliances } from '@/lib/alliances'
import { demoAlliances, warDemo } from '@/lib/warDemo'

/**
 * The alliances known (src/maps/alliances.ts), on their own, for a nation's
 * panel on the map: `{ at, alliances: [{ nations, sources, seen?, note? }] }`.
 * Azania's diplomacy, the diplomats' list of other nations' alliances, and
 * those the battles of the last three weeks show. The war view has them
 * with the fighters' records (/maps/fighters), fresher; this is for
 * looking at a nation in peacetime, so the CDN keeps it six hours and
 * serves it stale a day while it asks again: the database is woken for it
 * at most a few times a day. Alliances change slowly (a nation forming or
 * ending one is locked for six days after).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  const now = Date.now()
  // On one's own machine with the war demo on (src/lib/warDemo.ts): the demo's alliances, made up.
  if (warDemo()) return Response.json({ at: now, alliances: await demoAlliances(), demo: true })
  const payload = await getPayload({ config })
  try {
    const alliances = await knownAlliances(payload, now)
    return Response.json(
      { at: now, alliances },
      {
        headers: {
          'Cache-Control': 'public, max-age=1800',
          'Vercel-CDN-Cache-Control': 'max-age=21600, stale-while-revalidate=86400, stale-if-error=86400',
          'X-Robots-Tag': 'noindex',
        },
      },
    )
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Alliances: reading them failed' })
    return Response.json({ error: 'The alliances couldn’t be read.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
  }
}
