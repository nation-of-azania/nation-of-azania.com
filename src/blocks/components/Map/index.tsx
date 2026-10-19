import { COLOR, STYLE_THEME } from '@/components/og/tokens'
import { BylineAvatar, type AvatarTone } from '@/components/site/BylineAvatar'
import { formatDate, minecraftHeadUrl } from '@/components/site/format'
import { dress } from '@/components/styles'
import {
  ASPECTS,
  getTown,
  isAspectName,
  isMapName,
  isZoomName,
  liveMapUrl,
  townCentre,
  type Town,
} from '@/lib/dynmap'
import type { MapBlockType } from '@/payload-types'

import { cn, type Tone, type Voice } from '../shared'
import { CopyCoordinates, MapClip } from './Client'

type MapProps = Pick<
  MapBlockType,
  'aspect' | 'caption' | 'claims' | 'facts' | 'map' | 'pin' | 'town' | 'x' | 'z' | 'zoom'
> &
  Voice

/**
 * How each paper mounts a map. The Gazette frames it like a print, with the
 * town's particulars on a plate under the picture; the Times prints it flat
 * on the newsprint, the plate in the paper's wash; the registry files it
 * behind a hairline with mono labels, as a registry card. Rules and labels
 * read the style slots, so GirlieTown's maps come out in rose.
 */
const VOICES: Record<
  Tone,
  {
    avatar: AvatarTone
    button: string
    caption: string
    captionPrefix: string | null
    frame: string
    label: string
    link: string
    name: string
    note: string
    plate: string
    survey: string
    value: string
    well: string
  }
> = {
  gazette: {
    avatar: 'gazette',
    button: 'text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-800',
    caption: 'mx-auto mt-3 max-w-prose text-center text-sm leading-normal text-ink-500',
    captionPrefix: null,
    frame: 'border border-sand-300 bg-sand-100 p-1',
    label: 'font-label text-[10px] uppercase tracking-[0.18em] text-(--accent-ink)',
    link: 'text-sea-700 underline decoration-(--accent) underline-offset-2 hover:text-sea-800',
    name: 'font-display text-lg leading-tight text-sea-900',
    note: 'bg-sand-200/60 text-ink-500',
    plate: 'mt-1 border-t border-(--accent) px-2 pt-3 pb-1.5 sm:px-3',
    survey: 'mt-2 justify-center text-ink-500',
    value: 'text-sm text-ink-700',
    well: 'bg-sand-200',
  },
  times: {
    avatar: 'times',
    button: 'text-(--accent-ink) underline decoration-dotted underline-offset-2 hover:text-(--accent)',
    caption: 'mt-2.5 text-sm leading-normal text-news-500',
    captionPrefix: null,
    frame: 'overflow-hidden bg-(--accent-wash)',
    label: 'font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)',
    link: 'text-(--accent-ink) underline decoration-lagoon-500 underline-offset-2 hover:text-(--accent)',
    name: 'font-news text-lg leading-tight font-bold text-news-900',
    note: 'bg-news-100 text-news-500',
    plate: 'px-4 pt-3 pb-3.5',
    survey: 'mt-1.5 text-news-500',
    value: 'text-sm text-news-700',
    well: 'bg-news-200',
  },
  international: {
    avatar: 'international',
    button: 'text-verdigris-700 underline decoration-dotted underline-offset-2 hover:text-verdigris-800',
    caption: 'mt-2.5 text-xs leading-normal text-graphite-500',
    captionPrefix: 'Map — ',
    frame: 'border border-paper-200 bg-paper-100 p-1',
    label: 'font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500',
    link: 'text-verdigris-700 underline decoration-verdigris-300 underline-offset-2 hover:text-verdigris-800',
    name: 'font-record text-lg leading-tight font-medium text-graphite-900',
    note: 'bg-paper-200/60 text-graphite-500',
    plate: 'mt-1 border-t border-paper-200 px-2 pt-3 pb-1.5 sm:px-3',
    survey: 'mt-1.5 text-graphite-500',
    value: 'text-sm text-graphite-900',
    well: 'bg-paper-200',
  },
}

/**
 * The ink a paper draws claims in: it must hold against sea and savanna
 * alike, under a white halo, so each paper's "pressed-on" colour rather
 * than its ground — the Gazette's seal, the Times' cinnabar, the registry's
 * verdigris. A style draws in its own (GirlieTown's rose).
 */
