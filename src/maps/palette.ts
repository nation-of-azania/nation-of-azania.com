import type { Ink, PlaceGroup, RoadKind, Stance } from './registry'

/**
 * What Azania Maps draws with: the site's own tokens (src/app/(frontend)/globals.css),
 * restated as literal values because most of this is painted into SVG and
 * JPEG, where no stylesheet reaches. Everything that sits on the map's
 * terrain gets a halo, since Dynmap's ground runs from deep water to
 * savanna and no single colour reads on all of it.
 */

export const GROUND = {
  /** The map's backdrop where there is no tile: the sea off the chart's edge. */
  sea: '#0f2638',
  /** Whitewash: halos behind labels, the fill of a street. */
  whitewash: '#fbf8f1',
  sand: '#f5efe2',
  ink: '#16191f',
  inkSoft: '#353a44',
  /** The deep water of the brand, for claims and the primary marks. */
  sea800: '#14334b',
  sea700: '#1a4461',
  sea500: '#2c6b93',
  saffron: '#d8962c',
  saffronLight: '#e8b65c',
  saffronDeep: '#96600f',
  coral: '#bb4631',
  coralDeep: '#a63727',
  rose: '#b24070',
  roseLight: '#e58fb3',
  lagoon: '#198a98',
  lagoonLight: '#8acbd2',
  lagoonDeep: '#0d5d69',
} as const

/**
 * The inks a highlight is drawn in (INKS in ./registry.ts): each a fill and
 * the halo that keeps it legible over the terrain. The names are the
 * palette's, the values the site's: the seal's coral, the market's
 * saffron, the deep water, the cherry grove's rose.
 */
export const INK_COLOURS: Record<Ink, { fill: string; halo: string; label: string }> = {
  red: { fill: '#c9432b', halo: '#fbf8f1', label: 'Red' },
  gold: { fill: '#e0a12f', halo: '#16191f', label: 'Gold' },
  sea: { fill: '#2b6fa3', halo: '#fbf8f1', label: 'Sea' },
  green: { fill: '#3e8f52', halo: '#fbf8f1', label: 'Green' },
  rose: { fill: '#c8457f', halo: '#fbf8f1', label: 'Rose' },
  ink: { fill: '#16191f', halo: '#fbf8f1', label: 'Ink' },
  white: { fill: '#fbf8f1', halo: '#16191f', label: 'White' },
}

/**
 * A colour per group of places, for the pins: warm for food and shops,
 * civic in the deep sea, culture in a plum, transport in the lagoon,
 * outdoors in leaf green, industry in a quarry brown.
 */
export const GROUP_COLOURS: Record<PlaceGroup, string> = {
  food: '#c9612b',
  shopping: '#b2761a',
  stay: '#8a5a9c',
  civic: '#14334b',
  culture: '#8c2f5e',
  learning: '#2b6fa3',
  transport: '#198a98',
  outdoors: '#3e8f52',
  industry: '#6b5540',
  other: '#555c6a',
}

/**
 * How each class of road is drawn, Google-Maps-like: a casing under a fill,
 * widths in blocks at close zoom with a floor in pixels so a street never
 * vanishes, and a dash for the kinds that aren't paved.
 */
export type RoadStyle = {
  /** Width at 1 px per block; grows with zoom. */
  blocks: number
  /** Narrowest it is ever drawn, in px. */
  minPx: number
  maxPx: number
  fill: string
  casing: string | null
  /** A dash pattern on the fill, in multiples of the width. */
  dash?: [number, number]
  /** A second stroke laid over the fill, for a railway's sleepers. */
  over?: { colour: string; dash: [number, number] }
}

export const ROAD_STYLES: Record<RoadKind, RoadStyle> = {
  highway: {
    blocks: 7,
    minPx: 3.5,
    maxPx: 16,
    fill: GROUND.saffronLight,
    casing: GROUND.saffronDeep,
  },
  main: { blocks: 5, minPx: 2.5, maxPx: 13, fill: GROUND.whitewash, casing: '#6f7684' },
  street: { blocks: 4, minPx: 2, maxPx: 11, fill: GROUND.whitewash, casing: '#9aa0ab' },
  path: { blocks: 2, minPx: 1.5, maxPx: 6, fill: '#a98a5a', casing: null, dash: [2.5, 1.5] },
  rail: {
    blocks: 2.5,
    minPx: 2,
    maxPx: 8,
    fill: GROUND.inkSoft,
    casing: null,
    over: { colour: GROUND.whitewash, dash: [1.5, 1.5] },
  },
  iceroad: {
    blocks: 3,
    minPx: 2.5,
    maxPx: 10,
    fill: GROUND.lagoonLight,
    casing: GROUND.lagoon,
    dash: [3, 1],
  },
  canal: { blocks: 4, minPx: 2.5, maxPx: 12, fill: GROUND.sea500, casing: '#c3d3df' },
}

