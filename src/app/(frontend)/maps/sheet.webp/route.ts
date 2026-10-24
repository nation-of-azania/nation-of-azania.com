import { unstable_cache } from 'next/cache'
import sharp from 'sharp'

import {
  SHEET_COLUMNS,
  SHEET_HEIGHT,
  SHEET_LEVEL,
  SHEET_ROWS,
  SHEET_TILE_PX,
  SHEET_WIDTH,
  sheetRowTop,
} from '@/maps/sheet'
import { dynmapTileUrl } from '@/maps/source'

/**
 * The whole world as one picture, for the live map to lay under its tiles
 * (src/maps/sheet.ts, src/components/maps/leaflet/sheet.ts): the flat
 * map's 684 coarsest tiles, each drawn at half its size into one WebP of
 * some 150–200 KB, cut at the poles where the void beyond them begins
 * (src/maps/source.ts), 2304 by 1152. The browser used to fetch the tiles
 * one by one, 2.5 MB in 684 requests, three quarters of all a visit to
 * the map downloaded.
 *
 * Those tiles cover hundreds of chunks each and barely change in an hour,
 * so the CDN keeps the sheet six hours, then makes it afresh in the
 * background whenever someone looks, and goes on serving the last good one
 * for a month while the Rulercraft map is down. A sheet with a few tiles
 * missing is served too, transparent where they'd be, but kept only ten
 * minutes; with many missing it isn't made at all, and the browser falls
 * back on the tiles themselves.
 *
 * A deploy empties the CDN, and making the sheet takes some five seconds,
 * so a whole sheet is also kept in Next's data cache, which outlives a
 * deploy: the first reader after one gets it at once.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Tiles fetched at once, and how long each may take. */
const AT_ONCE = 24
const FETCH_TIMEOUT_MS = 8000
/** The share of tiles that may fail before the sheet isn't worth making. */
const MOST_MISSING = 0.1
/** How long a sheet made here is served again from memory before it's asked for afresh, in ms. */
const KEEP_MS = 60 * 60 * 1000
/** How long the data cache keeps a whole sheet before making it again in the background, in seconds. */
const STORE_S = 6 * 60 * 60

const WHOLE = {
  'Cache-Control': 'public, max-age=3600',
  'Vercel-CDN-Cache-Control': 'max-age=21600, stale-while-revalidate=2592000, stale-if-error=2592000',
}
const PATCHY = {
  'Cache-Control': 'public, max-age=300',
  'Vercel-CDN-Cache-Control': 'max-age=600, stale-if-error=2592000',
}

type Sheet = { at: number; picture: Uint8Array; missing: number }

let last: Sheet | null = null
let making: Promise<Sheet | null> | null = null

/** The sheet, made from the Rulercraft map's tiles; null if too many of them didn't come. */
async function make(): Promise<Sheet | null> {
  const jobs: [number, number][] = []
  for (let row = SHEET_ROWS.from; row <= SHEET_ROWS.to; row++)
    for (let column = SHEET_COLUMNS.from; column <= SHEET_COLUMNS.to; column++) jobs.push([column, row])

  // Transparent to begin with: ground the map hasn't drawn stays so, and the backdrop shows there.
  const pixels = Buffer.alloc(SHEET_WIDTH * SHEET_HEIGHT * 4)
  const rowBytes = SHEET_TILE_PX * 4
  let missing = 0
  let next = 0
  const work = async () => {
    while (next < jobs.length) {
      const [column, row] = jobs[next++]
      try {
        const response = await fetch(dynmapTileUrl('flat', SHEET_LEVEL, column, row), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          cache: 'no-store',
          headers: { 'User-Agent': 'AzaniaMaps (+https://nation-of-azania.vercel.app/maps)' },
        })
        // Ground the map hasn't drawn: a 404, or Dynmap's tiny placeholder.
        if (response.status === 404) continue
        if (!response.ok) {
          missing++
          continue
        }
        const bytes = Buffer.from(await response.arrayBuffer())
        if (bytes.length <= 400) continue
        const tile = await sharp(bytes).resize(SHEET_TILE_PX, SHEET_TILE_PX).ensureAlpha().raw().toBuffer()
        const left = (column - SHEET_COLUMNS.from) * SHEET_TILE_PX
        const top = sheetRowTop(row)
        // The first and last rows reach past the poles, into the void: only what's on the sheet is copied.
        for (let y = Math.max(0, -top); y < Math.min(SHEET_TILE_PX, SHEET_HEIGHT - top); y++)
          tile.copy(pixels, ((top + y) * SHEET_WIDTH + left) * 4, y * rowBytes, (y + 1) * rowBytes)
      } catch {
        missing++
      }
    }
  }
  await Promise.all(Array.from({ length: AT_ONCE }, work))
  if (missing > jobs.length * MOST_MISSING) return null
  const picture = await sharp(pixels, { raw: { width: SHEET_WIDTH, height: SHEET_HEIGHT, channels: 4 } })
    .webp({ quality: 75, effort: 4 })
    .toBuffer()
  return { at: Date.now(), picture: new Uint8Array(picture), missing }
}

/** A sheet that wasn't whole: handed back for now, never kept. */
class Unkept extends Error {
  constructor(readonly sheet: Sheet | null) {
    super('The sheet was not whole.')
  }
}

/** A whole sheet, as the data cache keeps it (as text: it keeps JSON). */
const stored = unstable_cache(
  async (): Promise<{ at: number; picture: string }> => {
    const sheet = await make()
    if (!sheet || sheet.missing) throw new Unkept(sheet)
    return { at: sheet.at, picture: Buffer.from(sheet.picture).toString('base64') }
  },
  // Named for its extent: a sheet kept from before it was cut at the poles is never handed out for one that is.
  ['maps-sheet-1152'],
  { revalidate: STORE_S },
)

async function read(): Promise<Sheet | null> {
  try {
    const { at, picture } = await stored()
    return { at, picture: new Uint8Array(Buffer.from(picture, 'base64')), missing: 0 }
  } catch (error) {
    return error instanceof Unkept ? error.sheet : null
  }
}

export async function GET(request: Request) {
  // One address, so every viewer shares the CDN's copy; a query would only get around it.
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  if (!last || Date.now() - last.at > KEEP_MS) {
    making ??= read()
      .finally(() => {
        making = null
      })
    const made = await making
    if (made) last = made
  }
  if (!last) {
    return new Response('The Rulercraft map is not answering just now.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' },
    })
  }
  return new Response(last.picture, {
    headers: {
      'Content-Type': 'image/webp',
      ...(last.missing ? PATCHY : WHOLE),
      'X-Sheet-Missing': String(last.missing),
      'X-Robots-Tag': 'noindex',
    },
  })
}
