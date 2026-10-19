import { dress } from '@/components/styles'
import type { SkinBlockType } from '@/payload-types'

import { cn, type Tone, type Voice } from '../shared'
import { SkinClient } from './Client'
import type { SkinAnimation } from './Viewer'

type SkinProps = Pick<SkinBlockType, 'animation' | 'caption' | 'minecraftName'> & Voice

const ANIMATIONS: ReadonlySet<string> = new Set<SkinAnimation>(['idle', 'walk', 'wave', 'still'])

/**
 * How each paper sets a portrait. The Gazette mounts it like a miniature:
 * a sand frame and mat, the name in the display serif, the office line in
 * the style's ink under a hairline in its accent. The Times prints it flat
 * in the paper's wash, the name in the headline grotesque. The registry
 * files it like a delegate's badge: a graphite hairline, mono labels, the
 * record serif.
 */
const VOICES: Record<
  Tone,
  {
    caption: string
    card: string
    eyebrow: string
    hint: string
    link: string
    name: string
    plate: string
    rule: string | null
    stage: string
  }
> = {
  gazette: {
    caption: 'mt-3 text-sm leading-normal text-ink-500',
    card: 'border border-sand-300 bg-sand-100 p-1',
    eyebrow: 'font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)',
    hint: 'font-label text-[0.625rem] uppercase tracking-[0.18em] text-ink-400',
    link: 'text-sea-700 underline decoration-(--accent) underline-offset-2 hover:text-sea-800',
    name: 'mt-2 font-display text-2xl leading-tight text-sea-900 sm:text-[1.75rem]',
    plate: 'px-5 py-5 sm:px-7',
    rule: 'mt-3 h-px w-10 bg-(--accent)',
    stage: 'bg-sand-50',
  },
  times: {
    caption: 'mt-3 text-sm leading-normal text-news-700',
    card: 'bg-(--accent-wash)',
    eyebrow: 'font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)',
    hint: 'font-label text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-news-500',
    link: 'text-(--accent-ink) underline decoration-lagoon-500 underline-offset-2 hover:text-(--accent)',
    name: 'mt-2 font-news text-2xl leading-tight font-black text-(--accent-deep) sm:text-3xl',
    plate: 'px-5 py-5 sm:px-7',
    rule: 'mt-3 h-0.5 w-10 bg-(--accent)',
    stage: '',
  },
  international: {
    caption: 'mt-3 text-sm leading-normal text-graphite-700',
    card: 'border border-paper-300 bg-paper-100',
    eyebrow: 'font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500',
    hint: 'font-mono text-[0.625rem] uppercase tracking-[0.14em] text-graphite-500',
    link: 'text-verdigris-700 underline decoration-verdigris-300 underline-offset-2 hover:text-verdigris-800',
    name: 'mt-2 font-record text-2xl leading-tight font-medium text-graphite-900 sm:text-[1.75rem]',
    plate: 'px-5 py-5 sm:px-7',
    rule: 'mt-3 h-px w-10 bg-(--accent)',
    stage: 'bg-paper-50',
  },
}

/**
 * Skin — a player's portrait: their Minecraft skin, turnable, beside their
 * name and a caption, with a quiet link to their NameMC page. Server-safe:
 * this entry renders the frame and the name plate; the stage (./Client.tsx)
 * shows a still render of the player until the viewer has loaded, and keeps
 * it wherever WebGL is missing.
 */
export function SkinBlock({ minecraftName, animation, caption, tone, style }: SkinProps) {
  const name = minecraftName?.trim()
  if (!name) return null
  const voice = VOICES[tone]
  const chosen: SkinAnimation = animation && ANIMATIONS.has(animation) ? (animation as SkinAnimation) : 'idle'
  // Bedrock players (a leading ".") have no NameMC page.
  const namemc = name.startsWith('.') ? null : `https://namemc.com/profile/${encodeURIComponent(name)}`
  const rounded = tone === 'times' && dress('times', style).boxed

  return (
    <figure className={cn('my-10 flex flex-col sm:flex-row', voice.card, rounded && 'rounded-2xl')}>
      <div
        aria-label={`${name}’s Minecraft skin`}
        className={cn(
          'relative h-72 w-full shrink-0 overflow-hidden sm:aspect-[3/4] sm:h-auto sm:w-60',
          voice.stage,
          rounded && 'rounded-xl',
        )}
        role="img"
      >
        <SkinClient
          animation={chosen}
          hint={{ className: cn('right-2.5 bottom-2', voice.hint), text: 'Drag to turn' }}
          name={name}
        />
      </div>
      <figcaption className={cn('flex min-w-0 flex-1 flex-col justify-center', voice.plate)}>
        <p className={voice.eyebrow}>Player</p>
        <p className={voice.name}>{name}</p>
        {voice.rule ? <span aria-hidden="true" className={cn('block', voice.rule)} /> : null}
        {caption ? <p className={voice.caption}>{caption}</p> : null}
        {namemc ? (
          <p className="mt-3 text-xs">
            <a className={voice.link} href={namemc} rel="noopener noreferrer" target="_blank">
              NameMC <span aria-hidden="true">&#8599;</span>
            </a>
          </p>
        ) : null}
      </figcaption>
    </figure>
  )
}