/** Roads draw in this order, so a national road lies over a path at a crossing. */
export const ROAD_ORDER: RoadKind[] = [
  'path',
  'canal',
  'iceroad',
  'rail',
  'street',
  'main',
  'highway',
]

/** A colour's hue, saturation and lightness, each 0–1; null for anything but #rgb or #rrggbb. */
function hslOf(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const full = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

const hsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A town of no nation: the grey of a map's unclaimed ground, and a dashed edge. */
export const NO_NATION = { line: '#7c828d', text: GROUND.inkSoft } as const

/**
 * The colours a nation's cultures and religions are charted in
 * (src/components/maps/panels/BeliefsChart.tsx): seven of the site's own
 * hues — its sea, saffron, coral, green, plum, rose and lagoon — each
 * lifted to a chroma that reads as a colour and set at a lightness that
 * tells it from every other under red–green colour-blindness as far as
 * seven can be, against the panels' sand. Checked, not eyeballed: every
 * pair clears the normal-vision floor, the closest (green and coral, for
 * a deuteranope) sits in the band a gap and a key make legal, and both
 * are drawn. A name is given one by its hash, so a religion is the same
 * colour in every nation's chart.
 */
export const BELIEF_COLOURS = ['#00519d', '#b6770b', '#953402', '#0d6f44', '#792d80', '#ca5a87', '#009eaf'] as const

/**
 * Another nation's colour as Azania Maps draws it. The Rulercraft map paints
 * a nation in a web colour (#FF0000, #FFFF00, #000000), which would shout
 * over the nation's own sea and saffron; the hue is kept, so a nation is
 * the colour its players know it by, but the saturation is reined in and
 * the lightness kept off the extremes, and its names are set in a dark
 * shade of it that reads over the whitewash halo. A white or a black
 * nation stays pale or dark.
 */
export function nationInk(colour: string | null | undefined): { line: string; text: string } {
  const parsed = colour ? hslOf(colour) : null
  if (!parsed) return NO_NATION
  const [h, s, l] = parsed
  if (s < 0.08) {
    return { line: hsl(0, 0, clamp(l, 0.18, 0.93)), text: l > 0.6 ? GROUND.inkSoft : hsl(0, 0, clamp(l, 0.12, 0.3)) }
  }
  return { line: hsl(h, Math.min(s, 0.72), clamp(l, 0.3, 0.6)), text: hsl(h, Math.min(s, 0.7), clamp(l * 0.6, 0.18, 0.3)) }
}

/**
 * Azania's diplomacy on the map (STANCES in ./registry.ts, and neutral for
 * every nation not named): a road from green to red through a quiet grey,
 * as a reader expects of friend and foe, kept clear of the nation's own
 * sea and saffron. `fill` is how strongly a nation is washed, so allies
 * and enemies stand out and the neutral recede; `text` is the dark shade
 * names are set in. A nation at war with Azania is also hatched.
 */
export const STANCE_COLOURS: Record<Stance | 'neutral', { line: string; text: string; fill: number }> = {
  ally: { line: '#2e8a55', text: '#1d5c38', fill: 0.26 },
  friendly: { line: '#78b06a', text: '#3d6b33', fill: 0.18 },
  neutral: { line: '#8d9199', text: '#4a505b', fill: 0.05 },
  tense: { line: '#c29a2e', text: '#6e5512', fill: 0.18 },
  hostile: { line: '#d2642c', text: '#8a3a12', fill: 0.22 },
  war: { line: '#b3261e', text: '#7d1712', fill: 0.18 },
}

/** Pixels per block at a map zoom: level 0 is 2 px per block. */
export const pixelsPerBlock = (zoom: number): number => 2 * 2 ** zoom

/** The zoom at which a block is this many pixels wide. */
export const zoomForPixelsPerBlock = (ppb: number): number => Math.log2(ppb / 2)
