import type { ReactNode } from 'react'

import { GROUND } from '@/maps/palette'
import { SERVER_GLYPHS, SERVER_INKS, type ServerKind } from '@/maps/trading'

import type { Rect } from './projection'

/**
 * The marks of the server's own places (src/maps/trading.ts): a rounded
 * square, like a trader's sign, where a town has its dot and a site its
 * disc, so a reader tells at a glance what nobody holds from what a nation
 * does. A trading outpost's is solid lagoon with its arrows in whitewash;
 * a landmark's whitewash, rimmed in grey, with its star in ink.
 */

/** Half the mark's side, a little under a site's radius, so the two weigh alike on the map. */
export const TRADING_R = 8.5

/** The box a mark takes, which no name may cover. */
export const tradingMarkRect = (x: number, y: number, scale = 1): Rect => {
  const r = TRADING_R * scale + 2
  return { x: x - r, y: y - r, width: r * 2, height: r * 2 }
}

/** The kind's glyph on its 24 grid, in its ink: the arrows stroked, the star filled. */
function TradingGlyph({ kind }: { kind: ServerKind }) {
  const glyph = SERVER_GLYPHS[kind]
  const ink = SERVER_INKS[kind].glyph
  return (
    <path
      d={glyph.d}
      fill={glyph.fill ? ink : 'none'}
      stroke={ink}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  )
}

/**
 * The mark at the place, where the server's own marker stands. `scale`
 * sizes it with the zoom; a selected one wears the saffron ring every
 * chosen thing on the map does.
 */
export function TradingMark({
  kind,
  x,
  y,
  scale = 1,
  selected = false,
  children,
}: {
  kind: ServerKind
  x: number
  y: number
  scale?: number
  selected?: boolean
  /** A <title>, for a mark without a name beside it. */
  children?: ReactNode
}) {
  const r = TRADING_R * scale
  const ink = SERVER_INKS[kind]
  return (
    <g transform={`translate(${x} ${y})`}>
      {children}
      {selected ? (
        <rect fill="none" height={(r + 4) * 2} rx={r * 0.5 + 4} stroke={GROUND.saffron} strokeWidth={3} width={(r + 4) * 2} x={-r - 4} y={-r - 4} />
      ) : null}
      <rect fill={ink.mark} height={r * 2} rx={r * 0.4} stroke={ink.rim} strokeWidth={1.5 * scale} width={r * 2} x={-r} y={-r} />
      <g transform={`translate(${-6 * scale} ${-6 * scale}) scale(${(12 / 24) * scale})`}>
        <TradingGlyph kind={kind} />
      </g>
    </g>
  )
}

/**
 * A trading outpost far out, where the world is nations and a mark would
 * crowd it: a pip of the lagoon, a few pixels across, so the reader still
 * sees where on the world the trade is.
 */
export function TradingPip({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <rect
      fill={SERVER_INKS.trading.mark}
      height={6}
      rx={1.5}
      stroke={GROUND.whitewash}
      strokeWidth={1}
      width={6}
      x={x - 3}
      y={y - 3}
    >
      {children}
    </rect>
  )
}

/** The same mark on its own, for a list, a panel's eyebrow, the search or the legend. */
export function TradingBadge({ kind, className, title }: { kind: ServerKind; className?: string; title?: string }) {
  const ink = SERVER_INKS[kind]
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      role={title ? 'img' : undefined}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {/* On the panel's paper a rim of whitewash would vanish: the trading mark goes without, the landmark keeps its grey. */}
      <rect
        fill={ink.mark}
        height={21}
        rx={5}
        stroke={kind === 'trading' ? ink.mark : ink.rim}
        strokeWidth={1.5}
        width={21}
        x={1.5}
        y={1.5}
      />
      <g transform="translate(5 5) scale(0.5833)">
        <TradingGlyph kind={kind} />
      </g>
    </svg>
  )
}
