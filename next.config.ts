import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/** The Rulercraft map and its world, as src/maps/source.ts names them (DYNMAP_URL, DYNMAP_WORLD). */
const RULERCRAFT_MAP = 'https://map.rulercraft.com'
const RULERCRAFT_WORLD = 'RulerEarth'

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js, Payload" header: the stack stays invisible.
  poweredByHeader: false,
  // The RSS feeds read as part of what they cover (/gov/feed.xml,
  // /times/girlietea/feed.xml, /feed.xml for the site), but the contexts are
  // served by a catch-all page, which a route can't share a segment with. So
  // they are rewritten, before anything else matches, to the feed route
  // under the reserved `feeds` prefix (src/app/(frontend)/feeds).
  //
  // And the Rulercraft map's live feed (who is online and where, and every
  // siege marker's rewrite) is passed through as /maps/feed/<since>: the map
  // sends no CORS header, so the browser can't read it from this site, but a
  // rewrite to another host is the same site to the browser, and Vercel's
  // network forwards it without running a function of this site's, so
  // watching the map costs no compute (src/components/maps/live.ts,
  // src/maps/feed.ts). Only the one world's feed, from a time in digits.
  rewrites: async () => ({
    beforeFiles: [
      { source: '/feed.xml', destination: '/feeds' },
      { source: '/:path*/feed.xml', destination: '/feeds/:path*' },
      { source: '/maps/feed/:since(\\d{1,15})', destination: `${RULERCRAFT_MAP}/up/world/${RULERCRAFT_WORLD}/:since` },
    ],
  }),
  // Where the browser reads the live feed from: through the rewrite above, or, with the war demo on one's own machine
  // (src/lib/warDemo.ts), from the site's own /maps/players, which makes the demo's battle up.
  env: {
    NEXT_PUBLIC_MAPS_LIVE: process.env.MAPS_WAR_DEMO === '1' && !process.env.VERCEL ? 'site' : 'feed',
  },
  images: {
    qualities: [75],
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    // Media served from Vercel Blob in production
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      // Minecraft heads are not here on purpose: the browser loads them
      // straight from mc-heads.net (src/components/site/BylineAvatar.tsx).
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const withPayloadConfig = withPayload(nextConfig, { devBundleServerPackages: false })

/**
 * Payload sends `Critical-CH: Sec-CH-Prefers-Color-Scheme` with every page,
 * so that its admin knows the reader's light or dark theme from the first
 * request. Chrome answers it by sending any request that lacked the hint a
 * second time: a browser that hasn't seen the site yet (a new profile, a
 * private window, cleared site data) loads every first page twice, and the
 * admin's "Create new", which makes its draft as the page renders (autosave),
 * left an empty, untitled article behind for every one it opened. Without
 * it, `Accept-CH` still has the browser send the hint from the next request
 * on; the first admin page a browser ever opens may show the default theme
 * for a moment.
 */
const payloadHeaders = withPayloadConfig.headers
withPayloadConfig.headers = async () =>
  ((await payloadHeaders?.()) ?? []).map((rule) => ({
    ...rule,
    headers: rule.headers.filter((header) => header.key.toLowerCase() !== 'critical-ch'),
  }))

export default withPayloadConfig
