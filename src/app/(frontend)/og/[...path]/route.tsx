import { ImageResponse } from 'next/og'

import { CARD, renderCard } from '@/components/og'
import { loadCard, type Loaded } from '@/lib/og'

import { loadCardFonts } from '../fonts'

/**
 * The link-preview card of any public page: /og/<path> is the 1200×630 PNG
 * for /<path>, so /og/times/articles/<slug> is that story's card and
 * /og/gov the Gazette's front page. The pages point here from their Open
 * Graph metadata (src/app/(frontend)/[top]/[[...rest]]/page.tsx), and a
 * Discord embed can ask for one directly.
 *
 * Runs in Node (Payload's local API needs it) and never 404s: a path that
 * leads nowhere, or a database that cannot be reached, gets the generic
 * Azania card, since crawlers hit odd URLs and an embed with a broken
 * picture is worse than one with a plain one. A `?v=` query may carry a
 * cache-buster; its value is ignored.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cards change only when their page does, and the page's metadata versions
 * the URL by its `updatedAt`, so the CDN may keep a card for a year; a
 * client checks back hourly. A card drawn without one of its pictures, or
 * for a path that does not exist (yet), is kept briefly so the next request
 * can do better.
 */
const CACHE_LONG = 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=604800'
const CACHE_SHORT = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=600'

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const origin = new URL(request.url).origin

  let loaded: Loaded
  try {
    loaded = await loadCard(path.map(decode), origin)
  } catch (error) {
    console.error(`[og] could not build the card for /${path.join('/')}:`, error)
    loaded = { card: { kind: 'generic' }, complete: false }
  }

  const fresh = loaded.card.kind !== 'generic' && loaded.complete
  return new ImageResponse(renderCard(loaded.card), {
    ...CARD,
    fonts: await loadCardFonts(),
    headers: {
      'Cache-Control': fresh ? CACHE_LONG : CACHE_SHORT,
      // Discord and friends render this; nothing about the platform shows.
      'X-Robots-Tag': 'noindex',
    },
  })
}
