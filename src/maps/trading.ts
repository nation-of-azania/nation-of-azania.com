import type { Point } from './geo'
import { ICONS } from './icons'
import { GROUND, NO_NATION } from './palette'
import type { TownKind } from './registry'
import type { WorldKind } from './world'

/**
 * The server's own places as Azania Maps shows them: its trading outposts,
 * and its landmarks beside them. Towny holds them all in the server's spawn
 * town, which the world's reading splits into its places, each named by the
 * server's own marker (src/lib/world.ts → spawnPlaces). Neither is a town
 * nor a site: nobody holds one, no siege can take it, and Azania never
 * could, so they are world-only (WorldKind, never TownKind) and have their
 * own words, glyphs and inks here, apart from the sites' (./sites.ts); the
 * mark is drawn by src/components/maps/layers/TradingMark.tsx and the
 * panel by src/components/maps/panels/TradingPanel.tsx. Pure, and shared
 * by the map, the panels, the search and the page's metadata, so a trading
 * outpost is the same trading outpost everywhere.
 */

/** A trading outpost ('trading') or one of the server's landmarks ('landmark'). */
export type ServerKind = Exclude<WorldKind, TownKind>

export const isServerKind = (kind: WorldKind): kind is ServerKind => kind === 'trading' || kind === 'landmark'

/** What each is called, on its own and in the plural: what players call them, not what Towny does. */
export const SERVER_WORDS: Record<ServerKind, { label: string; plural: string }> = {
  trading: { label: 'Trading outpost', plural: 'Trading outposts' },
  landmark: { label: 'Landmark', plural: 'Landmarks' },
}

/**
 * The marks, drawn like the sites' and the places' (./sites.ts,
 * ./icons.tsx): the same 24 grid and 2-unit stroke. A trading outpost's is
 * two arrows passing each other, goods going one way and payment the
 * other; a landmark's is the places' own star, filled.
 */
export const SERVER_GLYPHS: Record<ServerKind, { d: string; fill: boolean }> = {
  trading: { d: 'M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4', fill: false },
  landmark: { d: ICONS.landmark.d, fill: true },
}

/**
 * How each is drawn. A trading outpost in the lagoon, clear of Azania's sea
 * and saffron and of the war's coral, and told from a nation that happens
 * to be teal by its shape and its dotted edge: a solid mark with the glyph
 * in whitewash, its claim edged in dots, its name in the lagoon's deep. A
 * landmark quieter, in the grey of ground nobody holds: a whitewash mark
 * with a grey rim and the star in ink.
 */
export const SERVER_INKS: Record<ServerKind, { mark: string; rim: string; glyph: string; text: string; edge: string }> = {
  trading: {
    mark: GROUND.lagoon,
    rim: GROUND.whitewash,
    glyph: GROUND.whitewash,
    text: GROUND.lagoonDeep,
    edge: GROUND.lagoon,
  },
  landmark: {
    mark: GROUND.whitewash,
    rim: NO_NATION.line,
    glyph: GROUND.inkSoft,
    text: GROUND.inkSoft,
    edge: NO_NATION.line,
  },
}

/**
 * Where a trading outpost stands, by the server's own name for it: "…
 * Trading Ship" at sea, "… Trading Outpost" on land. Null when the name
 * doesn't say: a claim no marker names is called a plain "Trading outpost".
 */
export function tradingSetting(name: string): 'sea' | 'land' | null {
  if (/\btrading ship$/i.test(name.trim())) return 'sea'
  if (/\S\s+trading outpost$/i.test(name.trim())) return 'land'
  return null
}

const SETTING_WORDS = { sea: 'a ship at sea', land: 'on land' } as const

type ServerPlace = { kind: ServerKind; name: string }

/**
 * The line under a name in a list: "Trading outpost · a ship at sea",
 * "Landmark · the server’s own". A trading outpost no marker names is told
 * from the other by where it stands, as the survey line has it:
 * "Trading outpost · X 8528, Z -8712".
 */
export function serverLine(place: ServerPlace & { home?: Point | null }): string {
  if (place.kind === 'landmark') return `${SERVER_WORDS.landmark.label} · the server’s own`
  const setting = tradingSetting(place.name)
  if (setting) return `${SERVER_WORDS.trading.label} · ${SETTING_WORDS[setting]}`
  const at = place.home?.map(Math.round)
  return at ? `${SERVER_WORDS.trading.label} · X ${at[0]}, Z ${at[1]}` : SERVER_WORDS.trading.label
}

/**
 * What it is, a sentence a line, in order of what matters to a player:
 * for a trading outpost, the trade first and the portals second; for
 * either, that it is nobody's to take.
 */
export function serverAbout(kind: ServerKind): string[] {
  const unheld = 'Nobody holds it, and no siege can take it.'
  if (kind === 'landmark') return ['One of the server’s own landmarks, marked on the map by the server itself.', unheld]
  return [
    'A place to trade items with the server, at prices the server sets.',
    'It is also where new players coming through the portals can choose to arrive.',
    unheld,
  ]
}

/** The page's description: "Sahara Trading Outpost on Azania Maps: one of the server’s trading outposts, …". */
export function serverSummary(place: ServerPlace): string {
  const name = place.name
  if (place.kind === 'landmark') {
    return `${name} on Azania Maps: one of the Rulercraft server’s landmarks. Nobody holds it, and no siege can take it.`
  }
  const setting = tradingSetting(name)
  return `${name} on Azania Maps: one of the Rulercraft server’s trading outposts${setting ? `, ${SETTING_WORDS[setting]}` : ''}, where players trade items with the server at its prices, and new players can arrive through the portals. Nobody holds it, and no siege can take it.`
}

/**
 * What a search matches besides the name: the kind as players say it, and
 * for a trading outpost the old name of the spawn town that holds them,
 * since new players arrive there.
 */
export const SERVER_SEARCH: Record<ServerKind, string> = {
  trading: 'trading outpost trade trading ship rulerspawn',
  landmark: 'landmark',
}
