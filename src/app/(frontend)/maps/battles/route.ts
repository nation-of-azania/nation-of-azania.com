import config from '@payload-config'
import { getPayload } from 'payload'

import { demoBattles, warDemo } from '@/lib/warDemo'
import type { Mark } from '@/maps/fights'

/**
 * The battles the battle tracker read in the last fortnight
 * (src/lib/battleTracker.ts), for the war view's story of a siege: each
 * session's result and how its points went, a point a minute.
 *
 *   { at, battles: [{ townId, town, attacker, defender, startedAt, session, coverage, fought, result, points: [[minute, attacker, defender, banner]] }] }
 *
 * `session` is the sessions the siege had fought before this one;
 * `result` the marker's last word (the points the balance moved by);
 * `banner` in `points` is 'a', 'd' or '' for who held it. Counted from the
 * database, so the CDN shares one copy among everyone for five minutes,
 * and the database is woken at most that often, and only while someone
 * looks.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAYS = 14

/** The marks thinned to the last of each minute. */
function byMinute(marks: Mark[]): [number, number, number, string][] {
  const minutes = new Map<number, Mark>()
  for (const mark of marks) minutes.set(Math.floor(mark.t / 60), mark)
  return [...minutes].sort(([a], [b]) => a - b).map(([minute, mark]) => [minute, mark.attacker, mark.defender, mark.banner === 'attackers' ? 'a' : mark.banner === 'defenders' ? 'd' : ''])
}

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  const now = Date.now()
  // On one's own machine with the war demo on (src/lib/warDemo.ts): the demo siege's sessions, made up.
  if (warDemo()) return Response.json({ at: now, battles: await demoBattles(now), demo: true })
  const payload = await getPayload({ config })
  try {
    const { docs } = await payload.find({
      collection: 'battles',
      where: { startedAt: { greater_than: new Date(now - DAYS * 86_400_000).toISOString() } },
      pagination: false,
      depth: 0,
      sort: 'startedAt',
      select: { townId: true, town: true, attacker: true, defender: true, startedAt: true, session: true, coverage: true, fought: true, result: true, track: true },
    })
    const battles = docs.map((doc) => {
      const marks = ((doc.track as { marks?: Mark[] } | null)?.marks ?? []) as Mark[]
      return {
        townId: doc.townId,
        town: doc.town,
        attacker: doc.attacker,
        defender: doc.defender,
        startedAt: doc.startedAt,
        session: doc.session,
        coverage: doc.coverage,
        fought: doc.fought,
        result: doc.result,
        points: byMinute(marks),
      }
    })
    return Response.json(
      { at: now, battles },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'Vercel-CDN-Cache-Control': 'max-age=300, stale-while-revalidate=1800, stale-if-error=86400',
          'X-Robots-Tag': 'noindex',
        },
      },
    )
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Battles: reading them failed' })
    return Response.json({ error: 'The battles couldn’t be read.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
  }
}
