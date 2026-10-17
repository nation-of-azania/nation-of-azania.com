import type { EmbedBlockType } from '@/payload-types'

type EmbedProps = Pick<EmbedBlockType, 'caption' | 'url'>

type VideoEmbed = {
  provider: 'Vimeo' | 'YouTube'
  src: string
}

const YOUTUBE_ID = /^[\w-]{6,20}$/

/** Recognizes YouTube and Vimeo URLs and maps them to privacy-friendly embed URLs. */
function parseVideoEmbed(raw: string): VideoEmbed | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.replace(/^www\./i, '').toLowerCase()

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v')
    const fromPath = url.pathname.match(/^\/(?:embed|live|shorts)\/([\w-]+)/)?.[1]
    const id = fromQuery ?? fromPath
    if (id && YOUTUBE_ID.test(id)) {
      return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}` }
    }
    return null
  }

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1]
    if (id && YOUTUBE_ID.test(id)) {
      return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}` }
    }
    return null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match =
      url.pathname.match(/^\/(?:video\/)?(\d{4,})(?:\/([a-zA-Z0-9]+))?\/?$/) ??
      url.pathname.match(/\/(\d{6,})(?:\/|$)/)
    if (match?.[1]) {
      // Unlisted videos carry a privacy hash (vimeo.com/ID/HASH or ?h=HASH).
      const hash = match[2] ?? url.searchParams.get('h')
      const hashParam = hash ? `&h=${encodeURIComponent(hash)}` : ''
      return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${match[1]}?dnt=1${hashParam}` }
    }
    return null
  }

  return null
}

function LinkCard({ url }: { url: string }) {
  let hostname: string | null = null
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    hostname = null
  }

  return (
    <a
      className="group flex items-center justify-between gap-4 border border-parchment-300 bg-parchment-100 px-5 py-4 transition-colors hover:border-gold-400"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="min-w-0">
        <span className="block text-[0.6875rem] font-semibold tracking-[0.18em] text-ink-500 uppercase">
          {hostname ?? 'External link'}
        </span>
        <span className="mt-1 block truncate text-sm text-pine-700 underline decoration-gold-400 underline-offset-2 group-hover:decoration-gold-600">
          {url}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 font-display text-lg leading-none text-gold-600">
        &#8599;
      </span>
    </a>
  )
}

/**
 * Embed — YouTube/Vimeo URLs render as a responsive 16:9 iframe (via the
 * youtube-nocookie.com / dnt=1 player endpoints); anything else renders as a
 * bordered external link card.
 */
export function EmbedBlock({ url, caption }: EmbedProps) {
  if (!url) return null

  const video = parseVideoEmbed(url)

  return (
    <figure className="my-8">
      {video ? (
        <div className="border border-parchment-300 bg-parchment-100 p-1">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="block aspect-video w-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={video.src}
            title={caption || `${video.provider} video`}
          />
        </div>
      ) : (
        <LinkCard url={url} />
      )}
      {caption ? (
        <figcaption className="mx-auto mt-3 max-w-prose text-center text-sm leading-normal text-ink-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