const CLAIM_INK: Record<Tone, string> = {
  gazette: COLOR.coral600,
  times: COLOR.cinnabar700,
  international: COLOR.verdigris600,
}

/** "Cape_Agulhas" as Towny spells it, "Cape Agulhas" as a reader says it. */
const spoken = (name: string) => name.replace(/_/g, ' ')

/** The zoom, said in an alt text. */
const ZOOM_WORDS = {
  close: 'up close',
  street: 'at street level',
  town: 'at town scale',
  district: 'at district scale',
  region: 'at regional scale',
  country: 'at country scale',
} as const

/** "Oct 10 2026", as Towny writes it, in the site's own date form; the raw text if it won't parse. */
function foundedOn(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : (formatDate(date.toISOString()) ?? raw)
}

/** "6 · IPaaat, RedYooschi, C9H13N03_ and 3 more". */
function residentsOf(town: Town): string {
  const names = town.residents
  if (names.length === 0) return 'None recorded'
  const shown = names.slice(0, 3)
  const rest = names.length - shown.length
  return `${names.length} · ${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`
}

function Fact({
  label,
  value,
  voice,
  className,
}: {
  className?: string
  label: string
  value: string
  voice: (typeof VOICES)[Tone]
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className={voice.label}>{label}</dt>
      <dd className={cn('mt-0.5 break-words', voice.value)}>{value}</dd>
    </div>
  )
}

/**
 * Map — a clipping of the Rulercraft map, set as a figure: the picture, a
 * caption, the coordinates as a survey reference, and a quiet link to the
 * live map. Centred on a Towny town, it outlines the town's claims and may
 * add a plate of the town's facts from the map's own records, with the
 * ruler's head. The clipping is drawn by /mapclip (src/app/(frontend)/mapclip)
 * and cached at the CDN; the claims are outlined in the paper's colour, or
 * the style's.
 *
 * A server component, so the town is looked up at render time (cached an
 * hour in src/lib/dynmap.ts) and the page stays static. Whatever the map
 * server does, the frame renders: a town it doesn't know, or a map that
 * isn't answering, is said in the frame, never shown as a broken image.
 */
