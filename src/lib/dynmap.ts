import sharp from 'sharp'

import type { Point } from '../maps/geo'
import type { TownKind } from '../maps/registry'
import type { RoadStyle } from '../maps/palette'
import { DYNMAP_URL, DYNMAP_WORLD, dynmapTileUrl, MAPS, type MapName } from '../maps/source'

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

export { DYNMAP_URL, DYNMAP_WORLD, isMapName, MAPS, type MapName } from '../maps/source'

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

/** A tile's bytes; `unrendered` where the map has drawn nothing, `failed` when it didn't answer. */
type Tile = Buffer | 'unrendered' | 'failed'

async function fetchTile(url: string): Promise<Tile> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Tiles change as the world is re-rendered; a day old is fine for an article.
      next: { revalidate: 86400 },
    })
    if (response.status === 404) return 'unrendered'
    if (!response.ok) return 'failed'
    const bytes = Buffer.from(await response.arrayBuffer())
    // Dynmap answers missing tiles with a tiny placeholder; treat those as unrendered.
    return bytes.length > 400 ? bytes : 'unrendered'
  } catch {
    return 'failed'
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

/** A road to draw over the ground, in the style the map gives its class (src/maps/palette.ts). */
export type ClipCourse = RoadStyle & {
  points: Point[]
  /** A colour to ring the road in, wider than its casing: the map's way of picking one out. */
  halo?: string | null
}

/**
 * A pin: a disc in a colour, with the map's glyph for a category in
 * whitewash (src/maps/icons.tsx). A held site's mark is the same disc in
 * whitewash, rimmed in gold, its glyph in the site's ink (src/maps/sites.ts).
 */
export type ClipMark = {
  x: number
  z: number
  colour: string
  /** The disc's radius in px; the map's pins are 12. */
  radius?: number
  glyph?: { d: string; fill?: boolean } | null
  /** The disc's rim; whitewash unless given. */
  ring?: string
  /** The glyph's colour: its fill when filled (the facets stay whitewash), its stroke otherwise; whitewash unless given. */
  ink?: string
}

export type ClipOptions = {
  x: number
  z: number
  /** One of the Map block's zooms; or give `span` for an exact frame. */
  zoom?: ZoomName
  /** Blocks across the clipping (a map view's frame): the tiles are picked and scaled to fit. */
  span?: number
  map: MapName
  aspect: AspectName
  /** The picture's size in px; the aspect's own (1,200 wide) unless a card wants another. */
  size?: { width: number; height: number }
  /** Claims to draw, in block coordinates (Towny areas). */
  outlines?: Outline[]
  /** Roads to draw over the claims, as the map draws them. */
  courses?: ClipCourse[]
  /** Pins to set over everything else. */
  marks?: ClipMark[]
  /** A pin on the centre. */
  pin?: boolean
  /** Hex colour for outlines and pin. */
  colour?: string
}

export type Clip = {
  image: Buffer
  /** Whether every tile arrived, so a caller can cache a partial clipping only briefly. */
  complete: boolean
  /** Whether the map answered nothing at all: the picture is bare ground, and the caller may say so. */
  offline: boolean
  /** The block at the picture's north-west corner, and the pixels a block takes: the projection used. */
  origin: Point
  ppb: number
}

/** The picture's size in px. */
const sizeOf = (options: ClipOptions) => options.size ?? ASPECTS[options.aspect]

/**
 * The tile level a clipping is drawn from, and how much each tile pixel is
 * scaled to fill the output: a named zoom's level and integer upscale, or
 * for a span in blocks the finest level that still has at least a tile
 * pixel per output pixel (so the map is never blurred up), scaled to fit.
 * A map with fewer levels upscales a coarser one instead.
 */
function clipScale(options: ClipOptions): { level: number; scale: number } {
  const maxLevel = MAPS[options.map].maxLevel
  if (options.span) {
    const ppb = sizeOf(options).width / options.span
    const level = Math.min(maxLevel, Math.max(0, Math.floor(Math.log2(2 / ppb))))
    return { level, scale: ppb / (2 / 2 ** level) }
  }
  const zoom = ZOOMS[options.zoom ?? 'town']
  const level = Math.min(zoom.level, maxLevel)
  return { level, scale: zoom.upscale * 2 ** (zoom.level - level) }
}

/**
 * Stitches the tiles around a block into one JPEG, with claims outlined,
 * roads drawn, and pins. Says whether every tile arrived, so callers can
 * cache a partial clipping only briefly, and whether the map answered at
 * all, so they can say so rather than show bare ground as if it were sea.
 */
export async function renderClip(options: ClipOptions): Promise<Clip> {
  const { x, z, map, outlines = [], courses = [], marks = [], pin = false } = options
  const { level, scale: upscale } = clipScale(options)
  const { width, height } = sizeOf(options)
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
  const images = await pool(tiles, 16, ({ column, row }) => fetchTile(dynmapTileUrl(map, level, column, row)))
  const complete = images.every((tile) => tile !== 'failed')
  const offline = images.some((tile) => tile === 'failed') && images.every((tile) => !Buffer.isBuffer(tile))

  const canvasWidth = (columns.to - columns.from + 1) * TILE
  const canvasHeight = (rows.to - rows.from + 1) * TILE
  const mosaic = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 3, background: UNRENDERED },
  })
    .composite(
      tiles.flatMap(({ column, row }, index) => {
        const input = images[index]
        return Buffer.isBuffer(input)
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
  // Blocks stay crisp when scaled up; a coarser level is smoothed when scaled down.
  if (upscale !== 1) {
    clip = clip.resize(width, height, {
      fit: 'fill',
      kernel: upscale > 1 ? sharp.kernel.nearest : sharp.kernel.lanczos3,
    })
  }
  const base = await sharp(await clip.png().toBuffer())
    .extract({ left: 0, top: 0, width, height })
    .png()
    .toBuffer()

  // Overlay, drawn at output resolution: claims, roads, marks, then the pin.
  const ppb = (upscale * 2) / 2 ** level
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
  // Roads as the map draws them (src/components/maps/layers/RoadsLayer.tsx): every casing, then every fill.
  const roadWidth = (course: ClipCourse) => Math.min(course.maxPx, Math.max(course.minPx, course.blocks * ppb))
  const pathOf = (points: Point[]) => points.map(([bx, bz]) => toOutput(bx, bz)).join(' ')
  const casings = courses.flatMap((course) => {
    const w = roadWidth(course)
    const ring = (colour: string, extra: number) =>
      `<polyline points="${pathOf(course.points)}" fill="none" stroke="${colour}" stroke-width="${(w + extra).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`
    return [...(course.halo ? [ring(course.halo, 6)] : []), ...(course.casing ? [ring(course.casing, 2)] : [])]
  })
  const fills = courses.map((course) => {
    const w = roadWidth(course)
    const dash = course.dash ? ` stroke-dasharray="${course.dash.map((n) => (n * w).toFixed(1)).join(' ')}"` : ''
    const over = course.over
      ? `<polyline points="${pathOf(course.points)}" fill="none" stroke="${course.over.colour}" stroke-width="${(w * 0.45).toFixed(1)}" stroke-dasharray="${course.over.dash.map((n) => (n * w).toFixed(1)).join(' ')}"/>`
      : ''
    return (
      `<polyline points="${pathOf(course.points)}" fill="none" stroke="${course.fill}" stroke-width="${w.toFixed(1)}" stroke-linecap="${course.dash ? 'butt' : 'round'}" stroke-linejoin="round"${dash}/>` +
      over
    )
  })
  // Pins as the map draws them (PlacePin): a disc ringed in whitewash, the glyph inside on its 24 grid.
  const pins = marks.map((mark) => {
    const [mx, my] = toOutput(mark.x, mark.z).split(',').map(Number)
    const r = mark.radius ?? 12
    const s = r / 12
    const ink = mark.ink ?? '#fbf8f1'
    const glyph = mark.glyph
      ? `<g transform="translate(${(mx - 7 * s).toFixed(1)} ${(my - 7 * s).toFixed(1)}) scale(${((14 / 24) * s).toFixed(3)})"><path d="${mark.glyph.d}" fill="${mark.glyph.fill ? ink : 'none'}" stroke="${mark.glyph.fill ? '#fbf8f1' : ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : ''
    return `<circle cx="${mx}" cy="${my}" r="${r}" fill="${mark.colour}" stroke="${mark.ring ?? '#fbf8f1'}" stroke-width="${((mark.ring ? 2 : 1.5) * s).toFixed(1)}"/>${glyph}`
  })
  const [cx, cy] = toOutput(x, z).split(',').map(Number)
  const pinSvg = pin
    ? `<circle cx="${cx}" cy="${cy}" r="11" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="7" fill="${colour}"/>`
    : ''
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${polygons}${casings.join('')}${fills.join('')}${pins.join('')}${pinSvg}</svg>`,
  )

  const image = await sharp(base)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
  return {
    image,
    complete,
    offline,
    origin: [(left * 2 ** level) / 2, (top * 2 ** level - TILE) / 2],
    ppb,
  }
}

// ── Towny ───────────────────────────────────────────────────────────────────

export type Town = {
  /** Towny's own id for the town, which survives renames; null if the map doesn't say. */
  id: string | null
  /** A players' town, or a site the server runs (src/maps/registry.ts → TOWN_KINDS). */
  kind: TownKind
  /** A server site's own words on the map, e.g. "Diamond Production Site, 333$ income per day. …". */
  siteNote: string | null
  /** What a server site pays its holder, in $ a day. */
  income: number | null
  /** What a quarry produces: "Diamond", "Iron", … */
  resource: string | null
  name: string
  home: { x: number; y: number; z: number } | null
  outlines: Outline[]
  ruler: string | null
  residents: string[]
  nation: string | null
  culture: string | null
  founded: string | null
  /** Whether anyone may `/t spawn` to the town (Towny's "Public Teleport"); null if the map doesn't say. */
  publicSpawn: boolean | null
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
/**
 * Whether a town is one the server runs, and what it pays. Their rulers are
 * the server's own bots (Ruler1, Ruler2, …), and the line where a players'
 * town shows its religion carries the site's terms instead:
 *
 *   "Diamond Production Site, 333$ income per day. Conquer for passive income. …"
 *   "Free natural resources for nation members, plus 160$ income per day. …"
 *   "500$ passive income per day. Conquerable by nations in the Americas, …"
 */
function siteOf(name: string, cells: string[], ruler: string | null) {
  if (!ruler || !/^Ruler\d+$/.test(ruler)) return { kind: 'town' as const, siteNote: null, income: null, resource: null }
  const siteNote = cells.find((cell) => cell.startsWith('🛐'))?.slice(2).trim() || null
  const kind: TownKind = /quarry/i.test(name)
    ? 'quarry'
    : /wasteland/i.test(name)
      ? 'wasteland'
      : /treasure.?ship/i.test(name)
        ? 'ship'
        : 'site'
  const income = /([\d,]+)\s*\$\s*(?:passive\s+)?income per day/i.exec(siteNote ?? '')?.[1]
  return {
    kind,
    siteNote,
    income: income ? Number(income.replace(/,/g, '')) : null,
    resource: /^(\w+) Production Site/i.exec(siteNote ?? '')?.[1] ?? null,
  }
}

function townFacts(name: string, desc: string) {
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
  const id = cells.map((cell) => /^ID\s+([0-9a-f-]{36})$/i.exec(cell)?.[1]).find(Boolean) ?? null
  const teleport = after(/Public Teleport:/)
  const ruler = after(/Ruler:/)
  return {
    id,
    ...siteOf(name, cells, ruler),
    ruler,
    residents,
    nation: nation && !/^No Nation$/i.test(nation) ? nation : null,
    culture,
    founded: after(/Founded:/),
    publicSpawn: teleport == null ? null : /^enabled$/i.test(teleport),
  }
}

/**
 * Every Towny town on the map, by lower-cased name; cached for an hour
 * (`fresh` reads the map regardless). Null when the map can't be read and
 * there is no cached copy to answer from, so a caller can tell "no such
 * town" from "the map is down".
 */
export async function getTowns({ fresh = false }: { fresh?: boolean } = {}): Promise<Map<string, Town> | null> {
  if (!fresh && townyCache && Date.now() - townyCache.at < TOWNY_TTL_MS) return townyCache.towns
  const towns = new Map<string, Town>()
  try {
    // About 5 MB: too big for Next's data cache, so it's kept in memory instead.
    const response = await fetch(`${DYNMAP_URL}/tiles/_markers_/marker_${DYNMAP_WORLD}.json`, {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`The map answered ${response.status}`)
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
        ...townFacts(name, area.desc ?? ''),
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
    // Keep serving the last good copy if the map is down, unless asked for a fresh one.
    return fresh ? null : (townyCache?.towns ?? null)
  }
  return towns
}

/**
 * A Towny town by name (case-insensitive): the town; `null` when the map
 * knows no such town; `'offline'` when the map can't be read and nothing is
 * cached, so the caller can say so rather than "no such town".
 */
export async function getTown(name: string | null | undefined): Promise<Town | null | 'offline'> {
  if (!name?.trim()) return null
  const towns = await getTowns()
  if (!towns) return 'offline'
  return towns.get(name.trim().toLowerCase()) ?? null
}

/** The centre of a town: its home block, else the middle of its claims. */
export function townCentre(town: Town): { x: number; z: number } | null {
  if (town.home) return { x: town.home.x, z: town.home.z }
  const xs = town.outlines.flatMap((outline) => outline.x)
  const zs = town.outlines.flatMap((outline) => outline.z)
  if (xs.length === 0) return null
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}
