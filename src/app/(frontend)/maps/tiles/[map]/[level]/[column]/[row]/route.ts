import { WORLD_LIMIT } from '@/maps/geo'
import { dynmapTileUrl, isMapName, MAPS, TILE_SIZE } from '@/maps/source'

/**
 * One Rulercraft map tile through the site's own cache, for Azania Maps:
 *
 *   /maps/tiles/flat/2/41/58.jpg   (map, Dynmap level, column, row)
 *
 * The Rulercraft map serves its tiles uncached and is down now and then, so
 * the CDN keeps each tile a day, refreshes it in the background for a month,
 * and keeps answering with the last good copy for a month while the map
 * errors (stale-if-error). Ground the map hasn't drawn comes back as an
 * empty transparent tile, cached, so the slippy map shows its own backdrop.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FETCH_TIMEOUT_MS = 6000

const CACHED = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=2592000, stale-if-error=2592000'

/** A 1×1 transparent PNG. */
const EMPTY = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
)

const empty = () =>
  new Response(EMPTY, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHED, 'X-Tile': 'unrendered' },
  })

const unavailable = (message: string) =>
  new Response(message, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' },
  })

const integer = (value: string) => (/^-?\d{1,7}$/.test(value) ? Number(value) : null)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ map: string; level: string; column: string; row: string }> },
) {
  const { map, level: levelParam, column: columnParam, row: rowParam } = await params
  const level = integer(levelParam)
  const column = integer(columnParam)
  const row = integer(rowParam.replace(/\.jpg$/, ''))
  if (!isMapName(map) || level == null || column == null || row == null) {
    return new Response('Not a map tile.', { status: 404 })
  }
  // Inside the world, at a level the map draws.
  const reach = Math.ceil((2 * WORLD_LIMIT + TILE_SIZE) / (TILE_SIZE * 2 ** level)) + 1
  if (level < 0 || level > MAPS[map].maxLevel || Math.abs(column) > reach || Math.abs(row) > reach) {
    return new Response('Not a map tile.', { status: 404 })
  }

  try {
    const response = await fetch(dynmapTileUrl(map, level, column, row), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (response.status === 404) return empty()
    if (!response.ok) return unavailable(`The Rulercraft map answered ${response.status}.`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    // Dynmap answers ground it hasn't drawn with a tiny placeholder.
    if (bytes.length <= 400) return empty()
    return new Response(bytes, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': CACHED,
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch {
    return unavailable('The Rulercraft map is not answering just now.')
  }
}
