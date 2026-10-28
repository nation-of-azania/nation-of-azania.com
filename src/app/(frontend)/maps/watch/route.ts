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
    return Response.json(await watchMap(payload, { force }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Azania Maps: the watch failed' })
    return Response.json({ status: 'failed', note: 'The watch failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
