import type { CSSProperties, ReactNode } from 'react'

import { CREST_BOX, CrestShapes } from '@/components/site/Crest'
import { PETALS, PETALS_GRID } from '@/components/styles/blossom/Blossom'

import type { CardByline } from './model'
import { CARD, COLOR } from './tokens'

/**
 * The parts every card is built from, written for Satori: flexbox only
 * (every box with more than one child says so), literal colours, inline SVG
 * with explicit fills, and nothing a stylesheet would have to supply.
 */

export const col: CSSProperties = { display: 'flex', flexDirection: 'column' }
export const row: CSSProperties = { display: 'flex', flexDirection: 'row', alignItems: 'center' }

/** The whole card: a column the size Open Graph expects, in a ground colour and a base face. */
export function Canvas({
  background,
  fontFamily,
  color,
  children,
}: {
  background: string
  fontFamily: string
  color: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        ...col,
        width: CARD.width,
        height: CARD.height,
        background,
        color,
        fontFamily,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

/**
 * A line in tracked capitals: the eyebrows, kickers and labels every design
 * sets. Tracking is given in em, as the stylesheet gives it.
 */
export function Caps({
  children,
  size = 20,
  tracking = 0.2,
  color,
  font,
  weight = 400,
  style,
}: {
  children: ReactNode
  size?: number
  tracking?: number
  color: string
  font: string
  weight?: 400 | 500 | 600 | 700 | 900
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        ...row,
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        letterSpacing: Math.round(size * tracking * 10) / 10,
        textTransform: 'uppercase',
        color,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** The dot between the words of a kicker. */
export function Dot({ color, gap = 12 }: { color: string; gap?: number }) {
  return <span style={{ color, marginLeft: gap, marginRight: gap }}>·</span>
}

/**
 * A font size that keeps `text` to `lines` lines in a column `width` wide,
 * between `max` and `min`; `ratio` is the face's average glyph width in em
 * (a serif around 0.47, a black grotesque nearer 0.6). Estimated by greedy
 * wrapping, so pair it with a line clamp for the odd long word.
 */
export function fitSize(
  text: string,
  options: { width: number; max: number; min: number; lines: number; ratio: number },
): number {
  return fitText(text, options).size
}

/** `fitSize`, with the number of lines the text is expected to take at that size. */
export function fitText(
  text: string,
  { width, max, min, lines, ratio }: { width: number; max: number; min: number; lines: number; ratio: number },
): { size: number; lines: number } {
  const words = text.split(/\s+/).filter(Boolean)
  const wrapped = (perLine: number) => {
    let count = 1
    let used = 0
    for (const word of words) {
      const next = used === 0 ? word.length : used + 1 + word.length
      if (next <= perLine) {
        used = next
      } else {
        count += 1
        used = word.length
      }
    }
    return count
  }
  const linesAt = (size: number) => wrapped(Math.floor(width / (size * ratio)))
  for (let size = max; size > min; size -= 2) {
    const count = linesAt(size)
    if (count <= lines) return { size, lines: count }
  }
  return { size: min, lines: Math.min(lines, linesAt(min)) }
}

/**
 * The national crest, `height` px tall, in one colour. Satori serialises
 * an inline SVG as it stands and does not render components inside one, so
 * the shapes are called for their elements rather than mounted.
 */
export function CrestMark({ color, height }: { color: string; height: number }) {
  const width = Math.round((height * CREST_BOX.width) / CREST_BOX.height)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${CREST_BOX.width} ${CREST_BOX.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {CrestShapes({ color })}
    </svg>
  )
}

/** GirlieTown's pixel blossom, `size` px square, scaled without smoothing. */
export function BlossomMark({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PETALS_GRID} ${PETALS_GRID}`}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <path d={PETALS} fill={color} />
    </svg>
  )
}

/** The registry mark: nations as equal points around a round table (src/components/intl/IntlMark). */
export function IntlMarkShape({ color, size }: { color: string; size: number }) {
  const seats = Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2 - Math.PI / 2
    return { cx: (16 + Math.cos(angle) * 11).toFixed(2), cy: (16 + Math.sin(angle) * 11).toFixed(2) }
  })
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="11" fill="none" stroke={color} strokeWidth="1" opacity="0.45" />
      {seats.map((seat, index) => (
        <circle key={index} cx={seat.cx} cy={seat.cy} r="1.9" fill={color} />
      ))}
      <circle cx="16" cy="16" r="1.9" fill={color} />
    </svg>
  )
}

/** The small seal mark beside a document of state's type. */
export function SealMark({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" fill="none" stroke={color} strokeWidth="1.2" />
      <circle cx="6" cy="6" r="2.2" fill={color} />
    </svg>
  )
}

/** The Seal of the Nation as pressed into wax: a coral disc bearing the crest in sand. */
export function WaxSeal({ size }: { size: number }) {
  return (
    <div
      style={{
        ...row,
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size,
        background: COLOR.coral600,
        boxShadow: `inset 0 0 0 ${Math.round(size / 28)}px rgba(251,248,241,0.3), 0 0 0 ${Math.round(size / 24)}px ${COLOR.sand50}, 0 0 0 ${Math.round(size / 24) + 2}px rgba(187,70,49,0.3)`,
      }}
    >
      <CrestMark color={COLOR.sand50} height={Math.round(size * 0.56)} />
    </div>
  )
}

/** The Azanian tricolour swatch: sea, saffron, coral. */
export function FlagTick({ height = 16 }: { height?: number }) {
  const third = Math.round(height * 0.75)
  return (
    <div style={{ ...row, height, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: third, height, background: '#14334b' }} />
      <div style={{ width: third, height, background: '#d8962c' }} />
      <div style={{ width: third, height, background: '#bb4631' }} />
    </div>
  )
}

/** How a design frames a face, and letters a monogram in its place. */
export type AvatarTone = {
  /** The frame's ground, border and inner padding; a Times head has none. */
  frame?: { background: string; border: string; padding: number }
  /** The monogram's ground, colour and face. */
  mark: { background: string; color: string; font: string; weight: 400 | 500 | 600 | 700 | 900 }
  /** Rounded corners, for a style that softens the design. */
  radius?: number
}

const FRAME_BORDER = 1.5

/** How much a tone's frame adds around a head, so layouts can size for the whole. */
export const avatarOuter = (size: number, tone: AvatarTone): number =>
  tone.frame ? size + 2 * (tone.frame.padding + FRAME_BORDER) : size

/**
 * The face on a byline: the player's head or an uploaded avatar, already
 * fetched at `size` (HEAD_PX) so nothing is resampled, or the monogram of
 * the name in the design's letterform when the card has neither. A tone's
 * frame is drawn around that size, not inside it.
 */
export function Avatar({ byline, size, tone }: { byline: CardByline; size: number; tone: AvatarTone }) {
  const frame = tone.frame
  const image = byline.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori draws this, not a browser.
    <img
      src={byline.avatar}
      width={size}
      height={size}
      alt=""
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: tone.radius ?? 0 }}
    />
  ) : (
    <div
      style={{
        ...row,
        justifyContent: 'center',
        width: size,
        height: size,
        background: tone.mark.background,
        color: tone.mark.color,
        fontFamily: tone.mark.font,
        fontWeight: tone.mark.weight,
        fontSize: Math.round(size * (byline.initials.length > 1 ? 0.4 : 0.52)),
        letterSpacing: 1,
        lineHeight: 1,
        borderRadius: tone.radius ?? 0,
      }}
    >
      {byline.initials}
    </div>
  )
  if (!frame) return image
  const outer = avatarOuter(size, tone)
  return (
    <div
      style={{
        ...row,
        justifyContent: 'center',
        width: outer,
        height: outer,
        flexShrink: 0,
        background: frame.background,
        border: `${FRAME_BORDER}px solid ${frame.border}`,
        borderRadius: tone.radius ?? 0,
      }}
    >
      {image}
    </div>
  )
}

/** One line naming what sits within a context, cut with an ellipsis when the list runs long. */
export function Within({
  label,
  names,
  font,
  weight = 400,
  color,
  nameColor,
  size = 16,
}: {
  label: string
  names: string[]
  font: string
  weight?: 400 | 500 | 600
  color: string
  nameColor: string
  size?: number
}) {
  if (names.length === 0) return null
  return (
    <div
      style={{
        ...row,
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        letterSpacing: Math.round(size * 0.16 * 10) / 10,
        textTransform: 'uppercase',
        lineHeight: 1,
        color,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ marginRight: 28, flexShrink: 0 }}>{label}</span>
      <span style={{ color: nameColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {names.join('   ·   ')}
      </span>
    </div>
  )
}

/**
 * A picture filling its box, cropped to cover it; `style` sets the box (by
 * default it stretches to fill the panel it sits in).
 */
export function Picture({ src, radius = 0, style }: { src: string; radius?: number; style?: CSSProperties }) {
  return (
    <div style={{ ...col, flex: 1, alignSelf: 'stretch', overflow: 'hidden', borderRadius: radius, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws this, not a browser. */}
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

/** A context's emblem, fitted inside a square of `size` px without cropping. */
export function EmblemImage({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- Satori draws this, not a browser.
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain' }} />
}

/** The words above a page: the names leading down to it, or a line of its own. */
export const breadcrumbOf = (chain: string[], alone: string): string =>
  chain.length > 1 ? chain.join('  ›  ') : alone
