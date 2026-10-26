import { relationWith, type AbroadNation } from '@/maps/abroad'
import type { Relation } from '@/maps/data'
import { GROUND, nationInk, NO_NATION, STANCE_COLOURS } from '@/maps/palette'
import { NUMBER } from '@/maps/raster'
import { SERVER_INKS } from '@/maps/trading'

/**
 * The globe's inks, by nation number (src/maps/raster.ts), as the bytes its
 * shader reads: three rows of 256, four bytes a number. Row 0 holds the
 * edge's colour and how strongly the ground is washed; row 1 the edge's
 * strength and whether the number shows at all; row 2 the wash's colour.
 * The same inks as the flat map's (src/components/maps/layers/AbroadLayer.tsx):
 * each nation in its own colour tempered (nationInk), or with the diplomacy
 * layer on in where Azania stands with it; the towns of no nation in grey;
 * the server's places in the lagoon; Azania in its saffron, edged boldly.
 * Turning a layer or the diplomacy on and off rewrites these few bytes and
 * nothing else.
 */

export const PALETTE_BYTES = 256 * 3 * 4

const clampTo = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * A colour as three bytes, for the globe's shaders, which take their
 * palette as bytes. Reads the forms the map's palette (src/maps/palette.ts)
 * writes, #rgb, #rrggbb and nationInk's comma-less `hsl(H S% L%)`, which
 * three.js's own colour parser passes over; black for anything else. Here
 * rather than with the palette, so it loads with the globe.
 */
export function rgbOf(css: string): [number, number, number] {
  const text = css.trim()
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
  }
  const match = /^hsla?\(\s*([-\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(text)
  if (!match) return [0, 0, 0]
  const h = (((Number(match[1]) % 360) + 360) % 360) / 360
  const s = clampTo(Number(match[2]) / 100, 0, 1)
  const l = clampTo(Number(match[3]) / 100, 0, 1)
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255)) as [number, number, number]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255)) as [number, number, number]
}


type Ink = { line: string; lineAlpha: number; wash: string; washAlpha: number }

/** How Azania itself is drawn on the globe: a saffron edge round a light saffron wash. */
const AZANIA: Ink = { line: GROUND.saffron, lineAlpha: 1, wash: GROUND.saffronLight, washAlpha: 0.35 }

/** The ink a nation's name is set in, as its edge is drawn: its own colour's dark shade, or its stance's. */
export function nameInk(name: string, colour: string | null, relations: Relation[] | null): string {
  if (!relations) return nationInk(colour).text
  const stance = relationWith(name, relations)?.stance ?? 'neutral'
  return STANCE_COLOURS[stance].text
}

export function paletteBytes({
  nations,
  showWorld,
  relations,
}: {
  /** The nations by their numbers, as the numbers drawn were painted (src/maps/raster.ts → Numbers). */
  nations: (AbroadNation | null)[]
  /** The world layer, or the diplomacy, which shows the world as well. */
  showWorld: boolean
  /** Azania's relations, when the diplomacy layer is on. */
  relations: Relation[] | null
}): Uint8Array {
  const bytes = new Uint8Array(PALETTE_BYTES)
  const put = (number: number, ink: Ink, shown: boolean) => {
    const line = rgbOf(ink.line)
    const wash = rgbOf(ink.wash)
    bytes.set([...line, Math.round(ink.washAlpha * 255)], number * 4)
    bytes.set([Math.round(ink.lineAlpha * 255), shown ? 255 : 0, 0, 0], (256 + number) * 4)
    bytes.set([...wash, 255], (512 + number) * 4)
  }
  const nation = (name: string, colour: string | null): Ink => {
    if (!relations) {
      const line = nationInk(colour).line
      return { line, lineAlpha: 0.9, wash: line, washAlpha: 0.1 }
    }
    const stance = STANCE_COLOURS[relationWith(name, relations)?.stance ?? 'neutral']
    return { line: stance.line, lineAlpha: 0.9, wash: stance.line, washAlpha: stance.fill }
  }
  put(NUMBER.azania, AZANIA, true)
  const stateless = relations ? STANCE_COLOURS.neutral.line : NO_NATION.line
  put(NUMBER.stateless, { line: stateless, lineAlpha: 0.7, wash: stateless, washAlpha: 0.06 }, showWorld)
  put(NUMBER.server, { line: SERVER_INKS.trading.edge, lineAlpha: 0.8, wash: SERVER_INKS.trading.edge, washAlpha: 0.12 }, showWorld)
  for (let number = NUMBER.first; number < NUMBER.past; number++) {
    const each = nations[number]
    if (each) put(number, nation(each.name, each.colour), showWorld)
  }
  put(NUMBER.past, nation('', null), showWorld)
  return bytes
}