export async function MapBlock({
  town: townField,
  x,
  z,
  zoom,
  map,
  aspect,
  claims,
  pin,
  facts,
  caption,
  tone,
  style,
}: MapProps) {
  const voice = VOICES[tone]
  const zoomName = isZoomName(zoom) ? zoom : 'town'
  const mapName = isMapName(map) ? map : 'flat'
  const aspectName = isAspectName(aspect) ? aspect : 'wide'
  const { width, height } = ASPECTS[aspectName]

  const townName = townField?.trim() || null
  const lookup = townName ? await getTown(townName) : null
  const town = lookup && lookup !== 'offline' ? lookup : null
  const hasCoordinates = typeof x === 'number' && Number.isFinite(x) && typeof z === 'number' && Number.isFinite(z)
  const centre = hasCoordinates ? { x, z } : town ? townCentre(town) : null

  // In the Times, a style's box rounds the pictures inside it; follow the hero.
  const rounded = tone === 'times' && dress('times', style).boxed
  const frame = cn(voice.frame, rounded && 'rounded-xl')

  const note = (message: string) => (
    <div
      className={cn(
        'flex min-h-44 w-full items-center justify-center px-6 py-8 text-center text-sm leading-normal',
        voice.note,
      )}
    >
      <p className="max-w-md">{message}</p>
    </div>
  )

  // Nothing to centre on: the town is the subject, and the map can't place it.
  if (!centre) {
    const message =
      lookup === 'offline'
        ? `The Rulercraft map isn’t answering just now. ${spoken(townName ?? 'The map')} will appear here when it is.`
        : `The Rulercraft map has no town called “${townName}” just now.`
    return (
      <figure className="my-8">
        <div className={frame}>{note(message)}</div>
        {caption ? <figcaption className={voice.caption}>{caption}</figcaption> : null}
      </figure>
    )
  }

  // Claims and facts belong to a town; a clipping on coordinates has neither.
  const colour = (style && STYLE_THEME[style]) || CLAIM_INK[tone]
  const query = new URLSearchParams({ zoom: zoomName, map: mapName, aspect: aspectName, colour: colour.slice(1) })
  if (town) query.set('town', town.name)
  if (hasCoordinates) {
    query.set('x', String(Math.round(x)))
    query.set('z', String(Math.round(z)))
  }
  if (town && claims === false) query.set('claims', '0')
  if (pin) query.set('pin', '1')
  const src = `/mapclip?${query}`

  // The survey reference: the home block has a height; coordinates keep the
  // player's own ("~" in a /tp), as the map knows nothing above sea level.
  const atHome = Boolean(town?.home) && !hasCoordinates
  const cx = Math.round(centre.x)
  const cz = Math.round(centre.z)
  const cy = atHome ? Math.round(town!.home!.y) : null
  const reference = [
    ['X', String(cx)],
    ...(cy != null ? [['Y', String(cy)]] : []),
    ['Z', String(cz)],
  ] as const
  const clipboard = `${cx} ${cy ?? '~'} ${cz}`
  const live = liveMapUrl({ x: cx, z: cz, zoom: zoomName, map: mapName })

  const alt = town
    ? `${spoken(town.name)} on the Rulercraft map, ${ZOOM_WORDS[zoomName]}${claims === false ? '' : ', its claims outlined'}`
    : `The Rulercraft map around x ${cx}, z ${cz}, ${ZOOM_WORDS[zoomName]}`

  const showFacts = Boolean(town) && facts !== false
  const ruler = town?.ruler ?? null

  return (
    <figure className="my-8">
      <div className={frame}>
        <div className={cn('overflow-hidden', voice.well, rounded && 'rounded-lg')}>
          <MapClip
            alt={alt}
            className="block h-auto w-full"
            fallback={note('The Rulercraft map isn’t answering just now; the clipping will appear when it is.')}
            height={height}
            src={src}
            width={width}
          />
        </div>

        {showFacts && town ? (
          <div className={voice.plate}>
            <div className="flex items-start gap-3">
              <BylineAvatar
                byline={{
                  name: ruler ?? town.name,
                  avatar: ruler ? { url: minecraftHeadUrl(ruler), alt: '', pixelated: true } : undefined,
                }}
                size={40}
                tone={voice.avatar}
              />
              <div className="min-w-0 flex-1">
                <p className={voice.name}>{spoken(town.name)}</p>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-5">
                  <Fact label="Ruler" value={ruler ?? 'None recorded'} voice={voice} />
                  <Fact
                    className="col-span-2"
                    label={town.residents.length === 1 ? 'Resident' : 'Residents'}
                    value={residentsOf(town)}
                    voice={voice}
                  />
                  <Fact label="Nation" value={town.nation ? spoken(town.nation) : 'None'} voice={voice} />
                  <Fact label="Founded" value={foundedOn(town.founded) ?? 'Not recorded'} voice={voice} />
                </dl>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <figcaption>
        {caption ? (
          <p className={voice.caption}>
            {voice.captionPrefix ? <span className="font-mono">{voice.captionPrefix}</span> : null}
            {caption}
          </p>
        ) : null}
        {townName && !town ? (
          <p className={cn(voice.caption, 'italic')}>
            {lookup === 'offline'
              ? `The map isn’t answering just now, so ${townName}’s claims aren’t drawn.`
              : `The map has no town called “${townName}” just now, so no claims are drawn.`}
          </p>
        ) : null}
        <p
          className={cn(
            'flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.06em] tabular-nums',
            voice.survey,
          )}
        >
          <span className="inline-flex gap-x-2">
            {reference.map(([axis, value], index) => (
              <span key={axis}>
                {index > 0 ? <span aria-hidden="true" className="mr-2 opacity-50">/</span> : null}
                <span className="opacity-70">{axis}</span> {value}
              </span>
            ))}
          </span>
          {/* Kept together, so a narrow screen wraps the actions as one line under the reference. */}
          <span className="inline-flex items-baseline gap-x-3">
            <CopyCoordinates className={voice.button} text={clipboard} />
            <span aria-hidden="true" className="opacity-50">
              ·
            </span>
            <a className={voice.link} href={live} rel="noopener noreferrer" target="_blank">
              Open the live map <span aria-hidden="true">&#8599;</span>
            </a>
          </span>
        </p>
      </figcaption>
    </figure>
  )
}
