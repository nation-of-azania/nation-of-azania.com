import config from '@payload-config'
import { getPayload } from 'payload'

import { syncTowns } from '@/lib/towns'

/**
 * Reads Azania's towns off the Rulercraft map (src/lib/towns.ts). Called once
 * a day by Vercel's scheduler for the census (vercel.json); anyone may call
 * it, since it reads the map at most every ten minutes however often it's
 * asked. With CRON_SECRET set, the scheduler's own call always reads.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const force = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
  const payload = await getPayload({ config })
  try {
    const result = await syncTowns(payload, { force })
    return Response.json(result, {
      status: result.status === 'offline' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Azania Maps: reading the Rulercraft map failed' })
    return Response.json({ status: 'failed', note: 'Reading the map failed.' }, { status: 500 })
  }
}
