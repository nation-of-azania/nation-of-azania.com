import { WORLD_LIMIT } from '@/maps/geo'
import { dynmapTileUrl, isMapName, MAPS, TILE_SIZE } from '@/maps/source'

/**
 * One Rulercraft map tile through the site's own cache, for Azania Maps:
 *
 *   /maps/tiles/flat/2/41/58.jpg   (map, Dynmap level, column, row)
 *
 * The Rulercraft map serves its tiles uncached and is down now and then, so
 * the CDN keeps each tile: fresh for a quarter of an hour, then refreshed in
 * the background whenever someone looks (so nobody waits on the map), and
 * the last good copy goes on answering for a month while the map errors
 * (stale-if-error). Browsers keep a tile five minutes, then check back
 * cheaply by its ETag, so someone who comes back sees new building soon
 * after the Rulercraft map draws it. Ground the map hasn't drawn comes back
 * as an empty transparent tile, cached alike, so the slippy map shows its
 * own backdrop.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FETCH_TIMEOUT_MS = 6000

/** For browsers; the CDN follows its own header (Vercel-CDN-Cache-Control). */
const BROWSER = 'public, max-age=300'
const CDN = 'max-age=900, stale-while-revalidate=2592000, stale-if-error=2592000'
const CACHED = { 'Cache-Control': BROWSER, 'Vercel-CDN-Cache-Control': CDN }
/**
 * The coarsest levels, each tile hundreds of chunks across, barely change
 * from one hour to the next, and the live map fetches every level-5 tile
 * for the world beneath it (src/components/maps/leaflet/sheet.ts): kept
 * six hours at the CDN and one in the browser, so that costs the server
 * a few hundred reads a quarter of a day, not every quarter of an hour.
 */
const COARSE_FROM_LEVEL = 4
const COARSE = {
  'Cache-Control': 'public, max-age=3600',
  'Vercel-CDN-Cache-Control': 'max-age=21600, stale-while-revalidate=2592000, stale-if-error=2592000',
}

/** A 1×1 transparent PNG. */
const EMPTY = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
)

const empty = (cached: Record<string, string>) =>
  new Response(EMPTY, {
    headers: { 'Content-Type': 'image/png', ...cached, 'X-Tile': 'unrendered' },
  })

const unavailable = (message: string) =>
  new Response(message, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' },
  })

const validators = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {}
  const etag = response.headers.get('ETag')
  const modified = response.headers.get('Last-Modified')
  if (etag) headers.ETag = etag
  if (modified) headers['Last-Modified'] = modified
  return headers
}

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

  const cached = level >= COARSE_FROM_LEVEL ? COARSE : CACHED
  try {
    const response = await fetch(dynmapTileUrl(map, level, column, row), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (response.status === 404) return empty(cached)
    if (!response.ok) return unavailable(`The Rulercraft map answered ${response.status}.`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    // Dynmap answers ground it hasn't drawn with a tiny placeholder.
    if (bytes.length <= 400) return empty(cached)
    return new Response(bytes, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg',
        ...cached,
        // The map's own validators, so a browser's check comes back "not modified".
        ...validators(response),
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch {
    return unavailable('The Rulercraft map is not answering just now.')
  }
}
