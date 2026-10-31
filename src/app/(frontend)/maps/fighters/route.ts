import config from '@payload-config'
import { getPayload } from 'payload'

import { demoFighters, warDemo } from '@/lib/warDemo'
import { recordsOf, usualHours, type SavedBattle } from '@/maps/fighters'

/**
 * Every player's record in the battles the battle tracker read
 * (src/lib/battleTracker.ts, src/maps/fighters.ts), with their usual hours
 * online, for the war view and the players' panels:
 *
 *   { at, since, battles, players: [{ name, could, fought, minutes, stays, held, died, left, deaths, won, lost, …, hours }] }
 *
 * `hours` is 168 shares, one per hour of the week (UTC, Monday 00:00
 * first): of the days recorded, on how many they were online at that hour.
 * The last BATTLE_DAYS of battles and PRESENCE_DAYS of presence count.
 *
 * Counted from the database, so the CDN shares one copy among everyone for
 * a quarter of an hour, and the database is woken at most that often, and
 * only while someone is looking.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATTLE_DAYS = 60
const PRESENCE_DAYS = 28

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  const now = Date.now()
  // On one's own machine with the war demo on (src/lib/warDemo.ts): the demo's fighters, made up.
  if (warDemo()) {
    const players = await demoFighters(now)
    return Response.json({ at: now, since: new Date(now - BATTLE_DAYS * 86_400_000).toISOString(), battles: 12, days: 28, players, demo: true })
  }
  const payload = await getPayload({ config })
  try {
    const [battles, days] = await Promise.all([
      payload.find({
        collection: 'battles',
        where: { startedAt: { greater_than: new Date(now - BATTLE_DAYS * 86_400_000).toISOString() } },
        pagination: false,
        depth: 0,
        select: { startedAt: true, town: true, attacker: true, defender: true, coverage: true, result: true, sides: true, fighters: true },
      }),
      payload.find({
        collection: 'presence-days',
        where: { day: { greater_than_equal: new Date(now - PRESENCE_DAYS * 86_400_000).toISOString().slice(0, 10) } },
        pagination: false,
        depth: 0,
        select: { day: true, slots: true },
      }),
    ])
    const records = recordsOf(battles.docs as unknown as SavedBattle[])
    const hours = usualHours(days.docs.map((doc) => ({ day: doc.day, slots: (doc.slots ?? null) as Record<string, string> | null })))
    const names = new Set([...records.keys()])
    const players = [...names].map((key) => ({ ...records.get(key)!, hours: hours.get(key) ?? null }))
    // Everyone seen online but never near a battle is left out: their hours alone say little, and they'd be most of the server.
    return Response.json(
      { at: now, since: new Date(now - BATTLE_DAYS * 86_400_000).toISOString(), battles: battles.docs.length, days: days.docs.length, players },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
          'Vercel-CDN-Cache-Control': 'max-age=900, stale-while-revalidate=3600, stale-if-error=86400',
          'X-Robots-Tag': 'noindex',
        },
      },
    )
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Fighters: counting the records failed' })
    return Response.json({ error: 'The records couldn’t be counted.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
  }
}
