import type { ReactNode } from 'react'

import { dress } from '@/components/styles'
import type { PanelBlockType } from '@/payload-types'

import { cn, type Tone, type Voice } from './shared'

/** The block's `tone` field: its tint. (`tone` on the props is the paper, as on every block; see Voice.) */
type Tint = PanelBlockType['tone']

type PanelProps = Pick<PanelBlockType, 'label'> & {
  tint: Tint
  /** The nested content, drawn by RichText with the article's own converters. */
  children: ReactNode
} & Voice

/**
 * How each paper draws the box. The Gazette rules it like a notice in the
 * record: a hairline on the sand, the label in the eyebrow's ink. The Times
 * boxes it like a sidebar on the newsprint, the label bold in the desk's
 * ink; inside a style's box (GirlieTea's pink) it rounds its corners and
 * takes the box's own edge and wash, so it isn't a grey square in a pink
 * page. The registry files it behind a paper hairline with a mono label.
 * Tints are a breath of colour, never a fill: the article's text still
 * reads as the article's text. Label and plain border read the style slots
 * where the paper has them, so GirlieTown's panels come out in rose.
 */
const VOICES: Record<
  Tone,
  {
    /** The label above the content. */
    label: string
    /** The label's ink on an alert, in place of the accent's. */
    alert: string
    /** Border and ground per tint. */
    tints: Record<Tint, string>
    /** Border and ground per tint inside the design's box, when a style has it on (the Times only). */
    boxed?: Partial<Record<Tint, string>>
  }
> = {
  gazette: {
    label: 'font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)',
    alert: 'text-(--seal-ink)',
    tints: {
      plain: 'border-sand-300',
      neutral: 'border-sand-300 bg-sand-100',
      cool: 'border-sea-200 bg-sea-100/50',
      warm: 'border-saffron-200 bg-saffron-100/60',
      alert: 'border-coral-300/60 bg-coral-300/12',
    },
  },
  times: {
    label: 'font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)',
    alert: 'text-cinnabar-700',
    tints: {
      plain: 'border-news-200',
      neutral: 'border-news-200 bg-news-100',
      cool: 'border-lagoon-300/70 bg-lagoon-300/15',
      warm: 'border-saffron-200 bg-saffron-100/55',
      alert: 'border-cinnabar-200 bg-cinnabar-100/70',
    },
    boxed: {
      plain: 'rounded-xl border-(--accent-faint)',
      neutral: 'rounded-xl border-(--accent-faint) bg-(--accent-wash)',
      cool: 'rounded-xl border-lagoon-300/70 bg-lagoon-300/15',
      warm: 'rounded-xl border-saffron-200 bg-saffron-100/55',
      alert: 'rounded-xl border-cinnabar-200 bg-cinnabar-100/70',
    },
  },
  // The registry has no yellow or red of its own (it carries none of Azania's
  // colours), so its warm and alert tints are its paper warmed and reddened
  // by a hair, as a stamp fades into a file: literals, like its slate slots.
  international: {
    label: 'font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500',
    alert: 'text-graphite-700',
    tints: {
      plain: 'border-paper-300',
      neutral: 'border-paper-300 bg-paper-100',
      cool: 'border-verdigris-300/70 bg-verdigris-100/70',
      warm: 'border-[#e2d9bd] bg-[#f5f1e4]',
      alert: 'border-[#e6cbc5] bg-[#f6ebe8]',
    },
  },
}

/**
 * The prose inside: the article's typography (RichText scopes it by
 * descent, so it reaches in here), a step quieter. Headings a size down and
 * closer, paragraphs and lists closer, a block inside closer still, and
 * nothing pressing on the frame. `:where()` keeps these at a specificity
 * below the first/last-child trim, and `!` lifts them over the article's.
 */
const INNER = cn(
  'text-[0.9375em]',
  '[&>*:first-child]:mt-0!',
  '[&>*:last-child]:mb-0!',
  '[&>:where(:is(h1,h2):not([class]))]:text-2xl!',
  '[&>:where(h3:not([class]))]:text-xl!',
  '[&>:where(h4:not([class]))]:text-lg!',
  '[&>:where(:is(h5,h6):not([class]))]:text-base!',
  '[&>:where(:is(h1,h2,h3,h4):not([class]))]:mt-6!',
  '[&>:where(:is(h1,h2,h3,h4):not([class]))]:mb-2!',
  '[&>:where(:is(h5,h6):not([class]))]:mt-5!',
  '[&>:where(:is(h5,h6):not([class]))]:mb-1.5!',
  '[&>:where(p:not([class]))]:my-4!',
  '[&>:where(ul.list-bullet,ol.list-number)]:my-4!',
  '[&>:where(blockquote:not([class]))]:my-5!',
  '[&>:where(figure,aside)]:my-6!',
  // A figure first keeps a little room: the Discord quote's plate rides its top edge.
  '[&>figure:first-child]:mt-2!',
)

/**
 * Panel — a plain bordered box around any content: a news update inside a
 * feature, a side story, a box of facts. Quieter than a callout: one
 * hairline, an optional small label, and at most a breath of tint behind
 * whatever the editor put in it, blocks included. The nested content is
 * rendered by RichText with the same converters as the article, so a
 * Discord quote or a map inside looks exactly as it does outside.
 */
export function PanelBlock({ tint, label, tone, style, children }: PanelProps) {
  const voice = VOICES[tone]
  const chosen: Tint = tint in voice.tints ? tint : 'plain'
  const boxed = tone === 'times' && dress('times', style).boxed
  const frame = (boxed && voice.boxed?.[chosen]) || voice.tints[chosen]
  const heading = label?.trim()

  return (
    <aside className={cn('my-8 border px-4 py-4 sm:px-6 sm:py-5', frame)} role="note">
      {/* Padding, not margin, under the label: a figure first in the content keeps its own margin on top of it. */}
      {heading ? <p className={cn('pb-4', voice.label, chosen === 'alert' && voice.alert)}>{heading}</p> : null}
      <div className={INNER}>{children}</div>
    </aside>
  )
}
