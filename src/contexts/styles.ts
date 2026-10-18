import type { Design } from './designs'

/**
 * Styles: hand-made looks layered on a design, each belonging to someone in
 * Azania (Cherry Blossom is GirlieTown's). A style is code, not content: it
 * has a variant for every design it supports (src/components/styles/), so a
 * GirlieTown statement still reads as a Gazette record and a Girlie Opinion
 * column as the Times, each in GirlieTown's colours.
 *
 * Admins give a context a style (Contexts → Style). Everything below inherits
 * it, unless a sub-context sets its own or "Plain". An article wears the
 * style in force on its context, both on its own page and wherever it is
 * listed; its author may set it to "Plain" instead, or pick an `open` style.
 * A style a design has no variant for is never worn there.
 *
 * Adding a style: add it here, build its variants, run `pnpm migrate:create`
 * (the choices are a Postgres enum) and commit the migration.
 */
export const STYLES = {
  blossom: {
    label: 'Cherry Blossom (GirlieTown)',
    designs: ['gazette', 'times'],
    /** Open styles can be picked on any article of their designs; others only come from contexts. */
    open: false,
  },
} as const satisfies Record<string, { label: string; designs: readonly Design[]; open: boolean }>

export type StyleId = keyof typeof STYLES

/** Stored instead of a style to stop inheriting one: the design's own look. */
export const PLAIN = 'plain'

export const isStyle = (value: unknown): value is StyleId =>
  typeof value === 'string' && value in STYLES

export const styleSupports = (style: StyleId, design: Design): boolean =>
  (STYLES[style].designs as readonly Design[]).includes(design)

/** Select options for a style field: "Plain", then the given styles. */
export const styleOptions = (plainLabel: string) => [
  { label: plainLabel, value: PLAIN },
  ...Object.entries(STYLES).map(([value, style]) => ({ label: style.label, value })),
]

type Styled = { style?: string | null }

/**
 * The style in force at the end of a chain (top-level context first): the
 * nearest context that sets one, unless that is "Plain"; null when none is
 * set, or the design has no variant of it.
 */
export function styleOfChain(chain: Styled[], design: Design): StyleId | null {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const style = chain[index].style
    if (style === PLAIN) return null
    if (isStyle(style)) return styleSupports(style, design) ? style : null
  }
  return null
}

/** The style an article wears: its own choice, else its context's. */
export function styleOfArticle(article: Styled, chain: Styled[], design: Design): StyleId | null {
  if (article.style === PLAIN) return null
  if (isStyle(article.style) && STYLES[article.style].open && styleSupports(article.style, design)) {
    return article.style
  }
  return styleOfChain(chain, design)
}
