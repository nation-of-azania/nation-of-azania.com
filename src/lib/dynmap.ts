import sharp from 'sharp'

/**
 * The Rulercraft server's Dynmap (map.rulercraft.com): map clippings and
 * Towny towns, for the Map block. Dynmap publishes what it has rendered, not
 * the world itself: tiles are JPEG pictures drawn by the plugin (colours, no
 * block data), and the marker file carries Towny's towns with their claims,
 * home block and a few facts. Live player positions are published too; the
 * site never uses them.
 *
 * Flat map projection (perspective iso_S_90, scale 2): block (x, z) is pixel
 * (2x, 2z + 128) at zoom level 0, north up; each zoom-out level halves that.
 * Tiles are 128 px. A level-n tile is named after its north-west level-0
 * tile: `tiles/<world>/<prefix>/<x>>5>_<y>>5>/<"z"×n + "_">?<x>_<y>.jpg`,
 * where x = column·2ⁿ and y = −(row·2ⁿ).
 */

export const DYNMAP_URL = 'https://map.rulercraft.com'
export const DYNMAP_WORLD = 'RulerEarth'

export const MAPS = {
  flat: { label: 'Map', prefix: 'flat', dynmapName: 'flat', maxLevel: 5 },
  biomes: { label: 'Biomes', prefix: 'biomes', dynmapName: 'Biomes', maxLevel: 4 },
} as const
export type MapName = keyof typeof MAPS

/** How much a clipping shows: tile level, and how many screen pixels per tile pixel. */
export const ZOOMS = {
  close: { label: 'Close (≈150 blocks across)', level: 0, upscale: 4 },
  street: { label: 'Street (≈300 blocks)', level: 0, upscale: 2 },
  town: { label: 'Town (≈600 blocks)', level: 0, upscale: 1 },
  district: { label: 'District (≈1,200 blocks)', level: 1, upscale: 1 },
  region: { label: 'Region (≈5,000 blocks)', level: 3, upscale: 1 },
  country: { label: 'Country (≈20,000 blocks)', level: 5, upscale: 1 },
} as const
export type ZoomName = keyof typeof ZOOMS

export const ASPECTS = {
  wide: { label: 'Wide (16:9)', width: 1200, height: 675 },
  square: { label: 'Square', width: 1200, height: 1200 },
  banner: { label: 'Banner (3:1)', width: 1200, height: 400 },
} as const
export type AspectName = keyof typeof ASPECTS

const TILE = 128
const FETCH_TIMEOUT_MS = 4000
/** The colour Dynmap leaves where nothing is rendered (deep water reads close to it). */
const UNRENDERED = { r: 24, g: 39, b: 56 }

export const isMapName = (value: unknown): value is MapName => typeof value === 'string' && value in MAPS
export const isZoomName = (value: unknown): value is ZoomName => typeof value === 'string' && value in ZOOMS
export const isAspectName = (value: unknown): value is AspectName =>
  typeof value === 'string' && value in ASPECTS

/** The live map, centred on a block, at roughly the clipping's zoom. */
export function liveMapUrl({ x, z, zoom = 'town', map = 'flat' }: { x: number; z: number; zoom?: ZoomName; map?: MapName }) {
  // Dynmap's own zoom counts inwards from the widest view.
  const dynmapZoom = Math.max(0, MAPS[map].maxLevel + 2 - ZOOMS[zoom].level - Math.log2(ZOOMS[zoom].upscale))
  const query = new URLSearchParams({
    worldname: DYNMAP_WORLD,
    mapname: MAPS[map].dynmapName,
    zoom: String(Math.round(dynmapZoom)),
    x: String(Math.round(x)),
    y: '64',
    z: String(Math.round(z)),
  })
  return `${DYNMAP_URL}/?${query}`
}

/** A block's position in level-n map pixels. */
const toPixels = (x: number, z: number, level: number) => ({
  px: (2 * x) / 2 ** level,
  py: (2 * z + TILE) / 2 ** level,
})

const tileUrl = (map: MapName, level: number, column: number, row: number) => {
  const scale = 2 ** level
  const x = column * scale
  const y = -row * scale
  const zoomPrefix = level > 0 ? `${'z'.repeat(level)}_` : ''
  return `${DYNMAP_URL}/tiles/${DYNMAP_WORLD}/${MAPS[map].prefix}/${x >> 5}_${y >> 5}/${zoomPrefix}${x}_${y}.jpg`
}

