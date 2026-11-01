import config from '@payload-config'
import { after } from 'next/server'
import { getPayload, type Payload } from 'payload'

import { trackBattles } from '@/lib/battleTracker'
import { FRESH_MS, readMarkerFile } from '@/lib/dynmap'
import { watchMap } from '@/lib/watch'
import { warOf } from '@/lib/world'
import { sessionClock } from '@/maps/battle'

/**
 * The watch on the Rulercraft map (src/lib/watch.ts): Azania's towns kept up
 * to date and the siege alerts told. Called every five minutes by a GitHub
 * schedule (.github/workflows/watch.yml); anyone may call it, since it runs
 * at most every few minutes however often it's asked and tells each thing
 * once. With CRON_SECRET set, a call bearing it always runs.
 *
 * Most runs leave the database asleep (src/lib/quietWatch.ts); each logs
 * whether it asked the database, and why.
 *
 * Answers 200 while the Rulercraft map is down too (that isn't this site
 * failing, and the schedule would mail about it every five minutes); 500
 * only when the watch itself fails.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** The watch answers in seconds; during a battle the tracker reads on for most of the five minutes to the next ask. */
export const maxDuration = 300
/** The tracker stops reading this long after the ask, leaving time to save before maxDuration. */
const TRACK_FOR_MS = 280_000

/**
 * Payload, started on first need: its database adapter connects as it
 * starts, and a connection alone wakes the database, which a quiet run
 * (most runs) must leave asleep. Logs go to the console, which needs no
 * Payload.
 */
let started: Promise<Payload> | null = null
const payloadOf = (): Promise<Payload> => (started ??= getPayload({ config }))

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const force = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
  try {
    const askedAt = Date.now()
    const result = await watchMap(payloadOf, { force })
    // One line a run, so the logs say how often the database is woken, and why (src/lib/quietWatch.ts).
    console.info(`[watch] ${result.status}; database ${result.database ?? 'asked'}; battles ${result.battles ?? 0}; online ${result.online ?? '?'}`)
    // A battle on, or a session on with sieges on the map (the marker file, written about once a minute, can be behind
    // a battle's first minute; the live feed's own marker updates say it within seconds): after answering, read the map
    // for the battle tracker until the next ask (src/lib/battleTracker.ts).
    if (result.battles || (result.siegesOnMap && sessionClock(askedAt).on)) {
      const file = await readMarkerFile(FRESH_MS).catch(() => null)
      if (file) {
        const sieges = warOf(file).sieges
        after(async () => {
          const tracked = await trackBattles(payloadOf, sieges, askedAt + TRACK_FOR_MS).catch((error: unknown) => {
            console.error('[battles] the stint failed', error)
            return null
          })
          if (tracked) console.info(`[battles] ${tracked.status}; ${tracked.readings} readings; ${tracked.battles.join(', ') || 'none saved'}`)
        })
      }
    }
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[watch] the watch failed', error)
    return Response.json({ status: 'failed', note: 'The watch failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
