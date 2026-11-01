import { readNote } from '@/lib/quietWatch'
import { dynmapTileUrl } from '@/maps/source'

/**
 * Whether the Rulercraft map is answering, and when Azania Maps last read
 * it, so the map can tell readers it's showing saved pictures:
 *
 *   { online: false, checkedAt: "…", townsReadAt: "…" }
 *
 * Asks the map for one small tile, and the watch's note in the runtime cache
 * (src/lib/quietWatch.ts) for when it last read the map and found Azania's
 * towns as they were or brought them up to date; the database isn't asked,
 * so a map left open doesn't keep it awake. Every open map asks every five
 * minutes, so the CDN shares one answer among them for four.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [online, note] = await Promise.all([
    fetch(dynmapTileUrl('flat', 5, 0, 0), {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
      .then((response) => response.ok || response.status === 404)
      .catch(() => false),
    readNote(),
  ])
  return Response.json(
    { online, checkedAt: new Date().toISOString(), townsReadAt: note?.seenAt ? new Date(note.seenAt).toISOString() : null },
    {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Vercel-CDN-Cache-Control': 'max-age=240, stale-while-revalidate=600',
      },
    },
  )
}
