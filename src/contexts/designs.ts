/**
 * Designs and article types. Code, not content: each design is a complete
 * look (chrome, landing page, article page) built in
 * src/components/designs/<design>, and each has its own article types. Every
 * top-level context picks a design; everything below it inherits that design.
 *
 * Adding a design: add it here, build its views (src/components/designs/types.ts
 * says which), and add them to DESIGN_VIEWS in src/components/designs/index.ts.
 */

export const DESIGNS = {
  gazette: {
    label: 'Gazette: the Government of Azania',
    types: ['dispatch', 'decree', 'statement', 'explanation', 'notice'],
  },
  times: {
    label: 'Times: newspaper',
    types: ['news', 'feature', 'analysis', 'opinion'],
  },
  international: {
    label: 'International: initiatives among nations',
    types: ['announcement', 'standard', 'resolution', 'report', 'case-study'],
  },
} as const satisfies Record<string, { label: string; types: readonly string[] }>

export type Design = keyof typeof DESIGNS

/** Every article type, by value. The first type of each design is its default. */
export const TYPE_LABELS = {
  dispatch: 'Dispatch',
  decree: 'Decree',
  statement: 'Statement',
  explanation: 'Explanation',
  notice: 'Notice',
  news: 'News',
  feature: 'Feature',
  analysis: 'Analysis',
  opinion: 'Opinion',
  announcement: 'Announcement',
  standard: 'Standard',
  resolution: 'Resolution',
  report: 'Report',
  'case-study': 'Case study',
} as const satisfies Record<(typeof DESIGNS)[Design]['types'][number], string>

export type ArticleType = keyof typeof TYPE_LABELS

export const isDesign = (value: unknown): value is Design =>
  typeof value === 'string' && value in DESIGNS

export const typesOf = (design: Design): readonly ArticleType[] => DESIGNS[design].types

export const defaultTypeOf = (design: Design): ArticleType => DESIGNS[design].types[0]

/**
 * A context's accent, from a curated set so every combination stays legible
 * on each design's ground. The designs decide how an accent is applied (a
 * rule, an emblem ground, a kicker colour); the hex values here are the
 * defaults they may refine.
 */
export const ACCENTS = {
  sea: { label: 'Sea', hex: '#1a4461' },
  lagoon: { label: 'Lagoon', hex: '#11707d' },
  saffron: { label: 'Saffron', hex: '#b2761a' },
  coral: { label: 'Coral', hex: '#bb4631' },
  cinnabar: { label: 'Cinnabar', hex: '#962c17' },
  olive: { label: 'Olive', hex: '#5d6b2a' },
  violet: { label: 'Violet', hex: '#5b4a8a' },
  slate: { label: 'Slate', hex: '#4a5566' },
} as const

export type Accent = keyof typeof ACCENTS
