import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js, Payload" header: the stack stays invisible.
  poweredByHeader: false,
  // The RSS feeds read as part of what they cover (/gov/feed.xml,
  // /times/girlietea/feed.xml, /feed.xml for the site), but the contexts are
  // served by a catch-all page, which a route can't share a segment with. So
  // they are rewritten, before anything else matches, to the feed route
  // under the reserved `feeds` prefix (src/app/(frontend)/feeds).
  rewrites: async () => ({
    beforeFiles: [
      { source: '/feed.xml', destination: '/feeds' },
      { source: '/:path*/feed.xml', destination: '/feeds/:path*' },
    ],
  }),
  images: {
    // 100 serves Minecraft heads losslessly (BylineAvatar); 75 is the default.
    qualities: [75, 100],
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
      // Minecraft player heads, the default byline avatars
      {
        protocol: 'https',
        hostname: 'mc-heads.net',
        pathname: '/avatar/**',
      },
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
