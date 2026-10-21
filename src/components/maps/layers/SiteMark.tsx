import type { ReactNode } from 'react'

import { GROUND } from '@/maps/palette'
import { SITE_GLYPHS, siteInk, type SiteFacts } from '@/maps/sites'

import type { Rect } from './projection'

/** The mark's radius: between a town's lozenge and a place's pin, since a site is neither. */
export const SITE_R = 10

/** The box a site's mark takes, which no name may cover. */
export const siteMarkRect = (x: number, y: number, scale = 1): Rect => {
  const r = SITE_R * scale + 2
  return { x: x - r, y: y - r, width: r * 2, height: r * 2 }
}

/** The kind's glyph on its 24 grid: a quarry's gem filled in its tint with whitewash facets, the rest stroked in their ink. */
function SiteGlyph({ facts }: { facts: Pick<SiteFacts, 'kind' | 'resource'> }) {
  const glyph = SITE_GLYPHS[facts.kind as keyof typeof SITE_GLYPHS] ?? SITE_GLYPHS.site
  const ink = siteInk(facts)
  return (
    <path
      d={glyph.d}
      fill={glyph.fill ? ink : 'none'}
      stroke={glyph.fill ? GROUND.whitewash : ink}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  )
}

/**
 * A held site's mark at its home block: a whitewash disc rimmed in the
 * treasury's gold, with the kind's glyph inside — a gem in its resource's
 * tint for a quarry, a ship, a bare tree, a banner. Gold because the site
 * is what it pays; a disc rather than a town's lozenge because nobody
 * lives there. Exported for the lists and the legend, which draw it small.
 */
export function SiteMark({
  facts,
  x,
  y,
  scale = 1,
  selected = false,
  children,
}: {
  facts: Pick<SiteFacts, 'kind' | 'resource'>
  x: number
  y: number
  scale?: number
  selected?: boolean
  /** A <title>, for a mark without a name beside it. */
  children?: ReactNode
}) {
  const r = SITE_R * scale
  return (
    <g transform={`translate(${x} ${y})`}>
      {children}
      {selected ? <circle fill="none" r={r + 4} stroke={GROUND.saffron} strokeWidth={3} /> : null}
      <circle fill={GROUND.whitewash} r={r} stroke={GROUND.saffronDeep} strokeWidth={2 * scale} />
      <g transform={`translate(${-6.5 * scale} ${-6.5 * scale}) scale(${(13 / 24) * scale})`}>
        <SiteGlyph facts={facts} />
      </g>
    </g>
  )
}

/** The same mark on its own, for a list, a panel's eyebrow, a figure's plate or the legend; `ring` recolours the rim (currentColor, for a paper's ink). */
export function SiteBadge({
  facts,
  className,
  title,
  ring = GROUND.saffronDeep,
}: {
  facts: Pick<SiteFacts, 'kind' | 'resource'>
  className?: string
  title?: string
  ring?: string
}) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      role={title ? 'img' : undefined}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <circle cx={12} cy={12} fill={GROUND.whitewash} r={11} stroke={ring} strokeWidth={2} />
      <g transform="translate(4.5 4.5) scale(0.625)">
        <SiteGlyph facts={facts} />
      </g>
    </svg>
  )
}
