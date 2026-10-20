import config from '@payload-config'
import { getPayload } from 'payload'

import { dynmapTileUrl } from '@/maps/source'

/**
 * Whether the Rulercraft map is answering, and when Azania Maps last read
 * it, so the map can tell readers it's showing saved pictures:
 *
 *   { online: false, checkedAt: "…", townsReadAt: "…" }
 *
 * Asks the map for one small tile; the answer is cached for a minute.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const online = await fetch(dynmapTileUrl('flat', 5, 0, 0), {
    method: 'HEAD',
    signal: AbortSignal.timeout(3000),
    cache: 'no-store',
  })
    .then((response) => response.ok || response.status === 404)
    .catch(() => false)
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'towns',
    where: { azanian: { equals: true } },
    sort: '-syncedAt',
    limit: 1,
    depth: 0,
    select: { syncedAt: true },
  })
  return Response.json(
    { online, checkedAt: new Date().toISOString(), townsReadAt: docs[0]?.syncedAt ?? null },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' } },
  )
}