async function fetchTile(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Tiles change as the world is re-rendered; a day old is fine for an article.
      next: { revalidate: 86400 },
    })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    // Dynmap answers missing tiles with a tiny placeholder; treat those as unrendered.
    return bytes.length > 400 ? bytes : null
  } catch {
    return null
  }
}

/** Runs `work` over `items`, `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await work(items[index])
      }
    }),
  )
  return results
}

export type Outline = { x: number[]; z: number[] }

export type ClipOptions = {
  x: number
  z: number
  zoom: ZoomName
  map: MapName
  aspect: AspectName
  /** Claims to draw, in block coordinates (Towny areas). */
  outlines?: Outline[]
  /** A pin on the centre. */
  pin?: boolean
  /** Hex colour for outlines and pin. */
  colour?: string
}

/**
 * Stitches the tiles around a block into one JPEG, with claims outlined and
 * a pin. Returns whether every tile arrived, so callers can cache a partial
 * clipping only briefly.
 */
export async function renderClip(options: ClipOptions): Promise<{ image: Buffer; complete: boolean }> {
  const { x, z, map, outlines = [], pin = false } = options
  const zoom = ZOOMS[options.zoom]
  const level = Math.min(zoom.level, MAPS[map].maxLevel)
  const upscale = zoom.upscale * 2 ** (zoom.level - level) // a map with fewer levels upscales instead
  const { width, height } = ASPECTS[options.aspect]
  const colour = /^#[0-9a-f]{6}$/i.test(options.colour ?? '') ? options.colour! : '#ff5fa2'

  // The window in level-n pixels.
  const { px, py } = toPixels(x, z, level)
  const w = Math.ceil(width / upscale)
  const h = Math.ceil(height / upscale)
  const left = Math.round(px - w / 2)
  const top = Math.round(py - h / 2)
  const columns = { from: Math.floor(left / TILE), to: Math.floor((left + w - 1) / TILE) }
  const rows = { from: Math.floor(top / TILE), to: Math.floor((top + h - 1) / TILE) }

  const tiles: { column: number; row: number }[] = []
  for (let row = rows.from; row <= rows.to; row++) {
    for (let column = columns.from; column <= columns.to; column++) tiles.push({ column, row })
  }
  const images = await pool(tiles, 16, ({ column, row }) => fetchTile(tileUrl(map, level, column, row)))
  const complete = images.every(Boolean)

  const canvasWidth = (columns.to - columns.from + 1) * TILE
  const canvasHeight = (rows.to - rows.from + 1) * TILE
  const mosaic = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 3, background: UNRENDERED },
  })
    .composite(
      tiles.flatMap(({ column, row }, index) => {
        const input = images[index]
        return input
          ? [{ input, left: (column - columns.from) * TILE, top: (row - rows.from) * TILE }]
          : []
      }),
    )
    .png()
    .toBuffer()

  let clip = sharp(mosaic).extract({
    left: left - columns.from * TILE,
    top: top - rows.from * TILE,
    width: w,
    height: h,
  })
  if (upscale > 1) clip = clip.resize(w * upscale, h * upscale, { kernel: sharp.kernel.nearest })
  const base = await sharp(await clip.png().toBuffer())
    .extract({ left: 0, top: 0, width, height })
    .png()
    .toBuffer()

  // Overlay, drawn at output resolution: claims, then the pin.
  const toOutput = (bx: number, bz: number) => {
    const point = toPixels(bx, bz, level)
    return [((point.px - left) * upscale).toFixed(1), ((point.py - top) * upscale).toFixed(1)].join(',')
  }
  const stroke = Math.max(2, Math.min(4, 1 + upscale))
  const polygons = outlines
    .filter((outline) => outline.x.length > 2 && outline.x.length === outline.z.length)
    .map(
      (outline) =>
        `<polygon points="${outline.x.map((bx, i) => toOutput(bx, outline.z[i])).join(' ')}" fill="${colour}" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.85" stroke-width="${stroke + 3}" stroke-linejoin="round"/>` +
        `<polygon points="${outline.x.map((bx, i) => toOutput(bx, outline.z[i])).join(' ')}" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linejoin="round"/>`,
    )
    .join('')
  const [cx, cy] = toOutput(x, z).split(',').map(Number)
  const pinSvg = pin
    ? `<circle cx="${cx}" cy="${cy}" r="11" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="7" fill="${colour}"/>`
    : ''
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${polygons}${pinSvg}</svg>`,
  )

  const image = await sharp(base)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
  return { image, complete }
}

// ── Towny ───────────────────────────────────────────────────────────────────

export type Town = {
  name: string
  home: { x: number; y: number; z: number } | null
  outlines: Outline[]
  ruler: string | null
  residents: string[]
  nation: string | null
  culture: string | null
  founded: string | null
}

const TOWNY_TTL_MS = 60 * 60 * 1000
let townyCache: { at: number; towns: Map<string, Town> } | null = null

type MarkerFile = {
  sets?: Record<
    string,
    {
      markers?: Record<string, { label?: string; x?: number; y?: number; z?: number }>
      areas?: Record<string, { label?: string; desc?: string; x?: number[]; z?: number[] }>
    }
  >
}

/** "Ruler: | Name" style facts out of Towny's info-window HTML. */
function townFacts(desc: string) {
  const text = desc
    .replace(/<[^>]+>/g, '|')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
  const cells = text
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean)
  const after = (pattern: RegExp) => {
    const index = cells.findIndex((cell) => pattern.test(cell))
    return index >= 0 ? (cells[index + 1] ?? null) : null
  }
  const nation = after(/^🎌/)
  const residentsCell = cells.findIndex((cell) => /Residents:/.test(cell))
  const residents =
    residentsCell >= 0
      ? (cells[residentsCell + 2] ?? '')
          .split(',')
          .map((name) => name.trim())
          .filter((name) => /^\.?\w{3,16}$/.test(name))
      : []
  const culture = cells.find((cell) => /Culture -/.test(cell))?.split('Culture -')[1]?.trim() || null
  return {
    ruler: after(/Ruler:/),
    residents,
    nation: nation && !/^No Nation$/i.test(nation) ? nation : null,
    culture,
    founded: after(/Founded:/),
  }
}

/** Every Towny town on the map, by lower-cased name; cached for an hour. */
export async function getTowns(): Promise<Map<string, Town>> {
  if (townyCache && Date.now() - townyCache.at < TOWNY_TTL_MS) return townyCache.towns
  const towns = new Map<string, Town>()
  try {
    // About 5 MB: too big for Next's data cache, so it's kept in memory instead.
    const response = await fetch(`${DYNMAP_URL}/tiles/_markers_/marker_${DYNMAP_WORLD}.json`, {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    const file = (await response.json()) as MarkerFile
    const set = file.sets?.['towny.markerset']
    for (const area of Object.values(set?.areas ?? {})) {
      const name = area.label?.trim()
      if (!name || !area.x || !area.z) continue
      const key = name.toLowerCase()
      const town = towns.get(key) ?? {
        name,
        home: null,
        outlines: [],
        ...townFacts(area.desc ?? ''),
      }
      town.outlines.push({ x: area.x, z: area.z })
      towns.set(key, town)
    }
    for (const [id, marker] of Object.entries(set?.markers ?? {})) {
      if (!id.endsWith('__home')) continue
      const town = towns.get((marker.label ?? '').trim().toLowerCase())
      if (town && marker.x != null && marker.z != null) {
        town.home = { x: marker.x, y: marker.y ?? 64, z: marker.z }
      }
    }
    townyCache = { at: Date.now(), towns }
  } catch {
    // Keep serving the last good copy if the map is down.
    if (townyCache) return townyCache.towns
  }
  return towns
}

/** A Towny town by name (case-insensitive), or null. */
export async function getTown(name: string | null | undefined): Promise<Town | null> {
  if (!name?.trim()) return null
  return (await getTowns()).get(name.trim().toLowerCase()) ?? null
}

/** The centre of a town: its home block, else the middle of its claims. */
export function townCentre(town: Town): { x: number; z: number } | null {
  if (town.home) return { x: town.home.x, z: town.home.z }
  const xs = town.outlines.flatMap((outline) => outline.x)
  const zs = town.outlines.flatMap((outline) => outline.z)
  if (xs.length === 0) return null
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}
