import { buildFeed, resolveFeed } from '@/lib/feed'

/**
 * The RSS feeds (src/lib/feed.ts): /feeds is the site-wide feed and
 * /feeds/<context path> a context's, covering everything below it. Readers
 * never see these paths: next.config.ts rewrites /feed.xml and
 * /<context path>/feed.xml here, since a route can't sit beside the
 * catch-all page that serves the contexts, and `feeds` is a reserved
 * top-level slug (src/collections/Contexts.ts). A path that is not a
 * context is a 404.
 *
 * Runs in Node (Payload's local API needs it).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A feed turns over with the pages (which revalidate in two minutes): kept five at the CDN, served stale for an hour while a fresh one is built. */
const CACHE = 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params
  const scope = await resolveFeed(path.map(decode))
  if (!scope) {
    return new Response('No feed here.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    })
  }

  const origin = new URL(request.url).origin
  const xml = await buildFeed(scope, origin)

  // A browser (it asks for HTML) gets the feed as plain XML, which every
  // browser renders, through the stylesheet (public/feed.xsl); a feed
  // reader gets the feed's own type. Firefox would offer to download the
  // latter instead of showing it.
  const browser = (request.headers.get('accept') ?? '').includes('text/html')
  return new Response(xml, {
    headers: {
      'Content-Type': `${browser ? 'application/xml' : 'application/rss+xml'}; charset=utf-8`,
      'Cache-Control': CACHE,
      Vary: 'Accept',
      // The articles are indexed on their own pages; the feed is for readers.
      'X-Robots-Tag': 'noindex, follow',
    },
  })
}
