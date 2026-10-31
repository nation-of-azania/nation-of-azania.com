import { CAPITAL_WAR_RADIUS } from '@/maps/world'

import { warReading } from './snapshot'

/**
 * The answer of /maps/war and /maps/war/live: the war as the map has it,
 * shared at the CDN for `everyS` (and `staleS` more while it's refreshed);
 * as last saved, marked `offline`, while the map is down; a 503 with
 * neither.
 */
export async function warResponse({ live, everyS, staleS }: { live: boolean; everyS: number; staleS: number }): Promise<Response> {
  const reading = await warReading({ live })
  if (!reading) {
    return Response.json(
      { at: Date.now(), sieges: [], capitals: [], radius: CAPITAL_WAR_RADIUS, offline: true },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
    )
  }
  if (reading.saved) {
    return Response.json(
      { ...reading.value, offline: true },
      { headers: { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'max-age=60, stale-if-error=86400' } },
    )
  }
  return Response.json(reading.value, {
    headers: {
      // The live answer is never kept by the browser: the CDN's copy is all the age it may have.
      'Cache-Control': live ? 'no-store' : 'public, max-age=60',
      'Vercel-CDN-Cache-Control': `max-age=${everyS}, stale-while-revalidate=${staleS}, stale-if-error=86400`,
      'X-Robots-Tag': 'noindex',
    },
  })
}
