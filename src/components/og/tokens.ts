import type { Design } from '@/contexts/designs'
import type { StyleId } from '@/contexts/styles'

/**
 * What the link-preview cards (./index.tsx) draw with. Satori renders the
 * cards off the DOM, where no stylesheet reaches, so the design tokens of
 * src/app/(frontend)/globals.css are restated here as literal values. Keep
 * the two in step: a colour changed there is changed here.
 */

/** Font families, by the names the card fonts are registered under (src/app/(frontend)/og/fonts). */
export const FACE = {
  /** The Gazette's display serif. */
  alegreya: 'Alegreya',
  /** The Times' grotesque: Bold for names, Black for headlines and the nameplate. */
  archivo: 'Archivo',
  /** The body and label face of the Gazette and the Times. */
  sourceSans: 'Source Sans 3',
  /** The registry's record serif (Medium). */
  plexSerif: 'IBM Plex Serif',
  /** The registry's mono, for numbers, dates and labels. */
  plexMono: 'IBM Plex Mono',
  /** Cherry Blossom's bubbly face: Medium, SemiBold, Bold. */
  fredoka: 'Fredoka',
} as const

export const COLOR = {
  // Ground: whitewash and coral-stone sand.
  sand50: '#fbf8f1',
  sand100: '#f5efe2',
  sand200: '#ebe2cd',
  sand300: '#d6c9ab',
  // Text: squid ink.
  ink900: '#16191f',
  ink700: '#353a44',
  ink500: '#555c6a',
  ink400: '#666e7d',
  // Primary: the deep water off Founders' Point.
  sea950: '#0a1b2a',
  sea900: '#0f2638',
  sea800: '#14334b',
  sea700: '#1a4461',
  // Accent: saffron.
  saffron600: '#96600f',
  saffron400: '#d8962c',
  saffron300: '#e8b65c',
  saffron200: '#f2d59a',
  // Seal: reef coral.
  coral700: '#a63727',
  coral600: '#bb4631',
  // The Azanian Times: cinnabar and lagoon on newsprint.
  cinnabar900: '#47130a',
  cinnabar800: '#772012',
  cinnabar700: '#962c17',
  cinnabar300: '#eb9b86',
  cinnabar200: '#f5cdc2',
  cinnabar100: '#fbe9e3',
  lagoon500: '#198a98',
  news50: '#faf9f6',
  news100: '#f2f0eb',
  news200: '#e3dfd6',
  news300: '#cdc7ba',
  news500: '#6b6862',
  news700: '#3b3935',
  news900: '#141311',
  // International: registry paper, graphite, verdigris, and the slate accent slots.
  paper50: '#f8f8f5',
  paper100: '#f1f1ed',
  paper200: '#e4e4de',
  paper300: '#cfcfc6',
  graphite900: '#1b1e22',
  graphite700: '#3a3f46',
  graphite500: '#5c636d',
  verdigris800: '#224b45',
  verdigris700: '#2b5f57',
  verdigris600: '#357166',
  verdigris100: '#e6f0ed',
  slate: '#4a5566',
  slateWash: '#edeef0',
  // Cherry Blossom: GirlieTown's roses, petals and cherry planks.
  blossom900: '#5a1a3a',
  blossom800: '#7d2353',
  blossom700: '#9b2f5e',
  blossom600: '#b24070',
  blossom400: '#e58fb3',
  blossom300: '#f2b4cb',
  blossom200: '#f8d3e0',
  blossom100: '#fbe7ee',
  blossomPlank: '#f7e9e5',
} as const

/**
 * The colour a design is known by: what Discord paints down the side of an
 * embed (`theme-color`). The Gazette's sea, the Times' cinnabar, the
 * registry's verdigris.
 */
export const DESIGN_THEME: Record<Design, string> = {
  gazette: COLOR.sea800,
  times: COLOR.cinnabar800,
  international: COLOR.verdigris700,
}

/** A style's own colour, taking the design's place on anything it dresses. */
export const STYLE_THEME: Record<StyleId, string> = {
  blossom: COLOR.blossom600,
}

export const themeColorOf = (design: Design, style: StyleId | null): string =>
  (style && STYLE_THEME[style]) || DESIGN_THEME[design]

/** The size of every card, in px: what Open Graph consumers expect. */
export const CARD = { width: 1200, height: 630 } as const

/**
 * The byline head's size on a card. A Minecraft head is 8×8 skin pixels, so
 * 64 lands each on 8 whole pixels, and the skin service is asked for exactly
 * this size, so nothing is resampled on the way.
 */
export const HEAD_PX = 64

/** The panel a featured image fills, by design; the loader crops to it so nothing is cropped twice. */
export const PICTURE: Record<Design, { width: number; height: number }> = {
  gazette: { width: 384, height: 434 },
  times: { width: 420, height: 372 },
  international: { width: 348, height: 418 },
}

/** The map on an Azania Maps card (./maps.tsx): drawn at exactly this size by renderClip, so nothing is scaled. */
export const MAP_PICTURE = { width: 760, height: 555 } as const
