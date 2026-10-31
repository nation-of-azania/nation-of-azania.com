import config from '@payload-config'
import { getPayload } from 'payload'

import { watchMap } from '@/lib/watch'

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
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const force = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
  const payload = await getPayload({ config })
  try {
    const result = await watchMap(payload, { force })
    // One line a run, so the logs say how often the database is woken, and why (src/lib/quietWatch.ts).
    payload.logger.info(`[watch] ${result.status}; database ${result.database ?? 'asked'}`)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Azania Maps: the watch failed' })
    return Response.json({ status: 'failed', note: 'The watch failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
